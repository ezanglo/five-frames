import "server-only";

import { createServiceClient } from "@/lib/supabase/service-client";
import { getEventForHost } from "@/lib/dal/events";
import {
  canEditEventTheme,
  deriveEventLifecycleState,
  isGalleryOpenToLinkHolders,
} from "@/lib/events/lifecycle";
import { normalizeThemeImage } from "@/lib/media/theme-image";
import {
  createThemeSignedReadUrl,
  createThemeSignedUpload,
  downloadThemeObject,
  listThemeFolder,
  removeThemeObjects,
  themeImagePath,
  themeObjectExists,
  themeRawPath,
  uploadThemeObject,
} from "@/lib/media/theme-storage";
import type { EventRow } from "@/lib/db/types";
import {
  THEME_IMAGE_MAX_BYTES,
  THEME_IMAGE_MIME_TYPES,
  isHeicUpload,
  type ThemeImageRefusal,
} from "@/lib/theme/image";
import { themeViewFrom, type EventThemeView } from "@/lib/theme/view";

/**
 * Event theme image (product.md §10.1, architecture §7a, decision D19): begin → commit → swap →
 * prune, and remove. Every mutation takes the authenticated host id and is scoped by ownership,
 * like lib/dal/events.ts; the upload path is always built here from the owned event's id and a
 * server-generated UUID. Theme writes touch only `theme_image_path` — never payment,
 * activation, tokens or lifecycle columns.
 *
 * Reads are per surface. Each exported reader performs that surface's own access check and only
 * then mints a signed URL (architecture §7a table). There is deliberately no reader for the
 * Operator Console.
 */

const UPLOAD_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

type NotAllowed = { kind: "not_found" } | { kind: "not_editable" };

export type BeginThemeUploadResult =
  | { kind: "ready"; uploadId: string; signedUrl: string }
  | { kind: "refused"; reason: ThemeImageRefusal }
  | NotAllowed;

export type CommitThemeUploadResult =
  | { kind: "saved"; imageUrl: string | null; small: boolean }
  | { kind: "refused"; reason: ThemeImageRefusal }
  | NotAllowed;

async function loadEditableEvent(hostId: string, eventId: string): Promise<EventRow | NotAllowed> {
  const event = await getEventForHost(hostId, eventId);
  if (!event) return { kind: "not_found" };
  if (!canEditEventTheme(event)) return { kind: "not_editable" };
  return event;
}

function isNotAllowed(value: EventRow | NotAllowed): value is NotAllowed {
  return "kind" in value;
}

/**
 * Step 1: a signed upload capability for one fresh, server-chosen raw path. The declared size and
 * type are only a fast, calm refusal; Storage enforces both again at upload, and commit
 * re-validates the actual bytes.
 */
export async function beginThemeImageUpload(
  hostId: string,
  eventId: string,
  declared: { sizeBytes: number; contentType: string },
): Promise<BeginThemeUploadResult> {
  const event = await loadEditableEvent(hostId, eventId);
  if (isNotAllowed(event)) return event;

  if (!Number.isFinite(declared.sizeBytes) || declared.sizeBytes <= 0) {
    return { kind: "refused", reason: "unsupported" };
  }
  if (isHeicUpload({ type: declared.contentType })) return { kind: "refused", reason: "heic" };
  if (declared.sizeBytes > THEME_IMAGE_MAX_BYTES) return { kind: "refused", reason: "too_large" };
  if (!(THEME_IMAGE_MIME_TYPES as readonly string[]).includes(declared.contentType)) {
    return { kind: "refused", reason: "unsupported" };
  }

  const uploadId = crypto.randomUUID();
  const { signedUrl } = await createThemeSignedUpload(themeRawPath(event.id, uploadId));
  return { kind: "ready", uploadId, signedUrl };
}

/**
 * Steps 2–4: verify, normalize, swap, prune. Any failure before the swap leaves the previous
 * image exactly as it was (product.md §13); only the attempt's own raw upload is discarded.
 */
export async function commitThemeImageUpload(
  hostId: string,
  eventId: string,
  uploadId: string,
): Promise<CommitThemeUploadResult> {
  if (!UPLOAD_ID.test(uploadId)) return { kind: "refused", reason: "missing" };

  const event = await loadEditableEvent(hostId, eventId);
  if (isNotAllowed(event)) return event;

  // The raw path is derived from the owned event, so an upload id from another event's folder
  // simply isn't found here.
  const rawPath = themeRawPath(event.id, uploadId);
  const bytes = await downloadThemeObject(rawPath);
  if (!bytes) return { kind: "refused", reason: "missing" };

  const normalized = bytes.length > THEME_IMAGE_MAX_BYTES
    ? ({ ok: false, reason: "too_large" } as const)
    : await normalizeThemeImage(bytes);
  if (!normalized.ok) {
    await removeThemeObjects([rawPath]).catch(() => undefined);
    return { kind: "refused", reason: normalized.reason };
  }

  const newPath = themeImagePath(event.id, uploadId, normalized.extension);
  await uploadThemeObject(newPath, normalized.buffer, normalized.contentType);

  const supabase = createServiceClient();
  const { data: swapped, error } = await supabase
    .from("events")
    .update({ theme_image_path: newPath })
    .eq("id", event.id)
    .eq("host_id", hostId)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!swapped) {
    await removeThemeObjects([rawPath, newPath]).catch(() => undefined);
    return { kind: "not_found" };
  }

  // A concurrent commit's prune may have removed this object between its upload and this swap.
  // The bytes are still in hand, so restore it rather than leave the event pointing at nothing.
  if (!(await themeObjectExists(newPath))) {
    await uploadThemeObject(newPath, normalized.buffer, normalized.contentType);
  }

  await pruneThemeFolder(event.id);

  return {
    kind: "saved",
    imageUrl: await createThemeSignedReadUrl(newPath),
    small: normalized.small,
  };
}

