import "server-only";

import { createServiceClient } from "@/lib/supabase/service-client";
import type { GuestSessionRow } from "@/lib/db/types";

/**
 * Every function here takes eventId and scopes its query by it, mirroring the ownership
 * discipline in lib/dal/events.ts — a guest session id is only meaningful within the one
 * event it belongs to.
 */

export async function createGuestSession(
  eventId: string,
  displayName: string,
): Promise<GuestSessionRow> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("guest_sessions")
    .insert({ event_id: eventId, display_name: displayName })
    .select()
    .single();

  if (error) throw error;
  return data as GuestSessionRow;
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
