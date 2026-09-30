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

export const THEME_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
] as const;

export type ThemeImageRefusal =
  | "unsupported"
  | "animated"
  | "too_large"
  | "too_many_pixels"
  | "too_small"
  | "heic_undecodable"
  | "missing";

/** Calm, host-facing copy. Every refusal says the current image is unchanged (product.md §13). */
export const THEME_IMAGE_REFUSAL_COPY: Record<ThemeImageRefusal, string> = {
  unsupported:
    "We can’t use that file. Choose a still JPG, PNG or HEIC photo (no videos, GIFs or animated images). Your current image is unchanged.",
  animated:
    "That image moves. Choose a still JPG, PNG or HEIC photo. Your current image is unchanged.",
  too_large: "That file is over 15 MB. Choose a smaller photo. Your current image is unchanged.",
  too_many_pixels:
    "That image is too big to process. Choose a photo under 40 megapixels. Your current image is unchanged.",
  too_small:
    "That image is too small to look good. Choose one at least 600 px on its shortest side. Your current image is unchanged.",
  heic_undecodable:
    "We couldn’t read that HEIC photo. Try saving it as a JPG first. Your current image is unchanged.",
  missing: "That upload didn’t finish. Your current image is unchanged.",
};

/** Fast client-side pre-check; the server re-checks everything on commit. */
export function precheckThemeImageFile(file: { size: number; type: string; name: string }):
  | { ok: true }
  | { ok: false; reason: ThemeImageRefusal } {
  if (file.size > THEME_IMAGE_MAX_BYTES) return { ok: false, reason: "too_large" };
  const type = file.type.toLowerCase();
  const heicByName = /\.(heic|heif)$/i.test(file.name);
  if (!(THEME_IMAGE_MIME_TYPES as readonly string[]).includes(type) && !(type === "" && heicByName)) {
    return { ok: false, reason: "unsupported" };
  }
  return { ok: true };
}

/** The content type the browser uploads with; some browsers leave HEIC's type empty. */
export function themeUploadContentType(file: { type: string; name: string }): string {
  if (file.type) return file.type.toLowerCase();
  return /\.heif$/i.test(file.name) ? "image/heif" : "image/heic";
}