/** Remove: clear the pointer first, then prune the whole folder. Nothing else changes. */
export async function removeThemeImage(
  hostId: string,
  eventId: string,
): Promise<{ kind: "removed" } | NotAllowed> {
  const event = await loadEditableEvent(hostId, eventId);
  if (isNotAllowed(event)) return event;

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("events")
    .update({ theme_image_path: null })
    .eq("id", event.id)
    .eq("host_id", hostId)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) return { kind: "not_found" };

  await pruneThemeFolder(event.id);
  return { kind: "removed" };
}

/**
 * Deletes every object in the event's folder except the current `theme_image_path`, read fresh
 * at prune time. Raw uploads, previous images and leftovers from interrupted or concurrent
 * uploads are all just "not current" (D19), so no lock or saga is needed.
 */
async function pruneThemeFolder(eventId: string): Promise<void> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("events")
    .select("theme_image_path")
    .eq("id", eventId)
    .maybeSingle();
  if (error) throw error;
  const keep = (data as { theme_image_path: string | null } | null)?.theme_image_path ?? null;

  const objects = await listThemeFolder(eventId);
  await removeThemeObjects(objects.filter((path) => path !== keep));
}

// ---------------------------------------------------------------------------------------------
// Reads. Each one is a surface's access check followed by a signed URL, never a URL alone.
// ---------------------------------------------------------------------------------------------

/** Host event pages and Look previews: ownership, in any lifecycle state including Draft. */
export async function getEventThemeForHost(
  hostId: string,
  eventId: string,
): Promise<EventThemeView | null> {
  const event = await getEventForHost(hostId, eventId);
  if (!event) return null;
  return themeViewForEvent(event, true);
}

/**
 * Guest event screens (`/e/[token]`): the exact, current event token, on an activated event.
 * Capture doesn't need to be open. A rotated or revoked token resolves to nothing.
 */
export async function getEventThemeForGuest(eventToken: string): Promise<EventThemeView | null> {
  const event = await eventByColumn("event_token", eventToken);
  if (!event || !event.activated_at) return null;
  const state = deriveEventLifecycleState(event);
  return themeViewForEvent(event, state !== "expired" && state !== "archived");
}

/**
 * Gallery pages (`/g/[token]`): only while the gallery is actually granted to link holders.
 * The locked and "only me" branches get null — no accent, no hashtag and no image URL
 * (criterion 43).
 */
export async function getEventThemeForGallery(galleryToken: string): Promise<EventThemeView | null> {
  const event = await eventByColumn("gallery_token", galleryToken);
  if (!event || !isGalleryOpenToLinkHolders(event)) return null;
  return themeViewForEvent(event, true);
}

async function eventByColumn(column: "event_token" | "gallery_token", token: string) {
  if (!token) return null;
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("events")
    .select()
    .eq(column, token)
    .maybeSingle();
  if (error) throw error;
  return data as EventRow | null;
}

async function themeViewForEvent(event: EventRow, mayShowImage: boolean): Promise<EventThemeView> {
  const imageUrl =
    mayShowImage && event.theme_image_path && !event.media_deleted_at
      ? await createThemeSignedReadUrl(event.theme_image_path)
      : null;
  return themeViewFrom(event, imageUrl);
}

// ---------------------------------------------------------------------------------------------
// Bytes for the server renderers (keepsakes, signage). Never reaches a browser as a URL: the
// caller has already made its own access check on `event`, and embeds the result.
// ---------------------------------------------------------------------------------------------

// Per server instance. Paths are immutable (each upload gets a new UUID), so this needs no
// invalidation; it is bounded so a long-lived instance can't grow without end.
const themeBytesCache = new Map<string, Promise<Buffer | null>>();
const THEME_BYTES_CACHE_LIMIT = 16;

export function readThemeImageBytes(event: EventRow): Promise<Buffer | null> {
  const path = event.theme_image_path;
  if (!path || event.media_deleted_at) return Promise.resolve(null);
  let cached = themeBytesCache.get(path);
  if (!cached) {
    cached = downloadThemeObject(path).catch((error) => {
      console.warn("theme image unavailable", error);
      themeBytesCache.delete(path);
      return null;
    });
    if (themeBytesCache.size >= THEME_BYTES_CACHE_LIMIT) {
      themeBytesCache.delete(themeBytesCache.keys().next().value!);
    }
    themeBytesCache.set(path, cached);
  }
  return cached;
}
