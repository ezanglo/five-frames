"use server";

import { redirect, notFound } from "next/navigation";
import { requireHost } from "@/lib/auth/host-session";
import {
  closeCapture,
  createDraftEvent,
  getEventForHost,
  openCapture,
  revokeEventToken,
  revokeGalleryToken,
  rotateEventToken,
  rotateGalleryToken,
  updateEventConfig,
  type EventConfigInput,
} from "@/lib/dal/events";
import {
  listOriginalDownloadUrlsForEventHost,
  moderateCapture,
  type ModerationAction,
} from "@/lib/dal/captures";
import { startProviderCheckout } from "@/lib/dal/payments";
import type { GalleryVisibility, RevealMode } from "@/lib/db/types";
import { zonedDateTimeLocalToUtcIso } from "@/lib/events/timezone";
import { getRequestBaseUrl } from "@/lib/http/base-url";

const REVEAL_MODES: RevealMode[] = ["after_event", "immediate", "custom"];
const VISIBILITIES: GalleryVisibility[] = ["anyone_with_link", "only_me"];
const VALID_TIME_ZONES = new Set(Intl.supportedValuesOf("timeZone"));

export type EventFormState = { error: string | null };

function field(formData: FormData, key: string): string | null {
  const value = formData.get(key);
  if (typeof value !== "string" || value.trim() === "") return null;
  return value.trim();
}

/** Event details (Create · Details, Settings · Event details): name, date, timezone. */
function parseDetails(formData: FormData): Pick<EventConfigInput, "name" | "eventDate" | "timezone"> | null {
  const name = field(formData, "name");
  if (!name) return null;
  const timezoneRaw = field(formData, "timezone") ?? "Asia/Manila";
  return {
    name: name.slice(0, 120),
    eventDate: field(formData, "eventDate"),
    timezone: VALID_TIME_ZONES.has(timezoneRaw) ? timezoneRaw : "Asia/Manila",
  };
}

/** Welcome, gallery and sharing (Create · Look, Settings). */
function parseLook(
  formData: FormData,
  timezone: string,
): Omit<EventConfigInput, "name" | "eventDate" | "timezone"> {
  const revealModeRaw = field(formData, "revealMode") ?? "after_event";
  const revealMode = REVEAL_MODES.includes(revealModeRaw as RevealMode)
    ? (revealModeRaw as RevealMode)
    : "after_event";

  const visibilityRaw = field(formData, "visibility") ?? "anyone_with_link";
  const visibility = VISIBILITIES.includes(visibilityRaw as GalleryVisibility)
    ? (visibilityRaw as GalleryVisibility)
    : "anyone_with_link";

  const revealAtLocal = field(formData, "revealAt");

  return {
    hostMessage: field(formData, "hostMessage"),
    revealMode,
    // Interpreted as wall-clock time in the event's own timezone, not the server
    // process's timezone — a bare `new Date(revealAtLocal)` would silently use the
    // latter and store the wrong instant.
    revealAt:
      revealMode === "custom" && revealAtLocal
        ? zonedDateTimeLocalToUtcIso(revealAtLocal, timezone)
        : null,
    visibility,
    sharingEnabled: formData.get("sharingEnabled") === "on",
    hashtag: field(formData, "hashtag"),
  };
}

/** Create · Details for a new event: creates the draft, then continues to Look. */
export async function createEventAction(
  _prev: EventFormState,
  formData: FormData,
): Promise<EventFormState> {
  const host = await requireHost();
  const details = parseDetails(formData);
  if (!details) return { error: "Give your event a name." };

  const draft = await createDraftEvent(host.id, details.name);
  await updateEventConfig(host.id, draft.id, details);
  redirect(`/events/${draft.id}/setup?step=look`);
}

/** Create · Details for an existing draft. */
export async function saveDetailsStepAction(
  eventId: string,
  _prev: EventFormState,
  formData: FormData,
): Promise<EventFormState> {
  const host = await requireHost();
  const details = parseDetails(formData);
  if (!details) return { error: "Give your event a name." };

  const updated = await updateEventConfig(host.id, eventId, details);
  if (!updated) notFound();
  redirect(`/events/${eventId}/setup?step=look`);
}

