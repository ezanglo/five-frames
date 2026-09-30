import "server-only";

import { createServiceClient } from "@/lib/supabase/service-client";
import { getEventByToken } from "@/lib/dal/events";
import { getGuestSession } from "@/lib/dal/guest-sessions";
import { deriveEventLifecycleState } from "@/lib/events/lifecycle";
import { downloadCaptureObject } from "@/lib/media/storage";
import { downloadThemeObject } from "@/lib/media/theme-storage";
import { keepsakeFilename } from "@/lib/keepsakes/filename";
import { renderFullSetKeepsakeJpeg, renderSingleKeepsakeJpeg } from "@/lib/keepsakes/render";
import { isFullSetStyleId, isSingleStyleId, type FullSetStyleId, type SingleStyleId } from "@/lib/keepsakes/styles";
import type { CaptureRow, EventRow } from "@/lib/db/types";

/**
 * Keepsakes — the one sharing system (product.md §10.2–§10.3, architecture §7b, D19/D20). Every
 * request is authorized here, fresh, in this order:
 *
 * 1. guest event access: the current event token resolves to an activated event that isn't
 *    expired, archived or media-deleted. This is NOT the capture gate — keepsakes work before,
 *    during and after capture is open (`isCaptureOpen` belongs only to reserve and commit);
 * 2. the signed guest cookie's session exists for this event;
 * 3. the style id belongs to this route's family;
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

/** Guest event access for keepsakes: activated, not expired/archived, media not deleted. */
export function isKeepsakeEventReachable(event: EventRow, now: Date = new Date()): boolean {
  if (!event.activated_at || !event.event_token || event.media_deleted_at) return false;
  const state = deriveEventLifecycleState(event, now);
  return state !== "expired" && state !== "archived";
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

// Theme image bytes, per server instance. Paths are immutable (each upload gets a new UUID),
// so this needs no invalidation; it is bounded so a long-lived instance can't grow without end.
const themeCache = new Map<string, Promise<Buffer | null>>();
const THEME_CACHE_LIMIT = 16;

function themeImageBytes(event: EventRow): Promise<Buffer | null> {
  const path = event.theme_image_path;
  if (!path) return Promise.resolve(null);
  let cached = themeCache.get(path);
  if (!cached) {
    cached = downloadThemeObject(path).catch((error) => {
      console.warn("keepsake: theme image unavailable", error);
      themeCache.delete(path);
      return null;
    });
    if (themeCache.size >= THEME_CACHE_LIMIT) themeCache.delete(themeCache.keys().next().value!);
    themeCache.set(path, cached);
  }
  return cached;
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
  if (!isSingleStyleId(styleId)) return { kind: "not_found" };
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
      themeImageBytes(access.event),
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
  const { data, error } = await createServiceClient()
    .from("captures")
    .select()
    .eq("event_id", eventId)
    .eq("guest_session_id", guestSessionId)
    .eq("status", "committed")
    .order("committed_at", { ascending: true })
    .order("slot_index", { ascending: true });
  if (error) throw error;
  const rows = data as CaptureRow[];
  if (rows.length !== 5 || !rows.every(isEligibleSource)) return { kind: "unavailable" };
  return { kind: "eligible", captures: rows as unknown as [CaptureRow, CaptureRow, CaptureRow, CaptureRow, CaptureRow] };
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
  if (!isFullSetStyleId(styleId)) return { kind: "not_found" };
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
    const [themeImage, ...photos] = await Promise.all([
      themeImageBytes(access.event),
      ...captures.map((c) => downloadCaptureObject(c.display_path!)),
    ]);
    // A missing source is a retryable failure — never a partial or substituted Full Set.
    if (photos.some((p) => !p)) return { kind: "render_failed" };
    bytes = await renderFullSetKeepsakeJpeg({
      event: keepsakeEventSource(access.event),
      style: styleId,
      photos: photos as Buffer[],
      themeImage,
    });
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
