import "server-only";

import { createServiceClient } from "@/lib/supabase/service-client";
import { getEventById, getEventForHost, listEventsForHost } from "@/lib/dal/events";
import { isCaptureOpen } from "@/lib/events/lifecycle";
import {
  createSignedReadUrl,
  createSignedUploadUrl,
  generateDerivatives,
  getResumableUploadEndpoint,
  verifyUploadedObject,
} from "@/lib/media/storage";
import type { CaptureRow, CaptureStatus, EventRow } from "@/lib/db/types";

/**
 * The frame-limit mechanism (architecture §6, decisions D5/D6). Every function here takes
 * eventId and guestSessionId and scopes its query by both — a capture id alone never loads
 * a row, mirroring the ownership discipline in lib/dal/events.ts.
 */

export type ReserveOutcome =
  | {
      kind: "reserved";
      capture: CaptureRow;
      uploadUrl: string;
      uploadToken: string;
      resumableEndpoint: string;
    }
  | { kind: "already_committed"; capture: CaptureRow }
  | { kind: "expired" }
  | { kind: "capture_not_open" }
  | { kind: "frames_exhausted" };

/**
 * Reserve step. Re-checks the capture gate with a fresh read (architecture §10) before
 * ever calling the reserve_capture() function, then relies on that function's row lock and
 * idempotent-on-reserve_key behavior for the concurrency guarantee (invariants 1, 3, 5).
 */
export async function reserveCapture(
  eventId: string,
  guestSessionId: string,
  reserveKey: string,
): Promise<ReserveOutcome> {
  const event = await getEventById(eventId);
  if (!event || !isCaptureOpen(event)) {
    return { kind: "capture_not_open" };
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .rpc("reserve_capture", {
      p_guest_session_id: guestSessionId,
      p_reserve_key: reserveKey,
    })
    .single();

  if (error) {
    if (error.code === "P0001") return { kind: "frames_exhausted" };
    throw error;
  }

  const capture = data as CaptureRow;

  if (capture.status === "committed") {
    return { kind: "already_committed", capture };
  }
  if (capture.status === "expired") {
    return { kind: "expired" };
  }

  const { signedUrl, token } = await createSignedUploadUrl(capture.storage_path);
  return {
    kind: "reserved",
    capture,
    uploadUrl: signedUrl,
    uploadToken: token,
    resumableEndpoint: getResumableUploadEndpoint(),
  };
}

export type CommitOutcome =
  | { kind: "committed"; capture: CaptureRow }
  | { kind: "not_found" }
  | { kind: "expired" }
  | { kind: "capture_not_open" }
  | { kind: "not_uploaded" };

/**
 * Commit step. Refuses a lapsed reservation and refuses when the capture gate has closed
 * since reserve (architecture §10), verifies the uploaded object before ever marking the
 * frame consumed (invariant 2), and is idempotent for an already-committed row.
 */
export async function commitCapture(
  eventId: string,
  guestSessionId: string,
  captureId: string,
  message: string | null,
): Promise<CommitOutcome> {
  const supabase = createServiceClient();
  const { data: existing, error: fetchError } = await supabase
    .from("captures")
    .select()
    .eq("id", captureId)
    .eq("guest_session_id", guestSessionId)
    .eq("event_id", eventId)
    .maybeSingle();

  if (fetchError) throw fetchError;
  if (!existing) return { kind: "not_found" };

  const capture = existing as CaptureRow;
  if (capture.status === "committed") return { kind: "committed", capture };

  // A pending row past its TTL is expired even before reserve_capture()'s lazy sweep has
  // touched its status column — commit must not race ahead of that sweep and honor a
  // reservation that has already lapsed (architecture §6).
  const isLapsed =
    capture.status === "expired" ||
    (capture.status === "pending" && new Date(capture.expires_at).getTime() < Date.now());

  if (isLapsed) {
    if (capture.status === "pending") {
      await supabase
        .from("captures")
        .update({ status: "expired" })
        .eq("id", capture.id)
        .eq("status", "pending");
    }
    return { kind: "expired" };
  }

  const event = await getEventById(eventId);
  if (!event || !isCaptureOpen(event)) {
    return { kind: "capture_not_open" };
  }

  const uploaded = await verifyUploadedObject(capture.storage_path);
  if (!uploaded.exists) return { kind: "not_uploaded" };

  const derivatives = await generateDerivatives(capture.storage_path);

  const { data: updated, error: updateError } = await supabase
    .from("captures")
    .update({
      status: "committed",
      committed_at: new Date().toISOString(),
      message,
      mime_type: uploaded.mimeType,
      display_path: derivatives.displayPath,
      thumbnail_path: derivatives.thumbnailPath,
      display_width: derivatives.displayWidth,
      display_height: derivatives.displayHeight,
    })
    .eq("id", captureId)
    .eq("status", "pending")
    .select()
    .maybeSingle();

  if (updateError) throw updateError;

  if (!updated) {
    const { data: raced, error: racedError } = await supabase
      .from("captures")
      .select()
      .eq("id", captureId)
      .single();
    if (racedError) throw racedError;
    return { kind: "committed", capture: raced as CaptureRow };
  }

  return { kind: "committed", capture: updated as CaptureRow };
}

export async function listCapturesForGuestSession(
  eventId: string,
  guestSessionId: string,
): Promise<CaptureRow[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("captures")
    .select()
    .eq("guest_session_id", guestSessionId)
    .eq("event_id", eventId)
    .in("status", ["pending", "committed"])
    // Host moderation removes a capture from the guest's own view too (spec §8.3
    // exception), without ever freeing its slot — the frame stays consumed either way.
    .is("hidden_at", null)
    .is("deleted_at", null)
    .order("slot_index", { ascending: true });

  if (error) throw error;
  return data as CaptureRow[];
}

/**
 * Slots of this guest session that hold a committed capture the host has hidden or deleted.
 * The guest's own view leaves those captures out (spec §8.3), but each still consumed its frame
 * (§9.3, invariant 4), so the guest UI must never offer the slot or count it as left (HOST-08).
 * Slot numbers only: no id, path or URL of a moderated capture reaches the guest.
 */
export async function listModeratedSlotIndexesForGuestSession(
  eventId: string,
  guestSessionId: string,
): Promise<number[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("captures")
    .select("slot_index")
    .eq("guest_session_id", guestSessionId)
    .eq("event_id", eventId)
    .eq("status", "committed")
    .or("hidden_at.not.is.null,deleted_at.not.is.null")
    .order("slot_index", { ascending: true });

  if (error) throw error;
  return (data as { slot_index: number }[]).map((row) => row.slot_index);
}

const EXTENSION_FOR_MIME_TYPE: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/heic": ".heic",
  "image/heif": ".heif",
};

