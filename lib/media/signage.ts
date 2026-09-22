import "server-only";

import QRCode from "qrcode";

/**
 * Event signage (product.md §11.3, architecture §8b): a bounded set of four ready-made
 * assets rendered from the event's own `event_token` — not a customizable design tool.
 * Each is a self-contained SVG (QR embedded as a data URI, no external font/image
 * dependency), which prints cleanly and avoids depending on system fonts being present in
 * the server's runtime, unlike rasterizing text with sharp would.
 *
 * Visually, this reuses the host/guest warm palette and the product's one display face
 * (Bricolage Grotesque, with a geometric-sans fallback chain so the SVG still reads
 * correctly wherever that font isn't installed) plus a viewfinder-corner motif around the
 * QR — a quiet nod to the disposable-camera identity already established in
 * docs/design-direction.md, without any literal camera iconography or event-type framing.
 */

export type SignageFormat = "qr" | "table-card" | "poster" | "digital";

export const SIGNAGE_FORMATS: SignageFormat[] = ["qr", "table-card", "poster", "digital"];

const GUEST_INSTRUCTION = "Scan. You have five frames.";
const NO_APP_REASSURANCE = "No app. No account.";

// Matches the host/guest --canvas / --ink / --accent family (docs/design-direction.md),
// hex-converted since SVG text/fill doesn't render CSS custom properties.
const CANVAS = "#faf4e9";
const INK = "#3d3226";
const INK_MUTED = "#8a7c6a";
const ACCENT = "#a8632f";
const PLATE = "#fffdf8";

const DISPLAY_FONT_STACK =
  "'Bricolage Grotesque', 'Segoe UI', Avenir, Futura, sans-serif";
const BODY_FONT_STACK = "'Inter', Helvetica, Arial, sans-serif";

type Layout = {
  width: number;
  height: number;
  qrSize: number;
  nameSize: number;
  instructionSize: number;
  reassuranceSize: number;
  platePad: number;
};

const LAYOUT: Record<SignageFormat, Layout> = {
  qr: { width: 600, height: 720, qrSize: 400, nameSize: 30, instructionSize: 24, reassuranceSize: 16, platePad: 28 },
  "table-card": { width: 700, height: 500, qrSize: 260, nameSize: 26, instructionSize: 20, reassuranceSize: 14, platePad: 22 },
  poster: { width: 1200, height: 1800, qrSize: 760, nameSize: 54, instructionSize: 44, reassuranceSize: 26, platePad: 48 },
  digital: { width: 1080, height: 1080, qrSize: 560, nameSize: 42, instructionSize: 34, reassuranceSize: 22, platePad: 40 },
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
    width: sizePx,
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

  // Vertically center the whole composition in the canvas — a fixed top-anchored layout left
  // a large dead zone at the bottom on the poster's tall aspect ratio.
  const contentHeight =
    layout.nameSize + nameGap + plateSize + instructionGap + layout.instructionSize + reassuranceGap + layout.reassuranceSize;
  const topMargin = Math.max(24, (layout.height - contentHeight) / 2);

  const nameY = topMargin + layout.nameSize * 0.8;
  const plateY = nameY + nameGap;
  const qrX = plateX + layout.platePad;
  const qrY = plateY + layout.platePad;
  const cornerInset = 14;
  const cornerArm = Math.max(24, layout.platePad * 0.9);
  const instructionY = plateY + plateSize + instructionGap + layout.instructionSize * 0.8;
  const reassuranceY = instructionY + reassuranceGap + layout.reassuranceSize * 0.8;
  const railY1 = 14;
  const railY2 = layout.height - 14;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${layout.width}" height="${layout.height}" viewBox="0 0 ${layout.width} ${layout.height}">
  <rect width="100%" height="100%" fill="${CANVAS}" />
  <line x1="${layout.width * 0.2}" y1="${railY1}" x2="${layout.width * 0.8}" y2="${railY1}" stroke="${ACCENT}" stroke-width="2" opacity="0.5" />
  <line x1="${layout.width * 0.2}" y1="${railY2}" x2="${layout.width * 0.8}" y2="${railY2}" stroke="${ACCENT}" stroke-width="2" opacity="0.5" />

  <text x="50%" y="${nameY}" text-anchor="middle" font-family="${DISPLAY_FONT_STACK}" font-weight="600" font-size="${layout.nameSize}" fill="${INK}">${name}</text>

  <rect x="${plateX}" y="${plateY}" width="${plateSize}" height="${plateSize}" rx="24" fill="${PLATE}" stroke="${ACCENT}" stroke-width="1.5" opacity="0.9" />
  ${viewfinderCorners(plateX + cornerInset, plateY + cornerInset, plateSize - cornerInset * 2, cornerArm)}
  <image x="${qrX}" y="${qrY}" width="${layout.qrSize}" height="${layout.qrSize}" href="${qr}" />

  <text x="50%" y="${instructionY}" text-anchor="middle" font-family="${BODY_FONT_STACK}" font-weight="600" font-size="${layout.instructionSize}" fill="${INK}">${escapeXml(GUEST_INSTRUCTION)}</text>
  <text x="50%" y="${reassuranceY}" text-anchor="middle" font-family="${BODY_FONT_STACK}" font-size="${layout.reassuranceSize}" fill="${INK_MUTED}">${escapeXml(NO_APP_REASSURANCE)}</text>
</svg>`;
}
