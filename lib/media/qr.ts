import "server-only";

import QRCode from "qrcode";

/**
 * On-screen QR for the host dashboard and the Create · Share step. Rendered server-side from the
 * real capture link — callers only pass a link that exists, i.e. after activation (invariant 7).
 * Printable formats still come from the signage route (lib/media/signage.ts).
 */
export async function qrSvgDataUri(url: string): Promise<string> {
  const svg = await QRCode.toString(url, {
    type: "svg",
    margin: 0,
    color: { dark: "#15141A", light: "#FFFFFF" },
  });
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
