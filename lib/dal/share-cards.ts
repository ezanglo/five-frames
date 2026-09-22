import "server-only";

import { createServiceClient } from "@/lib/supabase/service-client";
import { CAPTURES_BUCKET } from "@/lib/media/constants";
import { renderShareCardPng } from "@/lib/media/share-card";
import type { CaptureRow, EventRow } from "@/lib/db/types";

/**
 * The guest sharing flow (product.md §10): generates or retrieves the branded share-card
 * derivative for one of the requesting guest's own committed captures. Every outcome besides
 * "ok" is deliberately generic ("not_found") rather than distinguishing "wrong guest," "hidden
 * by the host," "not committed yet," or "no such capture" — the caller (another guest probing
 * a capture id that isn't theirs) must not be able to tell those apart (architecture §10
 * "pre-reveal share isolation" applied to cross-guest access too).
 */
export type ShareCardOutcome =
  | { kind: "sharing_disabled" }
  | { kind: "not_found" }
  | { kind: "ok"; bytes: Buffer };

function formatEventDateLabel(eventDate: string | null): string | null {
  if (!eventDate) return null;
  // event_date is a plain calendar date (no time-of-day), so formatting in UTC keeps the
  // same calendar date regardless of the server process's own timezone — unlike the
  // datetime-local fields lib/events/timezone.ts converts, there is no wall-clock instant
  // here to get wrong.
  const date = new Date(`${eventDate}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function sharePathFor(storagePath: string): string {
  return storagePath.replace(/\/original$/, "/share");
}

async function downloadIfExists(
  supabase: ReturnType<typeof createServiceClient>,
  path: string,
): Promise<Buffer | null> {
  const { data, error } = await supabase.storage.from(CAPTURES_BUCKET).download(path);
  if (error || !data) return null;
  return Buffer.from(await data.arrayBuffer());
}

/**
 * A capture is eligible for the sharing flow only once it is genuinely the guest's own,
 * committed, and not hidden or deleted by the host (product.md §10: "sharing does not bypass
 * moderation"). This is the same ownership predicate `commitCapture` uses in
 * lib/dal/captures.ts, scoped by all three of capture id, guest session id, and event id.
 */
function isShareable(capture: CaptureRow): boolean {
  return (
    capture.status === "committed" &&
    !capture.hidden_at &&
    !capture.deleted_at &&
    Boolean(capture.display_path)
  );
}

/**
 * Generation is idempotent and on-demand (architecture §7: "cached as a derivative"): the
 * share asset lives at a deterministic sibling path next to the original, so a repeated call
 * either reuses that cached object or overwrites it with an equivalent render — never a second,
 * divergent derivative. The original and its display/thumbnail derivatives are only ever read
 * here, never written (invariant 10).
 */
export async function getShareCardForGuestCapture(
  event: EventRow,
  guestSessionId: string,
  captureId: string,
): Promise<ShareCardOutcome> {
  if (!event.sharing_enabled) return { kind: "sharing_disabled" };

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("captures")
    .select()
    .eq("id", captureId)
    .eq("guest_session_id", guestSessionId)
    .eq("event_id", event.id)
    .maybeSingle();

  if (error) throw error;
  const capture = data as CaptureRow | null;
  if (!capture || !isShareable(capture)) return { kind: "not_found" };

  if (capture.share_path) {
    const cached = await downloadIfExists(supabase, capture.share_path);
    if (cached) return { kind: "ok", bytes: cached };
  }

  const photoBuffer = await downloadIfExists(supabase, capture.display_path!);
  if (!photoBuffer) return { kind: "not_found" };

  const png = await renderShareCardPng({
    eventName: event.name,
    eventDateLabel: formatEventDateLabel(event.event_date),
    hashtag: event.hashtag,
    message: capture.message,
    photoBuffer,
  });

  const sharePath = sharePathFor(capture.storage_path);
  const { error: uploadError } = await supabase.storage
    .from(CAPTURES_BUCKET)
    .upload(sharePath, png, { contentType: "image/png", upsert: true });
  if (uploadError) throw uploadError;

  await supabase
    .from("captures")
    .update({ share_path: sharePath })
    .eq("id", capture.id)
    .eq("event_id", event.id);

  return { kind: "ok", bytes: png };
}
