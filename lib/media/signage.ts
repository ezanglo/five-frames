import "server-only";

import QRCode from "qrcode";
import sharp from "sharp";
import { LOCKUP, LOGO_TONES, lockupMarkup } from "@/lib/brand/logo";
import { coverCrop, type CropFocus } from "@/lib/keepsakes/crop";
import { keepsakeDate } from "@/lib/keepsakes/context";
import type { AccentRoles } from "@/lib/theme/accents";
import { measureText, outlineText } from "./signage-fonts";
import type { SignageFormat } from "./signage-formats";
import {
  INK,
  NIGHT,
  WHITE,
  layoutSignage,
  type Rect,
  type SignageCode,
  type SignageLayout,
} from "./signage-layout";
import { escapeXml } from "./svg";

export { SIGNAGE_FORMATS, isSignageFormat, type SignageFormat } from "./signage-formats";

/**
 * Event signage (product.md §11.3, architecture §7c, decision D19): four formats of one themed
 * system, each a self-contained SVG rendered on demand and never persisted. The same function
 * draws the host's Look preview and the download; only the QR input differs.
 *
 * - Text is outlined from the bundled brand fonts (`signage-fonts.ts`) and the QR is a vector
 *   path, so a file prints and displays identically everywhere with nothing to load.
 * - The theme image is pre-cropped to the field (the `coverCrop` rule, focus 50% 35%) and
 *   embedded as a data URI: never a storage URL.
 * - The only event data this takes is the closed `SignageInput` below. There is no field for a
 *   destination: a live QR's value comes only from `liveSignageQr`.
 */

declare const liveCaptureUrl: unique symbol;
/** `{origin}/e/{event_token}` of an activated event; only `liveSignageQr` makes one. */
export type LiveCaptureUrl = string & { readonly [liveCaptureUrl]: true };

/**
 * `live` carries the real capture link. `preview` carries nothing at all: it draws a bundled,
 * non-decodable placeholder, so a Draft preview holds no URL or token even if screenshotted.
 */
export type SignageQr = { kind: "live"; captureUrl: LiveCaptureUrl } | { kind: "preview" };

/** The live QR for an activated event with a current token; otherwise null (no code exists). */
export function liveSignageQr(
  event: { activated_at: string | null; event_token: string | null },
  origin: string,
): SignageQr | null {
  if (!event.activated_at || !event.event_token) return null;
  return { kind: "live", captureUrl: `${origin}/e/${event.event_token}` as LiveCaptureUrl };
}

export const PREVIEW_QR: SignageQr = { kind: "preview" };

export type SignageInput = {
  eventName: string;
  /** `event_date` ("YYYY-MM-DD"), or null. */
  eventDate: string | null;
  /** Without "#". */
  hashtag: string | null;
  accent: AccentRoles;
  /** The normalized theme image, already authorized by the caller. Unused by the QR format. */
  themeImage: Buffer | null;
  qr: SignageQr;
};

export type SignageRenderOptions = {
  /** Long edge of the embedded theme image. Previews use a smaller one; the crop is identical. */
  imageMaxEdge?: number;
};

/** The field crop: centred across, biased to the upper third where faces are. */
export const SIGNAGE_IMAGE_FOCUS: CropFocus = { x: 0.5, y: 0.35 };

/** Fixed, never a host choice (architecture §7c). */
const ERROR_CORRECTION = "M" as const;

