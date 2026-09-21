import "server-only";

import { createServiceClient } from "@/lib/supabase/service-client";
import { canOpenCapture, deriveEventLifecycleState } from "@/lib/events/lifecycle";
import type { EventRow, GalleryVisibility, RevealMode } from "@/lib/db/types";

/**
 * Every function here takes hostId and scopes its query by it. There is no function
 * that loads an event without an ownership predicate (product invariant 9, architecture §5).
 */

export type EventConfigInput = {
  name: string;
  eventDate: string | null;
  timezone: string;
  hostMessage: string | null;
  revealMode: RevealMode;
  revealAt: string | null;
  visibility: GalleryVisibility;
  sharingEnabled: boolean;
  hashtag: string | null;
};

function toRow(input: Partial<EventConfigInput>) {
  const row: Record<string, unknown> = {};
  if (input.name !== undefined) row.name = input.name;
  if (input.eventDate !== undefined) row.event_date = input.eventDate;
  if (input.timezone !== undefined) row.timezone = input.timezone;
  if (input.hostMessage !== undefined) row.host_message = input.hostMessage;
  if (input.revealMode !== undefined) row.reveal_mode = input.revealMode;
  if (input.revealAt !== undefined) row.reveal_at = input.revealAt;
  if (input.visibility !== undefined) row.visibility = input.visibility;
  if (input.sharingEnabled !== undefined)
    row.sharing_enabled = input.sharingEnabled;
  if (input.hashtag !== undefined) row.hashtag = input.hashtag;
  return row;
}

export async function createDraftEvent(
  hostId: string,
  name: string,
): Promise<EventRow> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("events")
    .insert({ host_id: hostId, name })
    .select()
    .single();

  if (error) throw error;
  return data as EventRow;
}

export async function listEventsForHost(hostId: string): Promise<EventRow[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("events")
    .select()
    .eq("host_id", hostId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data as EventRow[];
}

export async function getEventForHost(
  hostId: string,
  eventId: string,
): Promise<EventRow | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("events")
    .select()
    .eq("id", eventId)
    .eq("host_id", hostId)
    .maybeSingle();

  if (error) throw error;
  return data as EventRow | null;
}

/**
 * Guest-facing lookup: the event (capture) token is itself the credential (architecture
 * §5), so there is no host ownership predicate here — possession of the token is the
 * access check. Never used to expose anything beyond what the token is meant to grant.
 */
export async function getEventByToken(token: string): Promise<EventRow | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("events")
    .select()
    .eq("event_token", token)
    .maybeSingle();

  if (error) throw error;
  return data as EventRow | null;
}

/**
 * No ownership predicate — internal use only, by the guest capture path (lib/dal/captures.ts)
 * to re-check the capture gate. Safe because every caller already resolved eventId from a
 * guest_sessions row matched against the signed guest cookie, not from unverified input.
 */
export async function getEventById(eventId: string): Promise<EventRow | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("events")
    .select()
    .eq("id", eventId)
    .maybeSingle();

  if (error) throw error;
  return data as EventRow | null;
}

/**
 * Returns null (rather than throwing) when the event doesn't exist or isn't owned by
 * this host — the WHERE clause below is the ownership check, and callers treat a null
 * result as "not found," never distinguishing "not owned" from "doesn't exist."
 */
export async function updateEventConfig(
  hostId: string,
  eventId: string,
  input: Partial<EventConfigInput>,
): Promise<EventRow | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("events")
    .update(toRow(input))
    .eq("id", eventId)
    .eq("host_id", hostId)
    .select()
    .maybeSingle();

  if (error) throw error;
  return data as EventRow | null;
}

/**
 * Capture open/close control (product.md §7.2, roadmap Slice 4). Re-derives lifecycle
 * state server-side before mutating rather than trusting the caller's idea of it, and
 * refuses to reopen a capture window the automatic safety-net close already ended —
 * "after the automatic close, capture cannot be re-opened" (architecture §4). Returns
 * null for "not found/not owned" and for an invalid transition alike; callers don't need
 * to distinguish them beyond "nothing changed."
 */
export async function openCapture(
  hostId: string,
  eventId: string,
): Promise<EventRow | null> {
  const event = await getEventForHost(hostId, eventId);
  if (!event) return null;

  if (!canOpenCapture(event)) return null;

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("events")
    .update({
      capture_opened_at: event.capture_opened_at ?? new Date().toISOString(),
      capture_closed_at: null,
    })
    .eq("id", eventId)
    .eq("host_id", hostId)
    .select()
    .maybeSingle();

  if (error) throw error;
  return data as EventRow | null;
}

export async function closeCapture(
  hostId: string,
  eventId: string,
): Promise<EventRow | null> {
  const event = await getEventForHost(hostId, eventId);
  if (!event) return null;

  if (deriveEventLifecycleState(event) !== "capture_open") return null;

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("events")
    .update({ capture_closed_at: new Date().toISOString() })
    .eq("id", eventId)
    .eq("host_id", hostId)
    .select()
    .maybeSingle();

  if (error) throw error;
  return data as EventRow | null;
}
