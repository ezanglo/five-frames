/**
 * Theme image limits (architecture §7a). Shared by the server normalizer and the host upload
 * control, so this file has no `server-only` import and no secrets. The bucket enforces the
 * size and MIME list at upload time; the server re-validates everything on commit.
 */

export const EVENT_THEME_BUCKET = "event-theme";

export const THEME_IMAGE_MAX_BYTES = 15 * 1024 * 1024;
/** Decode cap (~40 MP): refuse anything larger before it is fully decoded. */
export const THEME_IMAGE_MAX_PIXELS = 40_000_000;
export const THEME_IMAGE_MIN_SHORT_EDGE = 600;
/** Below this long edge the image is accepted with a note that the poster may print soft. */
export const THEME_IMAGE_RECOMMENDED_LONG_EDGE = 1600;
/** The stored, normalized image never exceeds this long edge. */
export const THEME_IMAGE_MAX_LONG_EDGE = 2400;

/**
 * Raw formats accepted directly (product.md §10.1). HEIC/HEIF is not: the deployed `sharp` has no
 * HEVC decoder (architecture §7a). An iPhone photo still works when the browser hands it over
 * already converted to JPEG, which is then simply a JPEG.
 */
export const THEME_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

/** HEIC/HEIF as browsers label it; refused up front with its own guidance. */
const HEIC_MIME_TYPES = ["image/heic", "image/heif", "image/heic-sequence", "image/heif-sequence"];

export function isHeicUpload(file: { type: string; name?: string }): boolean {
  const type = file.type.toLowerCase();
  if (HEIC_MIME_TYPES.includes(type)) return true;
  // Some browsers leave a HEIC's type empty; then only the name says what it is.
  return type === "" && /\.(heic|heif)$/i.test(file.name ?? "");
}

export type ThemeImageRefusal =
  | "unsupported"
  | "heic"
  | "animated"
  | "too_large"
  | "too_many_pixels"
  | "too_small"
  | "missing";

/** Calm, host-facing copy. Every refusal says the current image is unchanged (product.md §13). */
export const THEME_IMAGE_REFUSAL_COPY: Record<ThemeImageRefusal, string> = {
  unsupported:
    "We can’t use that file. Choose a still JPG, PNG or WebP image (no videos, GIFs or animated images). Your current image is unchanged.",
  heic: "HEIC and HEIF files aren’t supported. Choose or export the photo as a JPG, PNG or WebP. Your current image is unchanged.",
  animated:
    "That image moves. Choose a still JPG, PNG or WebP image. Your current image is unchanged.",
  too_large: "That file is over 15 MB. Choose a smaller photo. Your current image is unchanged.",
  too_many_pixels:
    "That image is too big to process. Choose a photo under 40 megapixels. Your current image is unchanged.",
  too_small:
    "That image is too small to look good. Choose one at least 600 px on its shortest side. Your current image is unchanged.",
  missing: "That upload didn’t finish. Your current image is unchanged.",
};

/**
 * Fast client-side pre-check, run before anything is uploaded; the server re-checks everything on
 * commit. The declared type decides, not the name: a photo the browser converted to JPEG keeps
 * working even if its name still ends in `.heic`.
 */
export function precheckThemeImageFile(file: { size: number; type: string; name: string }):
  | { ok: true }
  | { ok: false; reason: ThemeImageRefusal } {
  if (isHeicUpload(file)) return { ok: false, reason: "heic" };
  if (!(THEME_IMAGE_MIME_TYPES as readonly string[]).includes(file.type.toLowerCase())) {
    return { ok: false, reason: "unsupported" };
  }
  if (file.size > THEME_IMAGE_MAX_BYTES) return { ok: false, reason: "too_large" };
  return { ok: true };
}
