"use server";

import { redirect, notFound } from "next/navigation";
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
import { moderateCapture, type ModerationAction } from "@/lib/dal/captures";
import type { GalleryVisibility, RevealMode } from "@/lib/db/types";
import { zonedDateTimeLocalToUtcIso } from "@/lib/events/timezone";

const REVEAL_MODES: RevealMode[] = ["after_event", "immediate", "custom"];
const VISIBILITIES: GalleryVisibility[] = ["anyone_with_link", "only_me"];
const VALID_TIME_ZONES = new Set(Intl.supportedValuesOf("timeZone"));

export async function createEvent(formData: FormData) {
  const host = await requireHost();
  const name = String(formData.get("name") ?? "").trim();

  if (!name) {
    throw new Error("Event name is required.");
  }

  const event = await createDraftEvent(host.id, name);
  redirect(`/events/${event.id}`);
}

function field(formData: FormData, key: string): string | null {
  const value = formData.get(key);
  if (typeof value !== "string" || value.trim() === "") return null;
  return value.trim();
}

export async function updateEvent(eventId: string, formData: FormData) {
  const host = await requireHost();

  const name = field(formData, "name");
  if (!name) {
    throw new Error("Event name is required.");
  }

  const revealModeRaw = field(formData, "revealMode") ?? "after_event";
  const revealMode = REVEAL_MODES.includes(revealModeRaw as RevealMode)
    ? (revealModeRaw as RevealMode)
    : "after_event";

  const visibilityRaw = field(formData, "visibility") ?? "anyone_with_link";
  const visibility = VISIBILITIES.includes(visibilityRaw as GalleryVisibility)
    ? (visibilityRaw as GalleryVisibility)
    : "anyone_with_link";

  const timezoneRaw = field(formData, "timezone") ?? "Asia/Manila";
  const timezone = VALID_TIME_ZONES.has(timezoneRaw)
    ? timezoneRaw
    : "Asia/Manila";

  const revealAtLocal = field(formData, "revealAt");

  const input: Partial<EventConfigInput> = {
    name,
    eventDate: field(formData, "eventDate"),
    timezone,
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

  const updated = await updateEventConfig(host.id, eventId, input);
  if (!updated) {
    notFound();
  }

  redirect(`/events/${eventId}?saved=1`);
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
