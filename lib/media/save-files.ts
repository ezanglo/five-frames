/**
 * Saves several originals one after another from short-lived signed URLs (decision D11: client
 * driven, sequential, no ZIP). Used by the host's "Download all" and the guest's "Download my
 * photos".
 *
 * Each file is fetched in full, then saved from a same-origin blob URL, and only then does the
 * next one start. The earlier approach clicked a cross-origin link every few hundred ms. Browsers
 * ignore `download` on a cross-origin link, so each click was a navigation of the page, and a new
 * one cancelled any earlier one whose response hadn't arrived yet: headed Chromium saved 2 of 6
 * while the page said "Saved 6" (HOST-10).
 *
 * What the page can know: that it fetched each file and handed it to the browser to save. It
 * can't see whether the browser then kept it (a "download multiple files" prompt the person
 * declined, for instance), so the copy says "sent to your downloads", never "saved".
 */

export type SaveItem = { url: string; filename: string };
export type SaveOutcome = { sent: number; failed: number; total: number };

/** Hands one fetched file to the browser's own download. */
export function saveBlob(blob: Blob, filename: string): void {
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Revoking at once can cancel the save in some browsers; the blob is only needed briefly.
  setTimeout(() => URL.revokeObjectURL(href), 60_000);
}

export async function saveFilesOneByOne(
  items: SaveItem[],
  options: {
    onProgress?: (current: number, total: number) => void;
    fetchFile?: (url: string) => Promise<Response>;
    save?: (blob: Blob, filename: string) => void;
  } = {},
): Promise<SaveOutcome> {
  const fetchFile = options.fetchFile ?? ((url: string) => fetch(url));
  const save = options.save ?? saveBlob;
  let sent = 0;
  let failed = 0;

  for (const [index, item] of items.entries()) {
    options.onProgress?.(index + 1, items.length);
    try {
      const response = await fetchFile(item.url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      save(await response.blob(), item.filename);
      sent += 1;
    } catch {
      failed += 1;
    }
  }

  return { sent, failed, total: items.length };
}

/**
 * The filename a signed original URL was minted with (`createSignedReadUrl`'s `download`
 * parameter), so a guest's photos save under the same names a single download uses.
 */
export function filenameFromSignedUrl(url: string, fallback: string): string {
  try {
    return new URL(url).searchParams.get("download") || fallback;
  } catch {
    return fallback;
  }
}

export function progressNote(current: number, total: number): string {
  return `Downloading ${current} of ${total}… If your browser asks, allow multiple downloads.`;
}

export function outcomeNote(outcome: SaveOutcome, noun: { one: string; many: string }): string {
  const word = (n: number) => (n === 1 ? noun.one : noun.many);
  if (outcome.failed === 0) {
    return `${outcome.sent} ${word(outcome.sent)} sent to your downloads.`;
  }
  return `${outcome.sent} of ${outcome.total} ${word(outcome.total)} sent to your downloads. ${outcome.failed} didn’t download — try again.`;
}