export type GuestCaptureView = {
  id: string;
  slotIndex: number;
  status: CaptureStatus;
  message: string | null;
  /** When the frame was committed (null while still pending). */
  capturedAt: string | null;
  thumbnailUrl: string | null;
  /** The ~1600w display derivative, for the full-screen viewer. */
  displayUrl: string | null;
  downloadUrl: string | null;
};

/** Filename for a guest's own original — also what makes the signed URL save, not navigate. */
export function filenameForGuestOriginal(slotIndex: number, mimeType: string | null): string {
  const extension = (mimeType && EXTENSION_FOR_MIME_TYPE[mimeType]) || "";
  return `my-shot-${slotIndex + 1}${extension}`;
}

/**
 * A guest's private view of their own captures (spec §8.3, invariant 11's guest-side
 * counterpart), with signed read URLs minted after the ownership-scoped query above has
 * already done the access check (architecture §7 — the signed URL is the result of
 * authorization, never a substitute for it). Only committed captures have derivatives, so
 * a pending row's urls are null.
 */
export async function listCapturesForGuestSessionWithUrls(
  eventId: string,
  guestSessionId: string,
): Promise<GuestCaptureView[]> {
  const captures = await listCapturesForGuestSession(eventId, guestSessionId);

  return Promise.all(
    captures.map(async (capture) => {
      if (capture.status !== "committed" || !capture.thumbnail_path) {
        return {
          id: capture.id,
          slotIndex: capture.slot_index,
          status: capture.status,
          message: capture.message,
          capturedAt: null,
          thumbnailUrl: null,
          displayUrl: null,
          downloadUrl: null,
        };
      }

      const [thumbnailUrl, displayUrl, downloadUrl] = await Promise.all([
        createSignedReadUrl(capture.thumbnail_path),
        createSignedReadUrl(capture.display_path ?? capture.thumbnail_path),
        createSignedReadUrl(
          capture.storage_path,
          60 * 10,
          filenameForGuestOriginal(capture.slot_index, capture.mime_type),
        ),
      ]);

      return {
        id: capture.id,
        slotIndex: capture.slot_index,
        status: capture.status,
        message: capture.message,
        capturedAt: capture.committed_at,
        thumbnailUrl,
        displayUrl,
        downloadUrl,
      };
    }),
  );
}

/**
 * Host dashboard and moderation (roadmap Slice 4, product.md §11.2). Every function below
 * takes hostId and verifies ownership via getEventForHost before touching captures — the
 * same ownership-predicate discipline as lib/dal/events.ts (product invariant 9). A null
 * return means "not found or not owned," never distinguished further.
 */

