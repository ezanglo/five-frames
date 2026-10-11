import "server-only";

import { createServiceClient } from "@/lib/supabase/service-client";
import {
  canOpenCapture,
  computeSafetyNetClosesAt,
  deriveEventLifecycleState,
} from "@/lib/events/lifecycle";
import { generateLinkToken } from "@/lib/auth/link-tokens";
import type { EventRow, GalleryLayout, GalleryVisibility, RevealMode } from "@/lib/db/types";
import { isGalleryLayout } from "@/lib/gallery/layouts";
import type { PlanId } from "@/lib/plans/registry";
import { isAccentKey } from "@/lib/theme/accents";
import { InvalidHashtagError, normalizeHashtag } from "@/lib/theme/hashtag";

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
  /** Presentation of the revealed gallery only (D22). */
  galleryLayout: GalleryLayout;
  /** Hourly time sections in the revealed gallery (D24). Presentation only. */
  galleryTimeSections: boolean;
  sharingEnabled: boolean;
  hashtag: string | null;
  /** A curated registry key (lib/theme/accents.ts). Theme image changes go through
   *  lib/dal/event-theme.ts, never through here. */
  accentColor: string;
};

export class InvalidAccentError extends Error {
  constructor() {
    super("Choose one of the event colors.");
    this.name = "InvalidAccentError";
  }
}

export class InvalidGalleryLayoutError extends Error {
  constructor() {
    super("Choose Masonry, Rows or Grid.");
    this.name = "InvalidGalleryLayoutError";
  }
}

/**
 * Validates on every write (architecture §7a): the hashtag is normalized (no "#") or refused,
 * the accent must be a curated key, and the gallery layout one of the three (D22). Throws rather
 * than silently dropping a bad value.
 */
function toRow(input: Partial<EventConfigInput>) {
  const row: Record<string, unknown> = {};
  if (input.name !== undefined) row.name = input.name;
  if (input.eventDate !== undefined) row.event_date = input.eventDate;
  if (input.timezone !== undefined) row.timezone = input.timezone;
  if (input.hostMessage !== undefined) row.host_message = input.hostMessage;
  if (input.revealMode !== undefined) row.reveal_mode = input.revealMode;
  if (input.revealAt !== undefined) row.reveal_at = input.revealAt;
  if (input.visibility !== undefined) row.visibility = input.visibility;
  if (input.galleryLayout !== undefined) {
    if (!isGalleryLayout(input.galleryLayout)) throw new InvalidGalleryLayoutError();
    row.gallery_layout = input.galleryLayout;
  }
  if (input.galleryTimeSections !== undefined) {
    if (typeof input.galleryTimeSections !== "boolean") throw new TypeError("galleryTimeSections must be a boolean");
    row.gallery_time_sections = input.galleryTimeSections;
  }
  if (input.sharingEnabled !== undefined)
    row.sharing_enabled = input.sharingEnabled;
  if (input.hashtag !== undefined) {
    const hashtag = normalizeHashtag(input.hashtag);
    if (!hashtag.ok) throw new InvalidHashtagError(hashtag.reason);
    row.hashtag = hashtag.value;
  }
  if (input.accentColor !== undefined) {
    if (!isAccentKey(input.accentColor)) throw new InvalidAccentError();
    row.accent_color = input.accentColor;
  }
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
 * Gallery-viewer-facing lookup (roadmap Slice 5): the gallery token is itself the
 * credential for "anyone with the link" visibility (architecture §5), so there is no host
 * ownership predicate here, same reasoning as `getEventByToken`. The caller is still
 * responsible for checking reveal timing and visibility before showing anything — this
 * function only resolves the token to an event, it does not decide access.
 */
export async function getEventByGalleryToken(token: string): Promise<EventRow | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("events")
    .select()
    .eq("gallery_token", token)
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
 * The host's plan choice while Draft (product.md §7.2, §15.3, D24). Ownership-scoped, and
 * refused once the event is activated (`activated_at IS NULL` in the same statement), so a
 * plan is fixed from activation on, exactly as product.md says. Free is a choice only while the
 * account hasn't claimed its Free event, checked in the same statement (`choose_free_plan()`).
 * Choosing Free activates nothing: that is `activateFreeEvent`. Returns null for "not found /
 * not owned / already activated / Free already used" alike.
 */
export async function setEventPlan(
  hostId: string,
  eventId: string,
  plan: PlanId,
): Promise<EventRow | null> {
  const supabase = createServiceClient();
  if (plan === "free") {
    const { data, error } = await supabase
      .rpc("choose_free_plan", { p_host_id: hostId, p_event_id: eventId })
      .maybeSingle<EventRow>();
    if (error) throw error;
    return data;
  }

  const { data, error } = await supabase
    .from("events")
    .update({ plan })
    .eq("id", eventId)
    .eq("host_id", hostId)
    .is("activated_at", null)
    .select()
    .maybeSingle();

  if (error) throw error;
  return data as EventRow | null;
}

/**
 * Whether this host account can still activate its one Free event (product.md §7.2). The claim
 * on `hosts` is permanent, so this never turns true again once false: deleting, expiring or
 * abandoning the Free event doesn't return it.
 */
export async function isFreeEventAvailable(hostId: string): Promise<boolean> {
  const { data, error } = await createServiceClient()
    .from("hosts")
    .select("free_event_claimed_at")
    .eq("id", hostId)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data) && data!.free_event_claimed_at === null;
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

  const now = new Date();
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("events")
    .update({
      capture_opened_at: event.capture_opened_at ?? now.toISOString(),
      capture_closed_at: null,
      // Computed once, on first open, and held fixed thereafter (product.md §7.3):
      // reopening capture must never push the safety-net deadline back out.
      safety_net_closes_at:
        event.safety_net_closes_at ?? computeSafetyNetClosesAt(event, now),
    })
    .eq("id", eventId)
    .eq("host_id", hostId)
    .select()
    .maybeSingle();

  if (error) throw error;
  return data as EventRow | null;
}

type LinkKind = "event_token" | "gallery_token";

/**
 * Rotate or revoke either link (product.md §8.1/§11.1, roadmap Slice 5). Gated on
 * `activated_at`: tokens only ever exist post-payment (invariant 7), so rotating or
 * revoking before activation would be meaningless and is refused rather than silently
 * minting a token an unpaid event isn't allowed to have. Rotation immediately invalidates
 * the old URL, since every lookup is by exact token match (architecture §5) — there is
 * nothing else to invalidate.
 */
async function setLinkToken(
  hostId: string,
  eventId: string,
  column: LinkKind,
  value: string | null,
): Promise<EventRow | null> {
  const event = await getEventForHost(hostId, eventId);
  if (!event || !event.activated_at) return null;

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("events")
    .update({ [column]: value })
    .eq("id", eventId)
    .eq("host_id", hostId)
    .select()
    .maybeSingle();

  if (error) throw error;
  return data as EventRow | null;
}

export function rotateEventToken(hostId: string, eventId: string) {
  return setLinkToken(hostId, eventId, "event_token", generateLinkToken());
}

export function revokeEventToken(hostId: string, eventId: string) {
  return setLinkToken(hostId, eventId, "event_token", null);
}

export function rotateGalleryToken(hostId: string, eventId: string) {
  return setLinkToken(hostId, eventId, "gallery_token", generateLinkToken());
}

export function revokeGalleryToken(hostId: string, eventId: string) {
  return setLinkToken(hostId, eventId, "gallery_token", null);
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
