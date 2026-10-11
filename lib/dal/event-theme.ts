import "server-only";

import { createHash } from "node:crypto";

import { createServiceClient } from "@/lib/supabase/service-client";
import { getEventAccessFor, type EventAccess } from "@/lib/dal/event-access";
import { supportUpdateEvent } from "@/lib/dal/support-actions";
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
 * prune, and remove. Every mutation takes the authenticated user id and admits owner and support
 * (D27): the owner's swap is scoped by ownership, support's goes through `support_update_event`,
 * which logs it in the same transaction. The upload path is always built here from the admitted
 * event's id and a server-generated UUID. Theme writes touch only `theme_image_path` — never payment,
 * activation, tokens or lifecycle columns.
 *
 * Reads are per surface. Each exported reader performs that surface's own access check and only
 * then mints a signed URL (architecture §7a table). There is deliberately no reader for the
 * Operator Console's own pages.
 */

const UPLOAD_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

type NotAllowed = { kind: "not_found" } | { kind: "not_editable" };

export type BeginThemeUploadResult =
  | { kind: "ready"; uploadId: string; signedUrl: string; uploadHeaders: Record<string, string> }
  | { kind: "refused"; reason: ThemeImageRefusal }
  | NotAllowed;

export type CommitThemeUploadResult =
  | { kind: "saved"; imageUrl: string | null; small: boolean }
  | { kind: "refused"; reason: ThemeImageRefusal }
  | NotAllowed;

async function loadEditableEvent(userId: string, eventId: string): Promise<EventAccess | NotAllowed> {
  // Admits: owner, support.
  const access = await getEventAccessFor(userId, eventId, ["owner", "support"]);
  if (!access) return { kind: "not_found" };
  if (!canEditEventTheme(access.event)) return { kind: "not_editable" };
  return access;
}

function isNotAllowed(value: EventAccess | NotAllowed): value is NotAllowed {
  return "kind" in value;
}

/** Sets `theme_image_path`: the owner by ownership, support through the logged SQL function. */
async function setThemeImagePath(
  userId: string,
  access: EventAccess,
  path: string | null,
): Promise<boolean> {
  if (access.role === "support") {
    const updated = await supportUpdateEvent(
      userId,
      access.event.id,
      path ? "theme_image_changed" : "theme_image_removed",
      { theme_image_path: path },
    );
    return updated !== null;
  }
  const { data, error } = await createServiceClient()
    .from("events")
    .update({ theme_image_path: path })
    .eq("id", access.event.id)
    .eq("host_id", userId)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  return data !== null;
}

/**
 * Step 1: a signed upload capability for one fresh, server-chosen raw path. The declared size and
 * type are only a fast, calm refusal; the presigned PUT signs both, so R2 refuses any other
 * file at upload, and commit re-validates the actual bytes.
 */
export async function beginThemeImageUpload(
  userId: string,
  eventId: string,
  declared: { sizeBytes: number; contentType: string },
): Promise<BeginThemeUploadResult> {
  const access = await loadEditableEvent(userId, eventId);
  if (isNotAllowed(access)) return access;
  const { event } = access;

  if (!Number.isFinite(declared.sizeBytes) || declared.sizeBytes <= 0) {
    return { kind: "refused", reason: "unsupported" };
  }
  if (isHeicUpload({ type: declared.contentType })) return { kind: "refused", reason: "heic" };
  if (declared.sizeBytes > THEME_IMAGE_MAX_BYTES) return { kind: "refused", reason: "too_large" };
  if (!(THEME_IMAGE_MIME_TYPES as readonly string[]).includes(declared.contentType)) {
    return { kind: "refused", reason: "unsupported" };
  }

  const uploadId = crypto.randomUUID();
  const upload = await createThemeSignedUpload(themeRawPath(event.id, uploadId), declared);
  return { kind: "ready", uploadId, signedUrl: upload.url, uploadHeaders: upload.headers };
}

/**
 * Steps 2–4: verify, normalize, swap, prune. Any failure before the swap leaves the previous
 * image exactly as it was (product.md §13); only the attempt's own raw upload is discarded.
 */
export async function commitThemeImageUpload(
  userId: string,
  eventId: string,
  uploadId: string,
): Promise<CommitThemeUploadResult> {
  if (!UPLOAD_ID.test(uploadId)) return { kind: "refused", reason: "missing" };

  const access = await loadEditableEvent(userId, eventId);
  if (isNotAllowed(access)) return access;
  const { event } = access;

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

  const swapped = await setThemeImagePath(userId, access, newPath);
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
  userId: string,
  eventId: string,
): Promise<{ kind: "removed" } | NotAllowed> {
  const access = await loadEditableEvent(userId, eventId);
  if (isNotAllowed(access)) return access;

  if (!(await setThemeImagePath(userId, access, null))) return { kind: "not_found" };

  await pruneThemeFolder(access.event.id);
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

/** Host event pages and Look previews, in any lifecycle state including Draft. Admits: owner,
 *  support (support access shows the host's pages, theme included, product.md §10.1). */
export async function getEventThemeForHost(
  userId: string,
  eventId: string,
): Promise<EventThemeView | null> {
  const access = await getEventAccessFor(userId, eventId, ["owner", "support"]);
  if (!access) return null;
  return themeViewForEvent(access.event, true);
}

/**
 * Guest event screens (`/e/[token]`): the exact, current event token, on an activated event.
 * Capture doesn't need to be open. A rotated or revoked token resolves to nothing.
 */
export async function getEventThemeForGuest(eventToken: string): Promise<EventThemeView | null> {
  const event = await eventByColumn("event_token", eventToken);
  if (!event || !event.activated_at) return null;
  return themeViewForEvent(event, guestMayShowThemeImage(event));
}

/** Until archive or media deletion, matching the guest's own view and keepsakes (D29). */
function guestMayShowThemeImage(event: EventRow): boolean {
  if (!event.activated_at || event.media_deleted_at) return false;
  return deriveEventLifecycleState(event) !== "archived";
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

/**
 * What a shared link's preview may show (architecture §5 "Link previews"): the event name and
 * date for any current token, and the theme image only where that link's own page would show
 * it (the guest rule above, or a gallery granted to link holders, criterion 43). `imageKey`
 * changes when the image or that permission does, so the preview URL changes with it and chat
 * apps fetch it again. Null for a token that matches nothing.
 */
export type LinkPreviewSource = {
  event: EventRow;
  mayShowImage: boolean;
  imageKey: string;
};

export async function getLinkPreviewSource(
  link: "capture" | "gallery",
  token: string,
): Promise<LinkPreviewSource | null> {
  const event = await eventByColumn(link === "capture" ? "event_token" : "gallery_token", token);
  if (!event) return null;
  const allowed =
    link === "capture" ? guestMayShowThemeImage(event) : isGalleryOpenToLinkHolders(event);
  const mayShowImage = allowed && Boolean(event.theme_image_path) && !event.media_deleted_at;
  const imageKey = createHash("sha256")
    .update(mayShowImage ? event.theme_image_path! : "none")
    .digest("base64url")
    .slice(0, 10);
  return { event, mayShowImage, imageKey };
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