export async function renderEventSignage(
  format: SignageFormat,
  input: SignageInput,
  options: SignageRenderOptions = {},
): Promise<{ svg: string; layout: SignageLayout }> {
  const matrix = input.qr.kind === "live" ? qrMatrix(input.qr.captureUrl) : null;
  const code: SignageCode = matrix ? { kind: "live", modules: matrix.size } : { kind: "preview" };
  const layout = layoutSignage(
    format,
    {
      name: input.eventName,
      dateLabel: keepsakeDate(input.eventDate)?.label ?? null,
      hashtag: input.hashtag ? input.hashtag.replace(/^#/, "") || null : null,
      accent: input.accent,
      hasImage: format !== "qr" && input.themeImage !== null,
      code,
    },
    { measure: measureText },
  );
  const image = layout.image && input.themeImage
    ? await fieldImage(input.themeImage, layout.image, options.imageMaxEdge ?? 2400)
    : null;
  // An image that can't be decoded degrades to the no-image field rather than failing the sign.
  const finalLayout = layout.image && !image ? layoutWithoutImage(layout, input.accent) : layout;
  return { svg: writeSvg(finalLayout, input.eventName, image, matrix), layout: finalLayout };
}

export async function renderEventSignageSvg(
  format: SignageFormat,
  input: SignageInput,
  options?: SignageRenderOptions,
): Promise<string> {
  return (await renderEventSignage(format, input, options)).svg;
}

function layoutWithoutImage(layout: SignageLayout, accent: AccentRoles): SignageLayout {
  return { ...layout, image: null, glow: { color: accent.base } };
}

// ------------------------------------------------------------------------------------ QR

type QrMatrix = { size: number; dark: (row: number, col: number) => boolean };

function qrMatrix(value: string): QrMatrix {
  const qr = QRCode.create(value, { errorCorrectionLevel: ERROR_CORRECTION });
  return { size: qr.modules.size, dark: (row, col) => Boolean(qr.modules.get(row, col)) };
}

/** One path of row runs: ink modules only, nothing else inside the plate. */
function qrPath(matrix: QrMatrix, rect: Rect, moduleSize: number): string {
  const parts: string[] = [];
  for (let row = 0; row < matrix.size; row++) {
    let col = 0;
    while (col < matrix.size) {
      if (!matrix.dark(row, col)) {
        col++;
        continue;
      }
      const start = col;
      while (col < matrix.size && matrix.dark(row, col)) col++;
      const x = n(rect.x + start * moduleSize);
      const y = n(rect.y + row * moduleSize);
      const w = n(rect.x + col * moduleSize) - x;
      const h = n(rect.y + (row + 1) * moduleSize) - y;
      parts.push(`M${x} ${y}h${n(w)}v${n(h)}h${n(-w)}z`);
    }
  }
  return `<path d="${parts.join("")}" fill="${INK}" shape-rendering="crispEdges"/>`;
}

/**
 * The Draft placeholder (board §09–10): the real code's footprint as a pale dot field with no
 * finder patterns (so it neither decodes nor looks like a working code) and a PREVIEW label.
 * It is a fixed pattern: nothing about it comes from the event.
 */
function placeholder(rect: Rect): string {
  const s = rect.width;
  const step = s / 22;
  const r = n(s * 0.0059);
  const dots: string[] = [];
  for (let row = 0; row < 22; row++) {
    for (let col = 0; col < 22; col++) {
      dots.push(`<circle cx="${n(rect.x + step / 2 + col * step)}" cy="${n(rect.y + step / 2 + row * step)}" r="${r}"/>`);
    }
  }
  const box = { width: s * 0.78, height: s * 0.3 };
  return (
    `<rect x="${n(rect.x)}" y="${n(rect.y)}" width="${n(s)}" height="${n(s)}" rx="${n(s * 0.04)}" fill="#F5F4F8"/>` +
    `<g fill="#C9C2DC">${dots.join("")}</g>` +
    `<rect x="${n(rect.x + (s - box.width) / 2)}" y="${n(rect.y + (s - box.height) / 2)}" width="${n(box.width)}" height="${n(box.height)}" rx="${n(s * 0.054)}" fill="${WHITE}" stroke="#C9C2DC" stroke-width="${n(s * 0.006)}" stroke-dasharray="${n(s * 0.02)} ${n(s * 0.014)}"/>`
  );
}

// ------------------------------------------------------------------------------------ image

/** The theme image cropped to exactly the field's shape, as a JPEG data URI. */
async function fieldImage(bytes: Buffer, box: Rect, maxEdge: number): Promise<string | null> {
  try {
    const meta = await sharp(bytes).metadata();
    if (!meta.width || !meta.height) return null;
    const crop = coverCrop(meta.width, meta.height, box.width, box.height, SIGNAGE_IMAGE_FOCUS);
    let pipeline = sharp(bytes).extract(crop);
    if (Math.max(crop.width, crop.height) > maxEdge) {
      pipeline = pipeline.resize({ width: maxEdge, height: maxEdge, fit: "inside" });
    }
    const jpeg = await pipeline.flatten({ background: NIGHT }).jpeg({ quality: 86 }).toBuffer();
    return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
  } catch (error) {
    console.warn("signage: theme image unusable, drawing the no-image field", error);
    return null;
  }
}

// ------------------------------------------------------------------------------------ writer

function n(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function rect(r: Rect, fill: string, extra = ""): string {
  return `<rect x="${n(r.x)}" y="${n(r.y)}" width="${n(r.width)}" height="${n(r.height)}" fill="${fill}"${extra}/>`;
}

function fieldMarkup(layout: SignageLayout, image: string | null): string {
  const f = layout.field;
  if (!f) return "";
  if (image && layout.image) {
    const [a, b, c] = f.scrim;
    return (
      `<defs><clipPath id="ff-field"><rect x="${n(f.x)}" y="${n(f.y)}" width="${n(f.width)}" height="${n(f.height)}"/></clipPath>` +
      `<linearGradient id="ff-scrim" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${NIGHT}" stop-opacity="${a}"/><stop offset=".5" stop-color="${NIGHT}" stop-opacity="${b}"/><stop offset="1" stop-color="${NIGHT}" stop-opacity="${c}"/></linearGradient></defs>` +
      `<g clip-path="url(#ff-field)"><image href="${image}" x="${n(f.x)}" y="${n(f.y)}" width="${n(f.width)}" height="${n(f.height)}" preserveAspectRatio="xMidYMid slice"/>` +
      rect(f, "url(#ff-scrim)") +
      `</g>`
    );
  }
  const glow = layout.glow?.color ?? NIGHT;
  return (
    `<defs><radialGradient id="ff-glow" cx="0.9" cy="0" r="0.9"><stop offset="0" stop-color="${glow}" stop-opacity=".6"/><stop offset="1" stop-color="${glow}" stop-opacity="0"/></radialGradient>` +
    `<radialGradient id="ff-glow2" cx="0" cy="1" r="0.7"><stop offset="0" stop-color="${glow}" stop-opacity=".22"/><stop offset="1" stop-color="${glow}" stop-opacity="0"/></radialGradient></defs>` +
    rect(f, NIGHT) +
    rect(f, "url(#ff-glow)") +
    rect(f, "url(#ff-glow2)")
  );
}

function bracketsMarkup(layout: SignageLayout): string {
  const { corners, arm, stroke, color } = layout.brackets;
  return corners
    .map(
      ({ x, y, dx, dy }) =>
        `<path d="M${n(x)} ${n(y + dy * arm)}V${n(y)}H${n(x + dx * arm)}" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round"/>`,
    )
    .join("");
}

function writeSvg(layout: SignageLayout, eventName: string, image: string | null, matrix: QrMatrix | null): string {
  const { width, height, lockup, plate, code, band } = layout;
  const tone = LOGO_TONES[lockup.tone];
  const scale = lockup.height / LOCKUP.height;
  const title = `${eventName.normalize("NFC").trim()} · FiveFrames`;
  const codeMarkup =
    code.kind === "live" && matrix ? qrPath(matrix, code.rect, code.moduleSize) : placeholder(code.rect);

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img">`,
    `<title>${escapeXml(title)}</title>`,
    rect({ x: 0, y: 0, width, height }, WHITE),
    fieldMarkup(layout, image),
    `<g transform="translate(${n(lockup.x)} ${n(lockup.y)}) scale(${n(scale * 1e6) / 1e6})">${lockupMarkup(tone)}</g>`,
    ...layout.texts
      .filter((t) => t.role !== "previewLabel" && t.role !== "previewNote")
      .map((t) => outlineText(t.text, t.style, t.x, t.baseline, t.fill, t.opacity)),
    bracketsMarkup(layout),
    `<rect x="${n(plate.x)}" y="${n(plate.y)}" width="${n(plate.width)}" height="${n(plate.height)}" rx="${n(plate.rx)}" fill="${WHITE}"/>`,
    codeMarkup,
    ...layout.texts
      .filter((t) => t.role === "previewLabel" || t.role === "previewNote")
      .map((t) => outlineText(t.text, t.style, t.x, t.baseline, t.fill, t.opacity)),
    rect(band, band.fill),
    `</svg>`,
  ].join("\n");
}
