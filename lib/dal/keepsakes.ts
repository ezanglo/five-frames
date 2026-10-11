import "server-only";

import { createServiceClient } from "@/lib/supabase/service-client";
import { getEventByToken } from "@/lib/dal/events";
import { getGuestSession } from "@/lib/dal/guest-sessions";
import { getEventAccessFor, type EventRole } from "@/lib/dal/event-access";
import { logSupportAccess } from "@/lib/dal/support-actions";
import { deriveEventLifecycleState, isCaptureOpen } from "@/lib/events/lifecycle";
import { downloadCaptureObject } from "@/lib/media/storage";
import { readThemeImageBytes } from "@/lib/dal/event-theme";
import { keepsakeFilename } from "@/lib/keepsakes/filename";
import { renderFullSetKeepsakeJpeg, renderSingleKeepsakeJpeg } from "@/lib/keepsakes/render";
import {
  isFullSetStyleId,
  isSingleStyleId,
  isStyleAllowed,
  type FullSetStyleId,
  type SingleStyleId,
} from "@/lib/keepsakes/styles";
import { eventPlanFeatures } from "@/lib/plans/registry";
import type { CaptureRow, EventRow } from "@/lib/db/types";

/**
 * Keepsakes — the one sharing system (product.md §10.2–§10.3, architecture §7b, D19/D20). Every
 * request is authorized here, fresh, in this order:
 *
 * 1. guest event access: the current event token resolves to an activated event that isn't
 *    archived or media-deleted. This is NOT the capture gate — keepsakes work before, during and
 *    after capture is open, and after hosted access expires for as long as the guest's own photos
 *    are still there (`isCaptureOpen` belongs only to reserve and commit);
 * 2. the signed guest cookie's session exists for this event;
 * 3. the style id belongs to this route's family, and the event's plan offers it (a Free event
 *    has only each family's preselected style, product.md §15.3.1);
 * 4. the host's sharing setting is on (the only refusal that isn't a generic not-found);
 * 5. the sources: for a Single-photo keepsake, the capture is the session's own, committed, not
 *    hidden, not deleted, with a display derivative; for a Full Set, `getFullSetSources` derives
 *    the session's five from the database — the client never names them.
 *
 * The render then re-confirms the event and the source rows before any byte is returned, so a
 * hide or a sharing change that lands mid-render yields not-found. Nothing here writes: no row,
 * no object, no frame. Gallery reveal and visibility are never read, so a keepsake can't open the
 * gallery before or after reveal.
 */

export type KeepsakeOutcome =
  | { kind: "ok"; bytes: Buffer; filename: string }
  | { kind: "not_found" }
  | { kind: "sharing_disabled" }
  | { kind: "render_failed" };

type Access = { event: EventRow; guestSessionId: string };

/** Checks 1 and 2. Null for anything that must look like not-found. */
export async function resolveGuestKeepsakeAccess(
  token: string,
  guestSessionId: string | null,
): Promise<Access | null> {
  if (!token || !guestSessionId) return null;
  const event = await getEventByToken(token);
  if (!event || !isKeepsakeEventReachable(event)) return null;
  const session = await getGuestSession(event.id, guestSessionId);
  if (!session) return null;
  return { event, guestSessionId };
}

/**
 * Guest event access for keepsakes: activated, not archived, media not deleted. An expired event
 * still qualifies: the guest's own view and original downloads stay until the media is deleted,
 * so the keepsakes made from them do too.
 */
export function isKeepsakeEventReachable(event: EventRow, now: Date = new Date()): boolean {
  if (!event.activated_at || !event.event_token || event.media_deleted_at) return false;
  return deriveEventLifecycleState(event, now) !== "archived";
}

function isEligibleSource(capture: CaptureRow): boolean {
  return (
    capture.status === "committed" &&
    !capture.hidden_at &&
    !capture.deleted_at &&
    Boolean(capture.display_path)
  );
}

/** Check 5 for a Single-photo keepsake: the capture, scoped by id + session + event. */
export async function getSingleKeepsakeSource(
  eventId: string,
  guestSessionId: string,
  captureId: string,
): Promise<CaptureRow | null> {
  if (!/^[0-9a-f-]{36}$/i.test(captureId)) return null;
  const { data, error } = await createServiceClient()
    .from("captures")
    .select()
    .eq("id", captureId)
    .eq("guest_session_id", guestSessionId)
    .eq("event_id", eventId)
    .maybeSingle();
  if (error) throw error;
  const capture = data as CaptureRow | null;
  return capture && isEligibleSource(capture) ? capture : null;
}

/**
 * The re-confirm before responding: the event still grants access with sharing on, and every
 * source capture is still the session's own, committed, unhidden and undeleted.
 */