/** Create · Look: welcome message, hashtag, reveal timing, visibility, sharing. */
export async function saveLookStepAction(
  eventId: string,
  _prev: EventFormState,
  formData: FormData,
): Promise<EventFormState> {
  const host = await requireHost();
  const event = await getEventForHost(host.id, eventId);
  if (!event) notFound();

  const updated = await updateEventConfig(host.id, eventId, parseLook(formData, event.timezone));
  if (!updated) notFound();
  redirect(`/events/${eventId}/setup?step=share`);
}

/** Settings tab: every editable field in one save. */
export async function updateEvent(eventId: string, formData: FormData) {
  const host = await requireHost();

  const details = parseDetails(formData);
  if (!details) {
    throw new Error("Event name is required.");
  }

  const input: Partial<EventConfigInput> = {
    ...details,
    ...parseLook(formData, details.timezone),
  };

  const updated = await updateEventConfig(host.id, eventId, input);
  if (!updated) {
    notFound();
  }

  redirect(`/events/${eventId}/settings?saved=1`);
}

/**
 * "Reveal gallery" on the dashboard. Not a new capability: it sets the same reveal timing the
 * host can already choose in Settings ("Immediately", product.md §7.4). Reveal still requires
 * activation, and visibility still governs who the gallery link admits.
 */
export async function revealGalleryNowAction(eventId: string) {
  const host = await requireHost();
  const updated = await updateEventConfig(host.id, eventId, {
    revealMode: "immediate",
    revealAt: null,
  });
  if (!updated) notFound();
  redirect(`/events/${eventId}`);
}

/** Bound to the checkout confirmation page's "Continue to payment" button (product.md
 *  §7.2). Redirects the host's browser to PayMongo's hosted checkout; activation itself
 *  only happens later, via the signed webhook (architecture §8), never here. */
export async function startCheckoutAction(eventId: string) {
  const host = await requireHost();
  const baseUrl = await getRequestBaseUrl();

  const session = await startProviderCheckout(host.id, eventId, baseUrl);
  if (!session) {
    notFound();
  }

  redirect(session.checkoutUrl);
}

export async function openCaptureAction(eventId: string) {
  const host = await requireHost();
  await openCapture(host.id, eventId);
  redirect(`/events/${eventId}`);
}

export async function closeCaptureAction(eventId: string) {
  const host = await requireHost();
  await closeCapture(host.id, eventId);
  redirect(`/events/${eventId}`);
}

/** Bound to a moderation button; no redirect, so the same route's server components
 *  just re-render with the updated capture in place. */
export async function moderateCaptureAction(
  eventId: string,
  captureId: string,
  action: ModerationAction,
) {
  const host = await requireHost();
  await moderateCapture(host.id, eventId, captureId, action);
}

/** Bound to the "Download all originals" button (product.md §11.2, decision D11). Mints a
 *  fresh batch of short-lived signed URLs on each click rather than reusing anything from page
 *  load, then hands them to the client for sequential triggered downloads — no server-side zip. */
export async function getBulkDownloadUrlsAction(eventId: string) {
  const host = await requireHost();
  const downloads = await listOriginalDownloadUrlsForEventHost(host.id, eventId);
  if (!downloads) {
    notFound();
  }
  return downloads;
}

/** Bound to link rotate/revoke buttons (product.md §8.1, roadmap Slice 5); no redirect,
 *  so the route re-renders with the new (or cleared) token in place. */
export async function rotateEventTokenAction(eventId: string) {
  const host = await requireHost();
  await rotateEventToken(host.id, eventId);
}

export async function revokeEventTokenAction(eventId: string) {
  const host = await requireHost();
  await revokeEventToken(host.id, eventId);
}

export async function rotateGalleryTokenAction(eventId: string) {
  const host = await requireHost();
  await rotateGalleryToken(host.id, eventId);
}

export async function revokeGalleryTokenAction(eventId: string) {
  const host = await requireHost();
  await revokeGalleryToken(host.id, eventId);
}
