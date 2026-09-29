import "server-only";

import QRCode from "qrcode";
import { LOGO_TONES, lockupMarkup, lockupWidth, LOCKUP } from "@/lib/brand/logo";

/**
 * Event signage (product.md §11.3, architecture §8b): a bounded set of four ready-made
 * assets rendered from the event's own `event_token` — not a customizable design tool.
 * Each is a self-contained SVG (QR embedded as a data URI, no external font/image
 * dependency), which prints cleanly and avoids depending on system fonts being present in
 * the server's runtime, unlike rasterizing text with sharp would.
 *
 * Visually, this follows the FiveFrames design system (docs/design-direction.md): white canvas,
 * ink text, the one violet accent, Fraunces for the event name and Plus Jakarta Sans for
 * everything else (with fallback chains so the SVG still reads correctly wherever those fonts
 * aren't installed), plus a viewfinder-corner motif around the QR — a capture cue without
 * literal camera iconography or event-type framing. The FiveFrames lockup (lib/brand/logo.ts)
 * heads every format; it is outlined paths, so it needs no font at all.
 */

export type SignageFormat = "qr" | "table-card" | "poster" | "digital";

export const SIGNAGE_FORMATS: SignageFormat[] = ["qr", "table-card", "poster", "digital"];

const GUEST_INSTRUCTION = "Scan. You have five frames.";
const NO_APP_REASSURANCE = "No app. No account.";

// FiveFrames semantic tokens (app/globals.css), hex since SVG fill doesn't read CSS variables.
const CANVAS = "#FFFFFF"; // color/surface/base
const INK = "#15141A"; // color/text/primary
const INK_MUTED = "#6B6A75"; // color/text/muted
const ACCENT = "#6B2BD9"; // brand/primary
const PLATE = "#FFFFFF";

const DISPLAY_FONT_STACK = "Fraunces, Georgia, 'Times New Roman', serif";
const BODY_FONT_STACK = "'Plus Jakarta Sans', 'Segoe UI', Helvetica, Arial, sans-serif";

type Layout = {
  width: number;
  height: number;
  qrSize: number;
  nameSize: number;
  instructionSize: number;
  reassuranceSize: number;
  platePad: number;
  /** Height of the FiveFrames lockup at the top of the sign. */
  brandHeight: number;
};

const LAYOUT: Record<SignageFormat, Layout> = {
  qr: { width: 600, height: 720, qrSize: 400, nameSize: 30, instructionSize: 24, reassuranceSize: 16, platePad: 28, brandHeight: 28 },
  "table-card": { width: 700, height: 500, qrSize: 236, nameSize: 26, instructionSize: 20, reassuranceSize: 14, platePad: 20, brandHeight: 22 },
  poster: { width: 1200, height: 1800, qrSize: 760, nameSize: 54, instructionSize: 44, reassuranceSize: 26, platePad: 48, brandHeight: 56 },
  digital: { width: 1080, height: 1080, qrSize: 560, nameSize: 42, instructionSize: 34, reassuranceSize: 22, platePad: 40, brandHeight: 40 },
};

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

async function qrDataUri(url: string, sizePx: number): Promise<string> {
  return QRCode.toDataURL(url, {
    margin: 0,
    width: sizePx * 2, // 2× the placed size, so printed modules stay crisp
    color: { dark: INK, light: PLATE },
  });
}

/** Four L-shaped viewfinder brackets around the plate — a capture cue, not a literal camera icon. */
function viewfinderCorners(x: number, y: number, size: number, armLength: number): string {
  const corners = [
    { cx: x, cy: y, dx: 1, dy: 1 },
    { cx: x + size, cy: y, dx: -1, dy: 1 },
    { cx: x, cy: y + size, dx: 1, dy: -1 },
    { cx: x + size, cy: y + size, dx: -1, dy: -1 },
  ];
  return corners
    .map(
      ({ cx, cy, dx, dy }) =>
        `<path d="M ${cx} ${cy + dy * armLength} L ${cx} ${cy} L ${cx + dx * armLength} ${cy}" fill="none" stroke="${ACCENT}" stroke-width="4" stroke-linecap="round" />`,
    )
    .join("\n  ");
}

export async function renderEventSignageSvg(
  format: SignageFormat,
  input: { eventName: string; captureUrl: string },
): Promise<string> {
  const layout = LAYOUT[format];
  const qr = await qrDataUri(input.captureUrl, layout.qrSize);
  const name = escapeXml(input.eventName);

  const plateSize = layout.qrSize + layout.platePad * 2;
  const plateX = (layout.width - plateSize) / 2;
  const nameGap = 40;
  const instructionGap = 34;
  const reassuranceGap = 16;

  // The lockup sits at the top; the rest of the composition is centred in the space below it —
  // a fixed top-anchored layout left a large dead zone at the bottom on the poster's tall aspect.
  const brandTop = Math.round(layout.brandHeight * 0.8);
  const brandBottom = brandTop + layout.brandHeight + Math.round(layout.brandHeight * 0.6);
  const brandWidth = lockupWidth(layout.brandHeight);
  const brandScale = layout.brandHeight / LOCKUP.height;
  const contentHeight =
    layout.nameSize + nameGap + plateSize + instructionGap + layout.instructionSize + reassuranceGap + layout.reassuranceSize;
  const topMargin = brandBottom + Math.max(0, (layout.height - brandBottom - contentHeight) / 2);

  const nameY = topMargin + layout.nameSize * 0.8;
  const plateY = nameY + nameGap;
  const qrX = plateX + layout.platePad;
  const qrY = plateY + layout.platePad;
  const cornerInset = 14;
  const cornerArm = Math.max(24, layout.platePad * 0.9);
  const instructionY = plateY + plateSize + instructionGap + layout.instructionSize * 0.8;
  const reassuranceY = instructionY + reassuranceGap + layout.reassuranceSize * 0.8;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${layout.width}" height="${layout.height}" viewBox="0 0 ${layout.width} ${layout.height}">
  <rect width="100%" height="100%" fill="${CANVAS}" />
  <g transform="translate(${(layout.width - brandWidth) / 2} ${brandTop}) scale(${brandScale})">${lockupMarkup(LOGO_TONES.onLight)}</g>

  <text x="50%" y="${nameY}" text-anchor="middle" font-family="${DISPLAY_FONT_STACK}" font-weight="600" font-size="${layout.nameSize}" fill="${INK}">${name}</text>

  <rect x="${plateX}" y="${plateY}" width="${plateSize}" height="${plateSize}" rx="24" fill="${PLATE}" stroke="${ACCENT}" stroke-width="1.5" opacity="0.9" />
  ${viewfinderCorners(plateX + cornerInset, plateY + cornerInset, plateSize - cornerInset * 2, cornerArm)}
  <image x="${qrX}" y="${qrY}" width="${layout.qrSize}" height="${layout.qrSize}" href="${qr}" />

  <text x="50%" y="${instructionY}" text-anchor="middle" font-family="${BODY_FONT_STACK}" font-weight="600" font-size="${layout.instructionSize}" fill="${INK}">${escapeXml(GUEST_INSTRUCTION)}</text>
  <text x="50%" y="${reassuranceY}" text-anchor="middle" font-family="${BODY_FONT_STACK}" font-size="${layout.reassuranceSize}" fill="${INK_MUTED}">${escapeXml(NO_APP_REASSURANCE)}</text>
</svg>`;
}
