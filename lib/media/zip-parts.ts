/**
 * "Download all" as ZIP files (product.md §11.2.3, decision D25, architecture §7 "Bulk
 * download"): how an event's originals split into parts, what the files are called, and which
 * way the browser can write a generated ZIP. Pure, so the server (which signs one part's URLs)
 * and the browser (which lists and builds the parts) agree on the same split.
 */

/** Photos per ZIP part. A product number (§11.2.3), not a tuning knob. */
export const ZIP_PART_SIZE = 500;

export function zipPartCount(total: number): number {
  return Math.ceil(Math.max(0, total) / ZIP_PART_SIZE);
}

/** The gallery-order positions `[start, end)` of one part. Empty when out of range. */
export function zipPartRange(partIndex: number, total: number): { start: number; end: number } {
  if (!Number.isInteger(partIndex) || partIndex < 0) return { start: 0, end: 0 };
  const start = Math.min(partIndex * ZIP_PART_SIZE, Math.max(0, total));
  return { start, end: Math.min(start + ZIP_PART_SIZE, Math.max(0, total)) };
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
}

/**
 * A ZIP is named after the event and its part: `ana-and-ben-photos.zip`, or
 * `ana-and-ben-photos-part-2-of-3.zip` when the event needs more than one.
 */
export function zipFilename(eventName: string, partIndex: number, partCount: number): string {
  const base = `${slug(eventName) || "fiveframes"}-photos`;
  return partCount > 1 ? `${base}-part-${partIndex + 1}-of-${partCount}.zip` : `${base}.zip`;
}

/**
 * The name of one original, inside a ZIP and when saved on its own: its 1-based gallery
 * position across the whole event, then the guest's name. The position makes it unique and
 * keeps file managers sorting in gallery order up to 9,999 photos.
 */
export function originalFilename(
  position: number,
  guestDisplayName: string,
  extension: string,
): string {
  return `${String(position).padStart(4, "0")}-${slug(guestDisplayName) || "guest"}${extension}`;
}

export type ZipWriterKind = "file-system" | "service-worker" | "one-by-one";

/**
 * Feature detection, never the user agent (D25). File System Access writes straight to a file
 * the host picks. A service worker can answer a one-time download URL with the ZIP stream.
 * Without either, a large generated file can't be saved, so the photos go one by one.
 */
export function chooseZipWriter(env: {
  showSaveFilePicker?: unknown;
  serviceWorker?: unknown;
  isSecureContext?: boolean;
  MessageChannel?: unknown;
  ReadableStream?: unknown;
}): ZipWriterKind {
  if (typeof env.ReadableStream !== "function") return "one-by-one";
  if (typeof env.showSaveFilePicker === "function") return "file-system";
  if (env.isSecureContext && env.serviceWorker && typeof env.MessageChannel === "function") {
    return "service-worker";
  }
  return "one-by-one";
}
