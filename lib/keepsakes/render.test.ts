import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { renderFullSetKeepsakeJpeg, renderSingleKeepsakeJpeg } from "./render";
import { FULL_SET_STYLES, SINGLE_STYLES } from "./styles";

/**
 * The export pipeline end to end, without a database: every Single-photo style renders a
 * 1080 × 1350 JPEG with no metadata from portrait, landscape and square photos, with and without
 * theme image, message and hashtag; an unusable theme image falls back to the no-image treatment.
 */

async function photo(width: number, height: number) {
  return sharp({ create: { width, height, channels: 3, background: { r: 120, g: 90, b: 160 } } })
    .jpeg()
    .withExif({ IFD0: { Artist: "PRIVATE-EXIF-MARKER" } })
    .toBuffer();
}

const EVENT = { name: "Dani’s 40th", event_date: "2026-10-18", hashtag: "DaniTurns40", accent_color: "marigold" };
const BARE = { name: "Leo’s Graduation Party", event_date: null, hashtag: null, accent_color: "violet" };

describe("Single-photo export", () => {
  it("renders every style, every orientation, as a metadata-free 1080 × 1350 JPEG", async () => {
    const theme = await photo(1600, 1200);
    const sources = [await photo(1200, 1600), await photo(1600, 1067), await photo(1400, 1400)];
    for (const { id } of SINGLE_STYLES) {
      for (const [i, source] of sources.entries()) {
        const jpeg = await renderSingleKeepsakeJpeg({
          event: i === 1 ? BARE : EVENT,
          style: id,
          photo: source,
          message: i === 0 ? "Best. Cake. Ever." : null,
          themeImage: i === 2 ? null : theme,
        });
        const meta = await sharp(jpeg).metadata();
        expect(meta.format).toBe("jpeg");
        expect([meta.width, meta.height]).toEqual([1080, 1350]);
        expect(meta.exif).toBeUndefined();
        expect(jpeg.includes(Buffer.from("PRIVATE-EXIF-MARKER"))).toBe(false);
        expect(jpeg.length).toBeLessThan(600 * 1024);
      }
    }
  }, 60_000);

  it("renders the no-image treatment when the theme image can't be decoded", async () => {
    const jpeg = await renderSingleKeepsakeJpeg({
      event: EVENT,
      style: "poster",
      photo: await photo(1200, 1600),
      message: null,
      themeImage: Buffer.from("not an image"),
    });
    expect((await sharp(jpeg).metadata()).width).toBe(1080);
  });

  it("never modifies the source bytes it is given", async () => {
    const source = await photo(1200, 1600);
    const copy = Buffer.from(source);
    await renderSingleKeepsakeJpeg({ event: EVENT, style: "album", photo: source, message: "hi", themeImage: null });
    expect(source.equals(copy)).toBe(true);
  });
});

describe("Full Set export", () => {
  it("renders every style from a mixed set as a metadata-free 1200 × 1800 JPEG under ~800 KB", async () => {
    const five = [await photo(1200, 1600), await photo(1600, 1200), await photo(900, 1600), await photo(1600, 900), await photo(1400, 1400)];
    const theme = await photo(2400, 1600);
    for (const { id } of FULL_SET_STYLES) {
      for (const [event, themeImage] of [[EVENT, theme], [BARE, null]] as const) {
        const jpeg = await renderFullSetKeepsakeJpeg({ event, style: id, photos: five, themeImage });
        const meta = await sharp(jpeg).metadata();
        expect([meta.format, meta.width, meta.height]).toEqual(["jpeg", 1200, 1800]);
        expect(meta.exif).toBeUndefined();
        expect(jpeg.length).toBeLessThan(800 * 1024);
      }
    }
  }, 120_000);

  it("refuses four or six photos", async () => {
    const p = await photo(100, 100);
    await expect(renderFullSetKeepsakeJpeg({ event: EVENT, style: "grid", photos: [p, p, p, p], themeImage: null })).rejects.toThrow();
    await expect(renderFullSetKeepsakeJpeg({ event: EVENT, style: "grid", photos: [p, p, p, p, p, p], themeImage: null })).rejects.toThrow();
  });

  /**
   * Regression (Slice 16): Satori draws nothing for an absolute box sized in percent, which once
   * left Spotlight's no-image band white (so its white name vanished) and dropped the Strip scrim
   * and the Prints wash. Every full-bleed layer must actually paint.
   */
  it("paints Spotlight's identity band without a theme image", async () => {
    const white = await sharp({ create: { width: 800, height: 800, channels: 3, background: "#ffffff" } }).jpeg().toBuffer();
    const jpeg = await renderFullSetKeepsakeJpeg({ event: BARE, style: "spotlight", photos: [white, white, white, white, white], themeImage: null });
    const { data } = await sharp(jpeg).extract({ left: 20, top: 1780, width: 1, height: 1 }).raw().toBuffer({ resolveWithObject: true });
    expect(Math.max(...data)).toBeLessThan(60);
  });
});
