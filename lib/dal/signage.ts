import "server-only";

import { getEventAccessFor } from "@/lib/dal/event-access";
import { logSupportAccess } from "@/lib/dal/support-actions";
import { readThemeImageBytes } from "@/lib/dal/event-theme";
import { canEditEventTheme } from "@/lib/events/lifecycle";
import { TABLE_NUMBER_PREVIEW, isSignageFormatAllowed, parseTableCount } from "@/lib/media/signage-formats";
import { renderTableNumberZip } from "@/lib/media/table-numbers";
import { eventPlanFeatures } from "@/lib/plans/registry";
import {
  PREVIEW_QR,
  formatTakesImage,
  isSignageFormat,
  liveSignageQr,
  renderEventSignageSvg,
  type SignageFormat,
} from "@/lib/media/signage";
import { accentFor, deriveAccentRoles, isAccentKey } from "@/lib/theme/accents";
import { normalizeHashtag } from "@/lib/theme/hashtag";
import type { EventRow } from "@/lib/db/types";

/**
 * Host signage (product.md §10.1, §11.3; architecture §7c). Two reads, both behind the event
 * access check (invariant 9), admitting owner and support (D27). Neither changes the event; a
 * support download is logged (`signage_downloaded`) before it renders:
 *
 * - **Download**: only for an activated event with a current `event_token` (invariant 7: no
 *   distributable QR before payment), drawn from the saved theme with the live QR.
 * - **Preview**: the same renderer, inline, in any editable state including Draft. It uses the
 *   live QR once one exists and the URL-less placeholder before that; no token is ever minted for
 *   it. It may apply the host's unsaved accent and hashtag, validated here exactly as a save
 *   would be; it never changes the QR's destination.
 *
 * Both serve only the formats the event's plan includes (product.md §15.3.1, criterion 82): a
 * Free event gets the phone-screen format, and a request for any other is not found, even by
 * its address.
 *
 * Table-number cards (Standard and Premium, criterion 78) download only as a set, through
 * `getTableNumberCardsDownload`; their preview is one sample card. Their gate is the same.
 */

/** The preview's `<img>` is small; the crop is the download's, just at a lower resolution. */
const PREVIEW_IMAGE_EDGE = 1200;

export type SignageDownload = { svg: string; filename: string };

export async function getSignageDownload(
  userId: string,
  eventId: string,
  format: string,
  origin: string,
): Promise<SignageDownload | null> {
  // Table-number cards only come as a numbered set (below).
  if (!isSignageFormat(format) || format === "table-number") return null;
  const access = await getEventAccessFor(userId, eventId, ["owner", "support"]);
  if (!access) return null;
  const { event } = access;
  if (!isSignageFormatAllowed(format, eventPlanFeatures(event))) return null;
  const qr = liveSignageQr(event, origin);
  if (!qr) return null;
  if (access.role === "support") {
    await logSupportAccess(userId, eventId, "signage_downloaded", { format });
  }

  const svg = await renderEventSignageSvg(format, {
    ...presentation(event, {}),
    themeImage: formatTakesImage(format) ? await readThemeImageBytes(event) : null,
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
  userId: string,
  eventId: string,
  format: string,
  origin: string,
  overrides: SignagePreviewOverrides = {},
): Promise<string | null> {
  if (!isSignageFormat(format)) return null;
  const event = (await getEventAccessFor(userId, eventId, ["owner", "support"]))?.event;
  if (!event || !canEditEventTheme(event)) return null;
  if (!isSignageFormatAllowed(format, eventPlanFeatures(event))) return null;

  return renderEventSignageSvg(
    format,
    {
      ...presentation(event, overrides),
      themeImage: formatTakesImage(format) ? await readThemeImageBytes(event) : null,
      qr: liveSignageQr(event, origin) ?? PREVIEW_QR,
      tableNumber: TABLE_NUMBER_PREVIEW,
    },
    { imageMaxEdge: PREVIEW_IMAGE_EDGE },
  );
}

export type TableNumberCardsDownload = { zip: Uint8Array; filename: string };

/**
 * N table-number cards as one ZIP (product.md §11.3, criterion 78). Same gate as a signage
 * download, plus the plan's `tableNumberCards` and a strict 1–100 count. The count is never
 * stored, and every card carries the same live QR.
 */
export async function getTableNumberCardsDownload(
  userId: string,
  eventId: string,
  countParam: string | null,
  origin: string,
): Promise<TableNumberCardsDownload | null> {
  const count = parseTableCount(countParam);
  if (count === null) return null;
  const access = await getEventAccessFor(userId, eventId, ["owner", "support"]);
  if (!access) return null;
  const { event } = access;
  if (!isSignageFormatAllowed("table-number", eventPlanFeatures(event))) return null;
  const qr = liveSignageQr(event, origin);
  if (qr?.kind !== "live") return null;
  if (access.role === "support") {
    await logSupportAccess(userId, eventId, "signage_downloaded", { format: "table-number", count });
  }

  const zip = await renderTableNumberZip({ ...presentation(event, {}), qr }, count);
  return { zip, filename: `${safeName(event.name)}-table-numbers.zip` };
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

function safeName(eventName: string): string {
  return eventName.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "event";
}

export function signageFilename(eventName: string, format: SignageFormat): string {
  return `${safeName(eventName)}-${format}.svg`;
}
