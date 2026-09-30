import "server-only";

import { createServiceClient } from "@/lib/supabase/service-client";
import { getEventById } from "@/lib/dal/events";
import { deleteObjects } from "@/lib/media/storage";
import { listThemeFolder, removeThemeObjects } from "@/lib/media/theme-storage";
import type { EventRow } from "@/lib/db/types";

/**
 * Scheduled lifecycle work (product.md §15.2, roadmap Slice 12). Deliberately separate from
 * lib/dal/events.ts and lib/dal/captures.ts: every function here is system-authoritative,
 * driven by the cron route rather than a host or guest request, and has no ownership
 * predicate — the same reason lib/dal/operator-events.ts is its own module. Nothing here is
 * ever called from a host- or guest-facing Server Action.
 */

type CaptureStoragePaths = {
  storage_path: string;
  display_path: string | null;
  thumbnail_path: string | null;
  share_path: string | null;
};

export type PermanentDeletionOutcome =
  | { outcome: "not_found" }
  | { outcome: "already_deleted" }
  | { outcome: "not_eligible" }
  | { outcome: "deleted"; capturesDeleted: number; objectsDeleted: number };

/**
 * Permanently deletes an event's media once its grace period has elapsed (product.md
 * §15.2: "after the grace period, media is permanently deleted"). Safe to call repeatedly
 * and safe under a failure partway through:
 *
 * - Re-checks eligibility itself rather than trusting the caller (`grace_until` must have
 *   already passed, and `media_deleted_at` must still be null) — the same "never trust the
 *   caller, re-derive server-side" discipline as every other lifecycle-gated mutation in
 *   this codebase (architecture §10).
 * - Deletes storage objects (captures and the event's `event-theme` folder) *before* deleting the capture rows that reference them, and
 *   only marks `media_deleted_at` (the durable "this is actually done" marker) after both
 *   steps succeed. If a run crashes between steps, the next run re-lists whatever capture
 *   rows are still present and retries — re-deleting an already-removed storage object is a
 *   harmless no-op (see `deleteObjects`), so a partial retry converges instead of erroring
 *   or double-processing.
 * - Once `media_deleted_at` is set, a repeat call is a pure no-op (`already_deleted`) — it
 *   never re-derives or re-deletes anything, matching "never restore media after permanent
 *   deletion".
 */
export async function permanentlyDeleteEventMedia(
  eventId: string,
  now: Date = new Date(),
): Promise<PermanentDeletionOutcome> {
  const event = await getEventById(eventId);
  if (!event) return { outcome: "not_found" };
  if (event.media_deleted_at) return { outcome: "already_deleted" };
  if (!event.grace_until || Date.parse(event.grace_until) > now.getTime()) {
    return { outcome: "not_eligible" };
  }

  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("captures")
    .select("storage_path, display_path, thumbnail_path, share_path")
    .eq("event_id", eventId);
  if (error) throw error;

  const rows = data as CaptureStoragePaths[];
  const paths = rows.flatMap((row) =>
    [row.storage_path, row.display_path, row.thumbnail_path, row.share_path].filter(
      (path): path is string => path !== null,
    ),
  );

  await deleteObjects(paths);

  // The event's theme image folder goes with its media (product.md §14, architecture §7a):
  // storage first, like the capture objects, so a rerun after a crash simply finds less to do.
  const themeObjects = await listThemeFolder(eventId);
  await removeThemeObjects(themeObjects);

  const { error: deleteCapturesError, count } = await supabase
    .from("captures")
    .delete({ count: "exact" })
    .eq("event_id", eventId);
  if (deleteCapturesError) throw deleteCapturesError;

  const { error: markDeletedError } = await supabase
    .from("events")
    .update({ media_deleted_at: now.toISOString(), theme_image_path: null })
    .eq("id", eventId)
    .is("media_deleted_at", null);
  if (markDeletedError) throw markDeletedError;

  return {
    outcome: "deleted",
    capturesDeleted: count ?? rows.length,
    objectsDeleted: paths.length + themeObjects.length,
  };
}

/** Events whose grace period has elapsed but whose media hasn't been deleted yet. */
export async function listEventsPendingPermanentDeletion(
  now: Date = new Date(),
): Promise<EventRow[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("events")
    .select()
    .not("grace_until", "is", null)
    .lte("grace_until", now.toISOString())
    .is("media_deleted_at", null);

  if (error) throw error;
  return data as EventRow[];
}

export type LifecycleSweepResult = {
  reservationsExpired: number;
  permanentDeletionsProcessed: number;
  permanentDeletionsSucceeded: number;
  failures: { eventId: string; message: string }[];
};

/**
 * The one scheduled entry point (roadmap Slice 12: "smallest production-suitable
 * mechanism", not an elaborate job platform). Two independent, idempotent steps:
 *
 * 1. A global sweep of abandoned reservations past their TTL — the same lazy expiry
 *    `reserve_capture()` already performs per guest session (architecture §6), applied
 *    globally purely for Operator Console display accuracy (a guest who never returns
 *    otherwise leaves a stale `pending` row until someone else in that session reserves
 *    again). Never load-bearing for the frame-limit invariant, which the per-session lazy
 *    sweep and the unique-index-based slot allocation already guarantee on their own.
 * 2. Permanent deletion for every event whose grace period has elapsed, each processed
 *    independently — one event's failure (a transient storage error, say) is caught and
 *    recorded rather than aborting the sweep, so it never blocks another host's event from
 *    being processed in the same run (roadmap's own safety requirement).
 */
export async function runLifecycleSweep(
  now: Date = new Date(),
): Promise<LifecycleSweepResult> {
  const reservationsExpired = await sweepAbandonedReservations(now);

  const pending = await listEventsPendingPermanentDeletion(now);
  const failures: { eventId: string; message: string }[] = [];
  let succeeded = 0;

  for (const event of pending) {
    try {
      const result = await permanentlyDeleteEventMedia(event.id, now);
      if (result.outcome === "deleted") succeeded += 1;
    } catch (error) {
      failures.push({
        eventId: event.id,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    reservationsExpired,
    permanentDeletionsProcessed: pending.length,
    permanentDeletionsSucceeded: succeeded,
    failures,
  };
}

async function sweepAbandonedReservations(now: Date): Promise<number> {
  const supabase = createServiceClient();
  const { error, count } = await supabase
    .from("captures")
    .update({ status: "expired" }, { count: "exact" })
    .eq("status", "pending")
    .lt("expires_at", now.toISOString());

  if (error) throw error;
  return count ?? 0;
}
