/**
 * The keepsake share decision (product.md §10.3, architecture §7b "Prepare before the Share tap").
 * Free of direct `navigator` references so it runs in a plain Node test (no jsdom here) with an
 * injected capability standing in for the browser. Real share-sheet behavior stays on the human
 * device checklist.
 *
 * - `navigator.share` existing is not enough: the browser must say it can share this *file*
 *   (`canShare({ files })`). Otherwise the picker offers Save as the primary action.
 * - `shareFile` must be called synchronously from the tap with bytes already in hand, so the
 *   share sheet opens inside the user gesture.
 * - Cancelling the sheet is not an error.
 */

export type ShareCapability = {
  canShareFiles: (file: File) => boolean;
  share: (file: File, title: string) => Promise<void>;
};

export type ShareResult = "shared" | "cancelled" | "failed";

/** A 1-byte JPEG-typed probe: can this browser share an image file at all? */
export function canShareImageFiles(capability: ShareCapability): boolean {
  try {
    return capability.canShareFiles(new File([new Uint8Array([0xff])], "probe.jpg", { type: "image/jpeg" }));
  } catch {
    return false;
  }
}

/** Never throws. `cancelled` is the guest closing the sheet — say nothing. */
export async function shareFile(
  file: File,
  title: string,
  capability: ShareCapability,
): Promise<ShareResult> {
  if (!capability.canShareFiles(file)) return "failed";
  try {
    await capability.share(file, title);
    return "shared";
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") return "cancelled";
    return "failed";
  }
}

/** The real browser-backed capability, used everywhere outside tests. */
export function browserShareCapability(): ShareCapability {
  return {
    canShareFiles: (file) =>
      typeof navigator !== "undefined" &&
      typeof navigator.share === "function" &&
      typeof navigator.canShare === "function" &&
      navigator.canShare({ files: [file] }),
    share: (file, title) => navigator.share({ files: [file], title }),
  };
}
