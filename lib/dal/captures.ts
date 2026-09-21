import "server-only";

import { createServiceClient } from "@/lib/supabase/service-client";
import { getEventById } from "@/lib/dal/events";
import { isCaptureOpen } from "@/lib/events/lifecycle";
import { createSignedUploadUrl, generateDerivatives, verifyUploadedObject } from "@/lib/media/storage";
import type { CaptureRow } from "@/lib/db/types";

/**
 * The frame-limit mechanism (architecture §6, decisions D5/D6). Every function here takes
 * eventId and guestSessionId and scopes its query by both — a capture id alone never loads
 * a row, mirroring the ownership discipline in lib/dal/events.ts.
 */

export type ReserveOutcome =
  | { kind: "reserved"; capture: CaptureRow; uploadUrl: string }
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

  const uploadUrl = await createSignedUploadUrl(capture.storage_path);
  return { kind: "reserved", capture, uploadUrl };
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
    .order("slot_index", { ascending: true });

  if (error) throw error;
  return data as CaptureRow[];
}