export async function reconfirmKeepsakeSources(
  token: string,
  eventId: string,
  guestSessionId: string,
  captureIds: readonly string[],
): Promise<"ok" | "not_found" | "sharing_disabled"> {
  const supabase = createServiceClient();
  const [event, rows] = await Promise.all([
    getEventByToken(token),
    supabase
      .from("captures")
      .select("id", { count: "exact", head: true })
      .in("id", [...captureIds])
      .eq("guest_session_id", guestSessionId)
      .eq("event_id", eventId)
      .eq("status", "committed")
      .is("hidden_at", null)
      .is("deleted_at", null),
  ]);
  if (rows.error) throw rows.error;
  if (!event || event.id !== eventId || !isKeepsakeEventReachable(event)) return "not_found";
  if ((rows.count ?? 0) !== captureIds.length) return "not_found";
  if (!event.sharing_enabled) return "sharing_disabled";
  return "ok";
}

/** Only the fields a keepsake may show; the rest of the row never reaches the renderer. */
function keepsakeEventSource(event: EventRow) {
  return {
    name: event.name,
    event_date: event.event_date,
    hashtag: event.hashtag,
    accent_color: event.accent_color,
  };
}

/**
 * One structured log line per render (architecture §12 "Observability"; §7b asks the pilot to
 * record renders per family and their cost): family, style, duration, output size and the
 * process's sampled peak RSS. No guest, capture or event identifier is logged.
 */
async function measured<T extends KeepsakeOutcome>(family: "single" | "fullSet", style: string, run: () => Promise<T>): Promise<T> {
  const started = performance.now();
  let peak = process.memoryUsage().rss;
  const sampler = setInterval(() => {
    peak = Math.max(peak, process.memoryUsage().rss);
  }, 20);
  sampler.unref?.();
  try {
    const outcome = await run();
    peak = Math.max(peak, process.memoryUsage().rss);
    console.info(
      JSON.stringify({
        event: "keepsake.render",
        family,
        style,
        outcome: outcome.kind,
        ms: Math.round(performance.now() - started),
        kb: outcome.kind === "ok" ? Math.round(outcome.bytes.length / 1024) : null,
        rssPeakMb: Math.round(peak / 1048576),
      }),
    );
    return outcome;
  } finally {
    clearInterval(sampler);
  }
}

type RenderHooks = {
  /** Test seam: runs after the render and before the re-confirm. */
  afterRender?: () => Promise<void>;
};

/** `GET /e/[token]/keepsake/photo/[captureId]/[styleId]` */
export async function makeSingleKeepsake(
  token: string,
  guestSessionId: string | null,
  captureId: string,
  styleId: string,
  hooks: RenderHooks = {},
): Promise<KeepsakeOutcome> {
  const access = await resolveGuestKeepsakeAccess(token, guestSessionId);
  if (!access) return { kind: "not_found" };
  if (!isSingleStyleId(styleId) || !isStyleAllowed(styleId, eventPlanFeatures(access.event))) {
    return { kind: "not_found" };
  }
  if (!access.event.sharing_enabled) return { kind: "sharing_disabled" };

  const capture = await getSingleKeepsakeSource(access.event.id, access.guestSessionId, captureId);
  if (!capture) return { kind: "not_found" };
  return measured("single", styleId, () => renderAndConfirmSingle(token, access, capture, styleId, hooks));
}

async function renderAndConfirmSingle(
  token: string,
  access: Access,
  capture: CaptureRow,
  styleId: SingleStyleId,
  hooks: RenderHooks,
): Promise<KeepsakeOutcome> {
  let bytes: Buffer;
  try {
    const [photo, themeImage] = await Promise.all([
      downloadCaptureObject(capture.display_path!),
      readThemeImageBytes(access.event),
    ]);
    if (!photo) return { kind: "render_failed" };
    bytes = await renderSingleKeepsakeJpeg({
      event: keepsakeEventSource(access.event),
      style: styleId,
      photo,
      message: capture.message,
      themeImage,
    });
  } catch (error) {
    console.error("keepsake: single render failed", error);
    return { kind: "render_failed" };
  }

  await hooks.afterRender?.();
  const confirmed = await reconfirmKeepsakeSources(
    token,
    access.event.id,
    access.guestSessionId,
    [capture.id],
  );
  if (confirmed !== "ok") return { kind: confirmed };

  return { kind: "ok", bytes, filename: keepsakeFilename(access.event.name, styleId) };
}

// ------------------------------------------------------------------------------------ Full Set

export type FullSetSources =
  | { kind: "eligible"; captures: readonly [CaptureRow, CaptureRow, CaptureRow, CaptureRow, CaptureRow] }
  | { kind: "unavailable" };

