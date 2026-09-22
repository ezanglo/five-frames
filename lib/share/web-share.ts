/**
 * The pure decision logic behind the guest sharing flow's "use the Web Share API where
 * available, fall back to download otherwise" rule (product.md §10). Kept free of any direct
 * `navigator`/`document` reference so it can run in a plain Node test environment (no jsdom in
 * this project) with an injected capability object standing in for the real browser — the
 * thing this repo's tooling cannot exercise is real Safari/Android Web Share behavior itself,
 * which is why that stays on the human-verification checklist instead.
 */

export type ShareCapability = {
  canShareFiles: (file: File) => boolean;
  share: (file: File, title: string) => Promise<void>;
  downloadBlob: (blob: Blob, filename: string) => void;
};

export type ShareResult = "shared" | "downloaded" | "cancelled";

/**
 * Never throws: a share failure (including the user cancelling the native share sheet) always
 * falls through to the download fallback rather than leaving the guest with nothing, and never
 * touches the underlying capture — this function only ever reads the already-generated blob.
 */
export async function shareOrDownload(
  blob: Blob,
  filename: string,
  title: string,
  capability: ShareCapability,
): Promise<ShareResult> {
  const file = new File([blob], filename, { type: blob.type || "image/png" });

  if (capability.canShareFiles(file)) {
    try {
      await capability.share(file, title);
      return "shared";
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return "cancelled";
      }
      // Any other native-share failure falls back to download rather than surfacing an error
      // for something the guest's own capture was never at risk from.
    }
  }

  capability.downloadBlob(blob, filename);
  return "downloaded";
}

/** The real browser-backed capability, used everywhere outside tests. */
export function browserShareCapability(): ShareCapability {
  return {
    canShareFiles: (file) =>
      typeof navigator !== "undefined" &&
      typeof navigator.canShare === "function" &&
      navigator.canShare({ files: [file] }),
    share: async (file, title) => {
      await navigator.share({ files: [file], title });
    },
    downloadBlob: (blob, filename) => {
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    },
  };
}