export type EventCaptureStats = {
  guestSessionCount: number;
  photoCount: number;
};

export async function getEventCaptureStats(
  hostId: string,
  eventId: string,
): Promise<EventCaptureStats | null> {
  const event = await getEventForHost(hostId, eventId);
  if (!event) return null;

  const supabase = createServiceClient();
  const [sessions, photos] = await Promise.all([
    supabase
      .from("guest_sessions")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId),
    supabase
      .from("captures")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId)
      .eq("status", "committed")
      .is("deleted_at", null),
  ]);

  if (sessions.error) throw sessions.error;
  if (photos.error) throw photos.error;

  return {
    guestSessionCount: sessions.count ?? 0,
    photoCount: photos.count ?? 0,
  };
}

/**
 * The host's events with their committed-photo counts, for the events list (host 05 / D2b).
 * Ownership comes from listEventsForHost — counts are only ever queried for event ids that
 * query returned, never for caller-supplied ids.
 */
export async function listEventsWithPhotoCountsForHost(
  hostId: string,
): Promise<{ event: EventRow; photoCount: number }[]> {
  const events = await listEventsForHost(hostId);
  const supabase = createServiceClient();

  return Promise.all(
    events.map(async (event) => {
      if (!event.activated_at) return { event, photoCount: 0 };
      const { count, error } = await supabase
        .from("captures")
        .select("id", { count: "exact", head: true })
        .eq("event_id", event.id)
        .eq("status", "committed")
        .is("deleted_at", null);
      if (error) throw error;
      return { event, photoCount: count ?? 0 };
    }),
  );
}

export type HostCaptureView = {
  id: string;
  slotIndex: number;
  guestSessionId: string;
  guestDisplayName: string;
  /** When the frame was committed; drives newest/oldest sorting and the card timestamp. */
  capturedAt: string;
  message: string | null;
  hidden: boolean;
  favorited: boolean;
  thumbnailUrl: string;
  downloadUrl: string;
};

/**
 * The gallery grid (product.md §11.2): every committed, non-deleted capture across the
 * event's guest sessions, with signed urls minted after the ownership check above — same
 * "query is the access check, signed url is its result" rule as the guest-facing view.
 */
export async function listCapturesForEventHost(
  hostId: string,
  eventId: string,
): Promise<HostCaptureView[] | null> {
  const event = await getEventForHost(hostId, eventId);
  if (!event) return null;

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("captures")
    .select(
      "id, slot_index, guest_session_id, message, hidden_at, favorited_at, thumbnail_path, storage_path, mime_type, created_at, committed_at, guest_sessions(display_name)",
    )
    .eq("event_id", eventId)
    .eq("status", "committed")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) throw error;

  type Row = {
    id: string;
    slot_index: number;
    guest_session_id: string;
    message: string | null;
    hidden_at: string | null;
    favorited_at: string | null;
    thumbnail_path: string | null;
    storage_path: string;
    mime_type: string | null;
    created_at: string;
    committed_at: string | null;
    guest_sessions: { display_name: string } | { display_name: string }[] | null;
  };

  return Promise.all(
    (data as Row[]).map(async (row, index) => {
      const guestSession = Array.isArray(row.guest_sessions)
        ? row.guest_sessions[0]
        : row.guest_sessions;
      const guestDisplayName = guestSession?.display_name ?? "Guest";
      const [thumbnailUrl, downloadUrl] = await Promise.all([
        createSignedReadUrl(row.thumbnail_path ?? row.storage_path),
        createSignedReadUrl(
          row.storage_path,
          60 * 10,
          filenameForOriginal(index, guestDisplayName, row.mime_type),
        ),
      ]);

      return {
        id: row.id,
        slotIndex: row.slot_index,
        guestSessionId: row.guest_session_id,
        guestDisplayName,
        capturedAt: row.committed_at ?? row.created_at,
        message: row.message,
        hidden: row.hidden_at !== null,
        favorited: row.favorited_at !== null,
        thumbnailUrl,
        downloadUrl,
      };
    }),
  );
}

export type GalleryCaptureView = {
  id: string;
  message: string | null;
  favorited: boolean;
  imageUrl: string;
  /** Natural size of `imageUrl`'s image for the layout (D22); null for a not-yet-backfilled capture. */
  width: number | null;
  height: number | null;
};