/**
 * The ONLY way to obtain a Full Set's photos (architecture §7b, D20). Selects every committed
 * capture of this session in this event — hidden and deleted rows included, so moderation decides
 * eligibility instead of letting another row slip in — in `(committed_at, slot_index)` order.
 * Eligible only with exactly five rows, all unhidden, undeleted, with a display derivative. There
 * is no partial result: nothing downstream can build a four-photo set or fill a gap. A deletion
 * makes the set permanently unavailable (the row keeps its slot forever); a hide, until unhidden.
 */
export async function getFullSetSources(eventId: string, guestSessionId: string): Promise<FullSetSources> {
  return fullSetFrom(await listSessionCommittedRows(eventId, guestSessionId));
}

/** Every committed row of one session, hidden and deleted included, in canonical order. */
async function listSessionCommittedRows(eventId: string, guestSessionId: string): Promise<CaptureRow[]> {
  const { data, error } = await createServiceClient()
    .from("captures")
    .select()
    .eq("event_id", eventId)
    .eq("guest_session_id", guestSessionId)
    .eq("status", "committed")
    .order("committed_at", { ascending: true })
    .order("slot_index", { ascending: true });
  if (error) throw error;
  return data as CaptureRow[];
}

/** The eligibility rule itself, over one session's committed rows in canonical order. */
function fullSetFrom(rows: readonly CaptureRow[]): FullSetSources {
  if (rows.length !== 5 || !rows.every(isEligibleSource)) return { kind: "unavailable" };
  return { kind: "eligible", captures: rows as unknown as [CaptureRow, CaptureRow, CaptureRow, CaptureRow, CaptureRow] };
}

/**
 * Whether the guest's own view may show a preview-only Full Set with the photos kept so far
 * (decision D29). Only while capture is open and the session can still reach five: fewer than
 * five committed rows and none deleted (a deletion never returns its frame). The preview is
 * drawn in the browser from photos the guest already holds; there is no route that exports one,
 * so nothing here ever authorizes a partial Full Set.
 */
export async function isFullSetPreviewable(event: EventRow, guestSessionId: string): Promise<boolean> {
  if (!event.sharing_enabled || !isKeepsakeEventReachable(event) || !isCaptureOpen(event)) return false;
  const rows = await listSessionCommittedRows(event.id, guestSessionId);
  // Zero rows qualifies: the page isn't refreshed after each commit, so the flag must already
  // be on when the first photo lands. The picker needs at least one photo to show anything.
  return rows.length < 5 && rows.every((row) => !row.deleted_at);
}

/**
 * The guest page's availability flag: the same derivation the route authorizes with, plus the
 * sharing setting and event access, so the page and the route can't disagree. Returns the five
 * capture ids in canonical order (for the DOM previews), or null when the Full Set is absent.
 */
export async function getFullSetAvailability(
  event: EventRow,
  guestSessionId: string,
): Promise<readonly string[] | null> {
  if (!event.sharing_enabled || !isKeepsakeEventReachable(event)) return null;
  const sources = await getFullSetSources(event.id, guestSessionId);
  return sources.kind === "eligible" ? sources.captures.map((c) => c.id) : null;
}

/** `GET /e/[token]/keepsake/set/[styleId]` — no capture ids and no session id in the request. */
export async function makeFullSetKeepsake(
  token: string,
  guestSessionId: string | null,
  styleId: string,
  hooks: RenderHooks = {},
): Promise<KeepsakeOutcome> {
  const access = await resolveGuestKeepsakeAccess(token, guestSessionId);
  if (!access) return { kind: "not_found" };
  if (!isFullSetStyleId(styleId) || !isStyleAllowed(styleId, eventPlanFeatures(access.event))) {
    return { kind: "not_found" };
  }
  if (!access.event.sharing_enabled) return { kind: "sharing_disabled" };

  const sources = await getFullSetSources(access.event.id, access.guestSessionId);
  if (sources.kind !== "eligible") return { kind: "not_found" };
  return measured("fullSet", styleId, () => renderAndConfirmFullSet(token, access, sources.captures, styleId, hooks));
}

async function renderAndConfirmFullSet(
  token: string,
  access: Access,
  captures: readonly CaptureRow[],
  styleId: FullSetStyleId,
  hooks: RenderHooks,
): Promise<KeepsakeOutcome> {
  let bytes: Buffer;
  try {
    bytes = await renderFullSetFrom(access.event, captures, styleId);
  } catch (error) {
    console.error("keepsake: full set render failed", error);
    return { kind: "render_failed" };
  }

  await hooks.afterRender?.();
  const confirmed = await reconfirmKeepsakeSources(
    token,
    access.event.id,
    access.guestSessionId,
    captures.map((c) => c.id),
  );
  if (confirmed !== "ok") return { kind: confirmed };

  return { kind: "ok", bytes, filename: keepsakeFilename(access.event.name, styleId) };
}

