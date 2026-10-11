import "server-only";

import { strToU8, zipSync } from "fflate";
import { renderEventSignageSvg, type SignageInput, type SignageQr } from "./signage";
import { isTableNumber } from "./signage-formats";

/**
 * Table-number cards as one download (product.md §11.3, criterion 78; architecture §7c): N cards,
 * `table-01.svg` …, zipped in memory. Every card is the same render with only the number changed,
 * so every card carries the same live QR: there is no per-table link, parameter or record.
 *
 * The response must stay under Vercel's 4.5 MB function limit; `signage.test.ts` holds 100 cards
 * with the longest name and hashtag under 4 MB. If that ever fails, switch to per-card downloads
 * through `lib/media/save-files.ts`, never a larger response.
 */

export type TableNumberCardsInput = Omit<SignageInput, "themeImage" | "tableNumber" | "qr"> & {
  /** Downloads only: a preview is one sample card through the ordinary preview route. */
  qr: Extract<SignageQr, { kind: "live" }>;
};

export function tableCardFilename(tableNumber: number, count: number): string {
  return `table-${String(tableNumber).padStart(Math.max(2, String(count).length), "0")}.svg`;
}

export async function renderTableNumberZip(input: TableNumberCardsInput, count: number): Promise<Uint8Array> {
  if (!isTableNumber(count)) throw new Error("table count must be 1 to 100");
  const files: Record<string, Uint8Array> = {};
  for (let tableNumber = 1; tableNumber <= count; tableNumber++) {
    const svg = await renderEventSignageSvg("table-number", { ...input, themeImage: null, tableNumber });
    files[tableCardFilename(tableNumber, count)] = strToU8(svg);
  }
  return zipSync(files, { level: 9 });
}
