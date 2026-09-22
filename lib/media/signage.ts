import "server-only";

import QRCode from "qrcode";

/**
 * Event signage (product.md §11.3, architecture §8b): a bounded set of four ready-made
 * assets rendered from the event's own `event_token` — not a customizable design tool.
 * Each is a self-contained SVG (QR embedded as a data URI, no external font/image
 * dependency), which prints cleanly and avoids depending on system fonts being present in
 * the server's runtime, unlike rasterizing text with sharp would.
 */

export type SignageFormat = "qr" | "table-card" | "poster" | "digital";

export const SIGNAGE_FORMATS: SignageFormat[] = ["qr", "table-card", "poster", "digital"];

const GUEST_INSTRUCTION = "Scan. You have five frames.";
const NO_APP_REASSURANCE = "No app. No account.";

type Layout = { width: number; height: number; qrSize: number; nameSize: number };

const LAYOUT: Record<SignageFormat, Layout> = {
  qr: { width: 600, height: 720, qrSize: 440, nameSize: 32 },
  "table-card": { width: 700, height: 500, qrSize: 280, nameSize: 30 },
  poster: { width: 1200, height: 1800, qrSize: 820, nameSize: 56 },
  digital: { width: 1080, height: 1080, qrSize: 620, nameSize: 44 },
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
    margin: 1,
    width: sizePx,
    color: { dark: "#1a1a1a", light: "#fdfaf5" },
  });
}

export async function renderEventSignageSvg(
  format: SignageFormat,
  input: { eventName: string; captureUrl: string },
): Promise<string> {
  const layout = LAYOUT[format];
  const qr = await qrDataUri(input.captureUrl, layout.qrSize);
  const qrX = (layout.width - layout.qrSize) / 2;
  const qrY = 40 + layout.nameSize + 30;
  const name = escapeXml(input.eventName);
  const instructionY = qrY + layout.qrSize + 55;
  const reassuranceY = instructionY + 38;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${layout.width}" height="${layout.height}" viewBox="0 0 ${layout.width} ${layout.height}">
  <rect width="100%" height="100%" fill="#fdfaf5" />
  <text x="50%" y="${40 + layout.nameSize}" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="${layout.nameSize}" fill="#1a1a1a">${name}</text>
  <image x="${qrX}" y="${qrY}" width="${layout.qrSize}" height="${layout.qrSize}" href="${qr}" />
  <text x="50%" y="${instructionY}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="30" fill="#1a1a1a">${escapeXml(GUEST_INSTRUCTION)}</text>
  <text x="50%" y="${reassuranceY}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="20" fill="#6b6b6b">${escapeXml(NO_APP_REASSURANCE)}</text>
</svg>`;
}
