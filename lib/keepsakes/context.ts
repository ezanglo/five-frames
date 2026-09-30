import { deriveAccentRoles, type AccentRoles } from "@/lib/theme/accents";
import type { FullSetStyleId, SingleStyleId } from "./styles";

/**
 * The closed render inputs (architecture §7b "Render inputs: closed structs", invariant 14). Every
 * keepsake template, on the server and in the browser, receives only these shapes. The builders
 * copy named fields and nothing else, so a guest display name, the welcome message, a token, a
 * link, a count or any host data cannot reach a template: there is no field to carry it. The
 * Full Set input has no message and no per-photo data at all.
 *
 * Client-safe (no `server-only`): the guest picker and host Look build the same context from what
 * their page already holds, with signed URLs where the server uses prepared data URIs.
 */

/** An image a template can draw: a data URI (server export) or a signed/bundled URL (preview). */
export type KeepsakeImageRef = { src: string };

/** Event information a template may show about the date. Derived only from `event_date`. */
export type KeepsakeDate = {
  /** "Sat, 18 Oct 2026" */
  label: string;
  /** "18.10.2026" — Booth and Strip's date stamp */
  stamp: string;
  /** "18" — Journal's numeral */
  day: string;
  /** "October 2026" */
  monthYear: string;
  /** "Saturday" */
  weekday: string;
};

export type KeepsakeContext = {
  event: { name: string; date: KeepsakeDate | null; hashtag: string | null };
  theme: { accent: AccentRoles; image: KeepsakeImageRef | null };
};

/** The one guest photo of a Single-photo keepsake, with its true (upright) dimensions. */
export type KeepsakePhoto = { src: string; width: number; height: number };

export type SingleKeepsakeInput = KeepsakeContext & {
  style: SingleStyleId;
  photo: KeepsakePhoto;
  /** The capture's own committed message, or null. Never editable (product.md §9.3). */
  message: string | null;
};

/** Pixels only: no id, timestamp, message or capture reference. */
export type SlotPhoto = { src: string };
export type FiveSlotPhotos = readonly [SlotPhoto, SlotPhoto, SlotPhoto, SlotPhoto, SlotPhoto];

export type FullSetKeepsakeInput = KeepsakeContext & {
  style: FullSetStyleId;
  /** Exactly five, in canonical `(committed_at, slot_index)` order. */
  photos: FiveSlotPhotos;
};

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/**
 * The date parts from an `event_date` ("YYYY-MM-DD", a calendar date with no instant). Computed
 * with fixed English names in UTC, so the server export and the browser preview always agree
 * and no timezone can move it to a neighbouring day.
 */
export function keepsakeDate(eventDate: string | null): KeepsakeDate | null {
  if (!eventDate) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(eventDate);
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  const weekday = WEEKDAYS[date.getUTCDay()];
  const monthName = MONTHS[month - 1];
  return {
    label: `${weekday.slice(0, 3)}, ${day} ${monthName.slice(0, 3)} ${year}`,
    stamp: `${String(day).padStart(2, "0")}.${String(month).padStart(2, "0")}.${year}`,
    day: String(day),
    monthYear: `${monthName} ${year}`,
    weekday,
  };
}

/** The event fields a keepsake may use. Anything else on the row is never read. */
export type KeepsakeEventSource = {
  name: string;
  event_date: string | null;
  hashtag: string | null;
  accent_color: string;
};

/**
 * The shared context. Copies exactly the name, date, hashtag and accent; the theme image is passed
 * in separately, already authorized and prepared by the caller.
 */
export function buildKeepsakeContext(
  event: KeepsakeEventSource,
  themeImage: KeepsakeImageRef | null,
): KeepsakeContext {
  const hashtag = event.hashtag ? event.hashtag.replace(/^#/, "") : null;
  return {
    event: {
      name: String(event.name),
      date: keepsakeDate(event.event_date),
      hashtag: hashtag || null,
    },
    theme: {
      accent: deriveAccentRoles(event.accent_color),
      image: themeImage ? { src: themeImage.src } : null,
    },
  };
}

export function buildSingleKeepsakeInput(
  context: KeepsakeContext,
  style: SingleStyleId,
  photo: KeepsakePhoto,
  message: string | null,
): SingleKeepsakeInput {
  const trimmed = message?.trim();
  return {
    event: context.event,
    theme: context.theme,
    style,
    photo: { src: photo.src, width: photo.width, height: photo.height },
    message: trimmed ? trimmed : null,
  };
}

/** Refuses anything but exactly five photos: there is no partial or padded Full Set. */
export function buildFullSetKeepsakeInput(
  context: KeepsakeContext,
  style: FullSetStyleId,
  photos: readonly SlotPhoto[],
): FullSetKeepsakeInput {
  if (photos.length !== 5) throw new RangeError("A Full Set is made from exactly five photos");
  const five = photos.map((p) => ({ src: p.src })) as unknown as FiveSlotPhotos;
  return { event: context.event, theme: context.theme, style, photos: five };
}
