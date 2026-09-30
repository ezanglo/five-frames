import "server-only";

import sharp, { type Metadata } from "sharp";
import {
  THEME_IMAGE_MAX_BYTES,
  THEME_IMAGE_MAX_LONG_EDGE,
  THEME_IMAGE_MAX_PIXELS,
  THEME_IMAGE_MIN_SHORT_EDGE,
  THEME_IMAGE_RECOMMENDED_LONG_EDGE,
  type ThemeImageRefusal,
} from "@/lib/theme/image";

export type NormalizedThemeImage = {
  ok: true;
  buffer: Buffer;
  contentType: "image/jpeg" | "image/png";
  extension: "jpg" | "png";
  width: number;
  height: number;
  /** Long edge under the recommended size: accepted, but the poster may print soft. */
  small: boolean;
};

export type ThemeImageNormalization = NormalizedThemeImage | { ok: false; reason: ThemeImageRefusal };

/** Formats identified by decoding the bytes themselves, never by the declared MIME type. */
const ACCEPTED_FORMATS = new Set(["jpeg", "png", "webp"]);

/** APNG carries an `acTL` chunk before the first `IDAT`; libvips reads only the first frame. */
function isAnimatedPng(buffer: Buffer): boolean {
  const idat = buffer.indexOf("IDAT", 8, "latin1");
  const actl = buffer.indexOf("acTL", 8, "latin1");
  return actl !== -1 && (idat === -1 || actl < idat);
}

/**
 * Validates and normalizes an uploaded theme image (architecture §7a "Commit"). The result is
 * the only authoritative theme image: auto-oriented, every metadata block stripped (EXIF, GPS,
 * XMP, IPTC and the ICC profile, after conversion to sRGB), resized to a ≤ 2400 px long edge,
 * and re-encoded as JPEG — or PNG only when the source actually has transparent pixels.
 *
 * Refused: anything whose decoded format isn't JPEG/PNG/WebP (SVG, GIF, TIFF/RAW, PDF, video,
 * text with a spoofed type), HEIC/HEIF of any coding (not supported in MVP — the deployed `sharp`
 * has no HEVC decoder; architecture §7a), any animation or multi-frame/multi-page image, sources
 * over 15 MB or ~40 MP, and anything with a shortest edge under 600 px. A refusal never touches the
 * current theme image; the caller decides what to keep.
 */
export async function normalizeThemeImage(input: Buffer): Promise<ThemeImageNormalization> {
  if (input.length > THEME_IMAGE_MAX_BYTES) return { ok: false, reason: "too_large" };

  let metadata: Metadata;
  try {
    // limitInputPixels makes libvips refuse an oversized image before decoding its pixels.
    metadata = await sharp(input, { limitInputPixels: THEME_IMAGE_MAX_PIXELS }).metadata();
  } catch {
    return { ok: false, reason: "unsupported" };
  }

  // Reading the header is enough to recognise HEIC/HEIF, so it is refused before any decode.
  if (metadata.format === "heif") return { ok: false, reason: "heic" };
  if (!metadata.format || !ACCEPTED_FORMATS.has(metadata.format)) {
    return { ok: false, reason: "unsupported" };
  }
  if ((metadata.pages ?? 1) > 1) return { ok: false, reason: "animated" };
  if (metadata.format === "png" && isAnimatedPng(input)) return { ok: false, reason: "animated" };

  const width = metadata.autoOrient?.width ?? metadata.width;
  const height = metadata.autoOrient?.height ?? metadata.height;
  if (!width || !height) return { ok: false, reason: "unsupported" };
  if (width * height > THEME_IMAGE_MAX_PIXELS) return { ok: false, reason: "too_many_pixels" };
  if (Math.min(width, height) < THEME_IMAGE_MIN_SHORT_EDGE) return { ok: false, reason: "too_small" };

  try {
    const source = () =>
      sharp(input, { limitInputPixels: THEME_IMAGE_MAX_PIXELS, failOn: "error" })
        .rotate()
        .resize({
          width: THEME_IMAGE_MAX_LONG_EDGE,
          height: THEME_IMAGE_MAX_LONG_EDGE,
          fit: "inside",
          withoutEnlargement: true,
        });

    const transparent = metadata.hasAlpha ? !(await sharp(input).stats()).isOpaque : false;

    // sharp writes no metadata unless asked (no withMetadata/keepExif), so nothing from the
    // source's EXIF/GPS block survives into the stored image.
    const { data, info } = transparent
      ? await source().png({ compressionLevel: 9 }).toBuffer({ resolveWithObject: true })
      : await source()
          .flatten({ background: "#ffffff" })
          .jpeg({ quality: 85, mozjpeg: true })
          .toBuffer({ resolveWithObject: true });

    return {
      ok: true,
      buffer: data,
      contentType: transparent ? "image/png" : "image/jpeg",
      extension: transparent ? "png" : "jpg",
      width: info.width,
      height: info.height,
      small: Math.max(width, height) < THEME_IMAGE_RECOMMENDED_LONG_EDGE,
    };
  } catch {
    return { ok: false, reason: "unsupported" };
  }
}