/**
 * The public gallery viewer (product.md §7.3/§8.2, roadmap Slice 5). No ownership
 * predicate: the caller (the `(gallery)/g/[token]` route) has already resolved the event by
 * its gallery token and checked reveal timing and visibility before calling this — the
 * access check happens once, at the event level, same as everywhere else media is served
 * (architecture §7). Hidden and deleted captures are excluded, same as every other gallery
 * surface. Uses the display derivative, not the original, since a public viewer only ever
 * needs to view — downloading originals is host-only (product.md §11.2, roadmap Slice 8).
 * The host's gallery layout (D22) is not an input: every layout renders exactly this list.
 */
export async function listCapturesForGalleryViewer(
  eventId: string,
): Promise<GalleryCaptureView[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("captures")
    .select(
      "id, message, favorited_at, display_path, display_width, display_height, thumbnail_path, storage_path, created_at",
    )
    .eq("event_id", eventId)
    .eq("status", "committed")
    .is("hidden_at", null)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  if (error) throw error;

  type Row = {
    id: string;
    message: string | null;
    favorited_at: string | null;
    display_path: string | null;
    display_width: number | null;
    display_height: number | null;
    thumbnail_path: string | null;
    storage_path: string;
  };

  return Promise.all(
    (data as Row[]).map(async (row) => ({
      id: row.id,
      message: row.message,
      favorited: row.favorited_at !== null,
      imageUrl: await createSignedReadUrl(
        row.display_path ?? row.thumbnail_path ?? row.storage_path,
      ),
      // The size describes the display derivative only, so it is dropped when a fallback image
      // is served (its shape is then unknown and the tile renders square).
      width: row.display_path ? row.display_width : null,
      height: row.display_path ? row.display_height : null,
    })),
  );
}

export type OriginalDownload = {
  id: string;
  filename: string;
  url: string;
};

function filenameForOriginal(
  index: number,
  guestDisplayName: string,
  mimeType: string | null,
): string {
  const extension = (mimeType && EXTENSION_FOR_MIME_TYPE[mimeType]) || "";
  const slug =
    guestDisplayName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "guest";
  return `${String(index + 1).padStart(3, "0")}-${slug}${extension}`;
}

/**
 * Bulk "download all originals" (product.md §11.2/§12, decision D11: client-driven sequential
 * signed URLs, no server-side zip for MVP). Every original — including a hidden one, matching
 * listCapturesForEventHost's own scope — since hiding removes a capture from the gallery view,
 * not from the host's ownership of their media (invariant 11). Signed URLs are minted fresh on
 * each call rather than reused from page load, so a host who waits before clicking doesn't hit
 * URLs that expired while the page just sat open.
 */
export async function listOriginalDownloadUrlsForEventHost(
  hostId: string,
  eventId: string,
): Promise<OriginalDownload[] | null> {
  const event = await getEventForHost(hostId, eventId);
  if (!event) return null;

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("captures")
    .select("id, storage_path, mime_type, guest_sessions(display_name)")
    .eq("event_id", eventId)
    .eq("status", "committed")
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  if (error) throw error;

  type Row = {
    id: string;
    storage_path: string;
    mime_type: string | null;
    created_at: string;
    committed_at: string | null;
    guest_sessions: { display_name: string } | { display_name: string }[] | null;
  };

  return Promise.all(
    (data as Row[]).map(async (row, index) => {
      const guestSession = Array.isArray(row.guest_sessions)
        ? row.guest_sessions[0]
        : row.guest_sessions;
      const filename = filenameForOriginal(index, guestSession?.display_name ?? "guest", row.mime_type);
      return {
        id: row.id,
        filename,
        url: await createSignedReadUrl(row.storage_path, 60 * 10, filename),
      };
    }),
  );
}

export type ModerationAction =
  | "hide"
  | "unhide"
  | "delete"
  | "favorite"
  | "unfavorite";

/**
 * Hide, unhide, delete, favorite, unfavorite (product.md §11.2). Moderation only ever
 * touches these flag columns, never slot_index or status — so it can never free a slot or
 * restore a frame (product invariant 4). Delete is terminal: there is no undelete.
 */
export async function moderateCapture(
  hostId: string,
  eventId: string,
  captureId: string,
  action: ModerationAction,
): Promise<boolean> {
  const event = await getEventForHost(hostId, eventId);
  if (!event) return false;

  const now = new Date().toISOString();
  const patch: Record<string, string | null> =
    action === "hide"
      ? { hidden_at: now }
      : action === "unhide"
        ? { hidden_at: null }
        : action === "delete"
          ? { deleted_at: now }
          : action === "favorite"
            ? { favorited_at: now }
            : { favorited_at: null };

  const supabase = createServiceClient();
  const { error } = await supabase
    .from("captures")
    .update(patch)
    .eq("id", captureId)
    .eq("event_id", eventId);

  if (error) throw error;
  return true;
}
