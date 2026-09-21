import "server-only";

import { createServiceClient } from "@/lib/supabase/service-client";
import type { GuestSessionRow } from "@/lib/db/types";

/**
 * Every function here takes eventId and scopes its query by it, mirroring the ownership
 * discipline in lib/dal/events.ts — a guest session id is only meaningful within the one
 * event it belongs to.
 */

export type JoinGuestSessionOutcome =
  | { kind: "joined"; session: GuestSessionRow }
  | { kind: "at_capacity" };

/**
 * Joins a guest session, enforcing the event's guest-session cap atomically (product.md
 * §9.5, decision D13) via the `join_guest_session()` database function — a single
 * `UPDATE ... WHERE guest_session_count < guest_session_cap` acts as both lock and guard,
 * mirroring `reserve_capture()`'s pattern for frames (D5/D6), so two concurrent joins racing
 * the last slot cannot both succeed.
 */
export async function createGuestSession(
  eventId: string,
  displayName: string,
): Promise<JoinGuestSessionOutcome> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .rpc("join_guest_session", {
      p_event_id: eventId,
      p_display_name: displayName,
    })
    .single();

  if (error) {
    if (error.code === "P0003") return { kind: "at_capacity" };
    throw error;
  }

  return { kind: "joined", session: data as GuestSessionRow };
}

export async function getGuestSession(
  eventId: string,
  guestSessionId: string,
): Promise<GuestSessionRow | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("guest_sessions")
    .select()
    .eq("id", guestSessionId)
    .eq("event_id", eventId)
    .maybeSingle();

  if (error) throw error;
  return data as GuestSessionRow | null;
}

export async function touchGuestSession(
  eventId: string,
  guestSessionId: string,
): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("guest_sessions")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", guestSessionId)
    .eq("event_id", eventId);

  if (error) throw error;
}
