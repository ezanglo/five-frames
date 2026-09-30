"use server";

import { redirect, notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireHost } from "@/lib/auth/host-session";
import {
  closeCapture,
  createDraftEvent,
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
import {
  beginThemeImageUpload,
  commitThemeImageUpload,
  removeThemeImage,
  type BeginThemeUploadResult,
  type CommitThemeUploadResult,
} from "@/lib/dal/event-theme";
import { DEFAULT_ACCENT, isAccentKey } from "@/lib/theme/accents";
import { HASHTAG_ERROR, normalizeHashtag } from "@/lib/theme/hashtag";
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

/** Event details (Create · Details, Settings · Event & gallery): name, date, timezone. */
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

/** After the party (Create · Details, Settings · Event & gallery): reveal timing and visibility. */
function parseAfterParty(
  formData: FormData,
  timezone: string,
): Pick<EventConfigInput, "revealMode" | "revealAt" | "visibility"> {
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
    revealMode,
    // Interpreted as wall-clock time in the event's own timezone, not the server
    // process's timezone — a bare `new Date(revealAtLocal)` would silently use the
    // latter and store the wrong instant.
    revealAt:
      revealMode === "custom" && revealAtLocal
        ? zonedDateTimeLocalToUtcIso(revealAtLocal, timezone)
        : null,
    visibility,
  };
}

type LookInput = Pick<EventConfigInput, "hostMessage" | "hashtag" | "accentColor" | "sharingEnabled">;

/**
 * Look (Create · Look, Settings · Look): event color, hashtag, welcome message and the Guest
 * keepsakes toggle (the existing sharing setting). The theme image is not here — it saves on its
 * own the moment its upload commits (architecture §7a). The hashtag and accent are validated
 * again in the DAL; this only turns a bad value into a calm form error.
 */
function parseLook(formData: FormData): { ok: true; input: LookInput } | { ok: false; error: string } {
  const rawHashtag = formData.get("hashtag");
  const hashtag = normalizeHashtag(typeof rawHashtag === "string" ? rawHashtag : "");
  if (!hashtag.ok) return { ok: false, error: HASHTAG_ERROR[hashtag.reason] };

  const accentRaw = field(formData, "accentColor") ?? DEFAULT_ACCENT;
  if (!isAccentKey(accentRaw)) return { ok: false, error: "Choose one of the event colors." };

  return {
    ok: true,
    input: {
      hostMessage: field(formData, "hostMessage"),
      hashtag: hashtag.value,
      accentColor: accentRaw,
      sharingEnabled: formData.get("sharingEnabled") === "on",
    },
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
  await updateEventConfig(host.id, draft.id, {
    ...details,
    ...parseAfterParty(formData, details.timezone),
  });
  redirect(`/events/${draft.id}/setup?step=look`);
}

/** Create · Details for an existing draft (details and the After the party card). */
export async function saveDetailsStepAction(
  eventId: string,
  _prev: EventFormState,
  formData: FormData,
): Promise<EventFormState> {
  const host = await requireHost();
  const details = parseDetails(formData);
  if (!details) return { error: "Give your event a name." };

  const updated = await updateEventConfig(host.id, eventId, {
    ...details,
    ...parseAfterParty(formData, details.timezone),
  });
  if (!updated) notFound();
  redirect(`/events/${eventId}/setup?step=look`);
}

/** Create · Look: color, hashtag, welcome message, Guest keepsakes. Continue with nothing set
 *  keeps the defaults — the default event. */
export async function saveLookStepAction(
  eventId: string,
  _prev: EventFormState,
  formData: FormData,
): Promise<EventFormState> {
  const host = await requireHost();
  const look = parseLook(formData);
  if (!look.ok) return { error: look.error };

  const updated = await updateEventConfig(host.id, eventId, look.input);
  if (!updated) notFound();
  redirect(`/events/${eventId}/setup?step=share`);
}

/** Settings · Event & gallery: name, date, timezone, reveal timing, visibility. */
export async function saveEventAndGalleryAction(
  eventId: string,
  _prev: EventFormState,
  formData: FormData,
): Promise<EventFormState> {
  const host = await requireHost();
  const details = parseDetails(formData);
  if (!details) return { error: "Give your event a name." };

  const updated = await updateEventConfig(host.id, eventId, {
    ...details,
    ...parseAfterParty(formData, details.timezone),
  });
  if (!updated) notFound();
  redirect(`/events/${eventId}/settings?saved=1`);
}

/** Settings · Look: the same fields as Create · Look, saved with Save changes. */
export async function saveLookSettingsAction(
  eventId: string,
  _prev: EventFormState,
  formData: FormData,
): Promise<EventFormState> {
  const host = await requireHost();
  const look = parseLook(formData);
  if (!look.ok) return { error: look.error };

  const updated = await updateEventConfig(host.id, eventId, look.input);
  if (!updated) notFound();
  redirect(`/events/${eventId}/settings/look?saved=1`);
}

/**
 * Theme image, step 1 (architecture §7a): a signed upload capability for one server-chosen path
 * in this host's own event folder. Host session and ownership are checked here and in the DAL.
 */
export async function beginThemeImageUploadAction(
  eventId: string,
  file: { sizeBytes: number; contentType: string },
): Promise<BeginThemeUploadResult> {
  const host = await requireHost();
  return beginThemeImageUpload(host.id, eventId, {
    sizeBytes: Number(file.sizeBytes),
    contentType: String(file.contentType).toLowerCase(),
  });
}

/** Theme image, steps 2–4: normalize, swap, prune. Saves immediately — not with the form. */
export async function commitThemeImageUploadAction(
  eventId: string,
  uploadId: string,
): Promise<CommitThemeUploadResult> {
  const host = await requireHost();
  const result = await commitThemeImageUpload(host.id, eventId, String(uploadId));
  if (result.kind === "saved") revalidatePath(`/events/${eventId}`, "layout");
  return result;
}

/** Remove the theme image (after the host confirms). Accent, hashtag and everything else stay. */
export async function removeThemeImageAction(eventId: string) {
  const host = await requireHost();
  const result = await removeThemeImage(host.id, eventId);
  if (result.kind === "removed") revalidatePath(`/events/${eventId}`, "layout");
  return result;
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
