import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { GUEST_FIVE, OCCASION_PHOTOS, SAMPLE_THEME_PHOTO, galleryPhoto, photoSrc } from "./photos";

/**
 * Marketing photos are local files with a recorded source (docs/asset-credits.md). These keep
 * the registry, the files on disk and the credits record from drifting apart, so a swap can't
 * ship a broken image, a wrong aspect ratio or an uncredited photo.
 */

const ROOT = path.resolve(import.meta.dirname, "../..");
const ALL = [
  ...GUEST_FIVE,
  ...Object.values(OCCASION_PHOTOS),
  SAMPLE_THEME_PHOTO,
  ...Array.from({ length: 16 }, (_, i) => galleryPhoto(i)),
].filter((photo, index, list) => list.findIndex((p) => p.file === photo.file) === index);

describe("marketing photos", () => {
  it.each(ALL.map((photo) => [photo.file, photo] as const))("%s ships at both sizes, as recorded", async (_, photo) => {
    for (const width of [480, 960] as const) {
      expect(existsSync(path.join(ROOT, "public", photoSrc(photo, width)))).toBe(true);
    }
    const meta = await sharp(path.join(ROOT, "public", photoSrc(photo, 960))).metadata();
    expect([meta.width, meta.height]).toEqual([photo.width, photo.height]);
    expect(meta.exif).toBeUndefined();
  });

  it("credits every photo", () => {
    const credits = readFileSync(path.join(ROOT, "docs/asset-credits.md"), "utf8");
    for (const photo of ALL) expect(credits).toContain(`\`${photo.file}\``);
  });

  it("is only ever served from this site, never hotlinked", () => {
    for (const photo of ALL) expect(photoSrc(photo)).toMatch(/^\/marketing\/photos\//);
  });

  it("gives every photo alt text and a crop focus", () => {
    for (const photo of ALL) {
      expect(photo.alt.trim()).not.toBe("");
      expect(photo.focus).toMatch(/^\d+% \d+%$/);
    }
  });
});