/**
 * Renders one Full Set from already-authorized sources. A missing source throws, which callers
 * report as a retryable failure — never a partial or substituted Full Set.
 */
async function renderFullSetFrom(
  event: EventRow,
  captures: readonly CaptureRow[],
  styleId: FullSetStyleId,
): Promise<Buffer> {
  const [themeImage, ...photos] = await Promise.all([
    readThemeImageBytes(event),
    ...captures.map((c) => downloadCaptureObject(c.display_path!)),
  ]);
  if (photos.some((p) => !p)) throw new Error("A Full Set source image is missing");
  return renderFullSetKeepsakeJpeg({
    event: keepsakeEventSource(event),
    style: styleId,
    photos: photos as Buffer[],
    themeImage,
  });
}

// ------------------------------------------------------------------------------- Host Full Set

/**
 * The host's Full Set keepsakes (decision D29). Admits: owner, support (D30). Support's keepsake
 * is logged (`keepsake_made`, one per guest session per 30 minutes) before it renders, so a
 * failed log write renders nothing. A host Full Set is
 * one guest session's set, chosen by session, built by the same `getFullSetSources` rule as the
 * guest's own: exactly five committed, unhidden, undeleted captures in canonical order. The host
 * never names captures, and a set never mixes guests. The guest sharing setting doesn't apply
 * (it governs what guests can do); the plan's style entitlement does.
 */
type HostAccess = { event: EventRow; role: EventRole };

async function resolveHostKeepsakeAccess(userId: string, eventId: string): Promise<HostAccess | null> {
  const access = await getEventAccessFor(userId, eventId, ["owner", "support"]);
  if (!access) return null;
  const event = access.event;
  if (!event.activated_at || event.media_deleted_at) return null;
  if (deriveEventLifecycleState(event) === "archived") return null;
  return { event, role: access.role };
}

/**
 * The guest sessions on this event whose Full Set is available, each with its five capture ids in
 * canonical order, for the Photos tab. Owner or support; null when not admitted.
 */
export async function listHostFullSets(
  userId: string,
  eventId: string,
): Promise<Record<string, readonly string[]> | null> {
  const access = await resolveHostKeepsakeAccess(userId, eventId);
  if (!access) return null;
  const { data, error } = await createServiceClient()
    .from("captures")
    .select()
    .eq("event_id", access.event.id)
    .eq("status", "committed")
    .order("committed_at", { ascending: true })
    .order("slot_index", { ascending: true });
  if (error) throw error;

  const bySession = new Map<string, CaptureRow[]>();
  for (const row of data as CaptureRow[]) {
    const list = bySession.get(row.guest_session_id) ?? [];
    list.push(row);
    bySession.set(row.guest_session_id, list);
  }
  const sets: Record<string, readonly string[]> = {};
  for (const [sessionId, rows] of bySession) {
    const sources = fullSetFrom(rows);
    if (sources.kind === "eligible") sets[sessionId] = sources.captures.map((c) => c.id);
  }
  return sets;
}

/** `GET /events/[eventId]/keepsake/[guestSessionId]/[styleId]` — owner or support (logged). */
export async function makeHostFullSetKeepsake(
  userId: string,
  eventId: string,
  guestSessionId: string,
  styleId: string,
  hooks: RenderHooks = {},
): Promise<KeepsakeOutcome> {
  if (!/^[0-9a-f-]{36}$/i.test(guestSessionId)) return { kind: "not_found" };
  const access = await resolveHostKeepsakeAccess(userId, eventId);
  if (!access) return { kind: "not_found" };
  if (!isFullSetStyleId(styleId) || !isStyleAllowed(styleId, eventPlanFeatures(access.event))) {
    return { kind: "not_found" };
  }
  const sources = await getFullSetSources(access.event.id, guestSessionId);
  if (sources.kind !== "eligible") return { kind: "not_found" };
  if (access.role === "support") {
    await logSupportAccess(userId, access.event.id, "keepsake_made", { guest_session_id: guestSessionId, style: styleId });
  }

  return measured("fullSet", styleId, async () => {
    let bytes: Buffer;
    try {
      bytes = await renderFullSetFrom(access.event, sources.captures, styleId);
    } catch (error) {
      console.error("keepsake: host full set render failed", error);
      return { kind: "render_failed" };
    }
    await hooks.afterRender?.();
    // Re-confirm: still the owner, and the same five are still the session's eligible set.
    const [again, now] = await Promise.all([
      resolveHostKeepsakeAccess(userId, eventId),
      getFullSetSources(access.event.id, guestSessionId),
    ]);
    if (!again || now.kind !== "eligible") return { kind: "not_found" };
    if (now.captures.some((c, i) => c.id !== sources.captures[i].id)) return { kind: "not_found" };
    return { kind: "ok", bytes, filename: keepsakeFilename(access.event.name, styleId) };
  });
}
