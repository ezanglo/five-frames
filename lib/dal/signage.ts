import "server-only";

import { getEventForHost } from "@/lib/dal/events";
import { readThemeImageBytes } from "@/lib/dal/event-theme";
import { canEditEventTheme } from "@/lib/events/lifecycle";
import {
  PREVIEW_QR,
  isSignageFormat,
  liveSignageQr,
  renderEventSignageSvg,
  type SignageFormat,
} from "@/lib/media/signage";
import { accentFor, deriveAccentRoles, isAccentKey } from "@/lib/theme/accents";
import { normalizeHashtag } from "@/lib/theme/hashtag";
import type { EventRow } from "@/lib/db/types";

/**
 * Host signage (product.md §10.1, §11.3; architecture §7c). Two reads, both behind the
 * ownership predicate (invariant 9), neither writing anything:
 *
 * - **Download**: only for an activated event with a current `event_token` (invariant 7: no
 *   distributable QR before payment), drawn from the saved theme with the live QR.
 * - **Preview**: the same renderer, inline, in any editable state including Draft. It uses the
 *   live QR once one exists and the URL-less placeholder before that; no token is ever minted for
 *   it. It may apply the host's unsaved accent and hashtag, validated here exactly as a save
 *   would be; it never changes the QR's destination.
 */

/** The preview's `<img>` is small; the crop is the download's, just at a lower resolution. */
const PREVIEW_IMAGE_EDGE = 1200;

export type SignageDownload = { svg: string; filename: string };

export async function getSignageDownload(
  hostId: string,
  eventId: string,
  format: string,
  origin: string,
): Promise<SignageDownload | null> {
  if (!isSignageFormat(format)) return null;
  const event = await getEventForHost(hostId, eventId);
  if (!event) return null;
  const qr = liveSignageQr(event, origin);
  if (!qr) return null;

  const svg = await renderEventSignageSvg(format, {
    ...presentation(event, {}),
    themeImage: format === "qr" ? null : await readThemeImageBytes(event),
    qr,
  });
  return { svg, filename: signageFilename(event.name, format) };
}

export type SignagePreviewOverrides = {
  /** An unsaved accent key; anything not in the registry is ignored. */
  accent?: string | null;
  /** An unsaved hashtag ("" clears it); anything the validator refuses is ignored. */
  hashtag?: string | null;
};

export async function getSignagePreview(
  hostId: string,
  eventId: string,
  format: string,
  origin: string,
  overrides: SignagePreviewOverrides = {},
): Promise<string | null> {
  if (!isSignageFormat(format)) return null;
  const event = await getEventForHost(hostId, eventId);
  if (!event || !canEditEventTheme(event)) return null;

  return renderEventSignageSvg(
    format,
    {
      ...presentation(event, overrides),
      themeImage: format === "qr" ? null : await readThemeImageBytes(event),
      qr: liveSignageQr(event, origin) ?? PREVIEW_QR,
    },
    { imageMaxEdge: PREVIEW_IMAGE_EDGE },
  );
}

/** The only event fields signage may show. Everything else on the row stays here. */
function presentation(event: EventRow, overrides: SignagePreviewOverrides) {
  const accent = isAccentKey(overrides.accent) ? overrides.accent : accentFor(event.accent_color).key;
  let hashtag = event.hashtag;
  if (typeof overrides.hashtag === "string") {
    const normalized = normalizeHashtag(overrides.hashtag);
    if (normalized.ok) hashtag = normalized.value;
  }
  return {
    eventName: event.name,
    eventDate: event.event_date,
    hashtag,
    accent: deriveAccentRoles(accent),
  };
}

export function signageFilename(eventName: string, format: SignageFormat): string {
  const safe = eventName.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "event";
  return `${safe}-${format}.svg`;
}
