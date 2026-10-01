import "server-only";

import { createHash } from "node:crypto";
import { createServiceClient } from "@/lib/supabase/service-client";
import { getEventForHost } from "@/lib/dal/events";
import {
  canOpenCapture,
  deriveEventLifecycleState,
  isGalleryRevealed,
} from "@/lib/events/lifecycle";

/**
 * An opaque fingerprint of what the host dashboard shows (decision D21, architecture §9). It
 * changes when a guest joins, a photo is committed, hidden, unhidden, deleted or favorited,
 * the event row changes (activation, capture open/close, settings, links), or a time-derived
 * state flips with no write at all (safety-net close, custom reveal time).
 *
 * The live stream sends only this hash, never the values behind it: it is an invalidation
 * signal, and the page re-reads everything authoritatively. Ownership is re-checked on every
 * call, so it returns null for an event the host doesn't own, and a stream stops if that
 * changes.
 */
export async function getDashboardVersion(
  hostId: string,
  eventId: string,
  now: Date = new Date(),
): Promise<string | null> {
  const event = await getEventForHost(hostId, eventId);
  if (!event) return null;

  const supabase = createServiceClient();
  const visible = () =>
    supabase
      .from("captures")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId)
      .eq("status", "committed")
      .is("deleted_at", null);
  const [committed, hidden, favorited] = await Promise.all([
    visible(),
    visible().not("hidden_at", "is", null),
    visible().not("favorited_at", "is", null),
  ]);
  if (committed.error) throw committed.error;
  if (hidden.error) throw hidden.error;
  if (favorited.error) throw favorited.error;

  // `updated_at` moves on every events write, including each guest join (the D13 counter).
  const fingerprint = JSON.stringify([
    event.updated_at,
    event.guest_session_count,
    deriveEventLifecycleState(event, now),
    isGalleryRevealed(event, now),
    canOpenCapture(event, now),
    committed.count ?? 0,
    hidden.count ?? 0,
    favorited.count ?? 0,
  ]);
  return createHash("sha256").update(fingerprint).digest("base64url").slice(0, 16);
}
