import { readFileSync } from "node:fs";
import path from "node:path";
import { crc32 } from "node:zlib";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { normalizeThemeImage } from "./theme-image";

function solid(width: number, height: number, channels: 3 | 4 = 3, alpha = 1) {
  return sharp({
    create: {
      width,
      height,
      channels,
      background: channels === 4 ? { r: 200, g: 120, b: 60, alpha } : "#c87a3c",
    },
  });
}

/** Inserts a (valid-CRC) `acTL` chunk after IHDR, which is what makes a PNG an APNG. */
function toApng(png: Buffer): Buffer {
  const data = Buffer.alloc(8);
  data.writeUInt32BE(2, 0); // num_frames
  data.writeUInt32BE(0, 4); // num_plays
  const type = Buffer.from("acTL", "latin1");
  const chunk = Buffer.alloc(12 + data.length);
  chunk.writeUInt32BE(data.length, 0);
  type.copy(chunk, 4);
  data.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(Buffer.concat([type, data])) >>> 0, 8 + data.length);
  const ihdrEnd = 8 + 8 + 13 + 4;
  return Buffer.concat([png.subarray(0, ihdrEnd), chunk, png.subarray(ihdrEnd)]);
}

describe("normalizeThemeImage", () => {
  it("accepts a JPEG and strips every metadata block, including GPS", async () => {
    const input = await solid(2000, 1500)
      .jpeg()
      .withExif({
        IFD0: { Make: "Phone", Model: "Camera", Copyright: "Host" },
        IFD3: { GPSLatitudeRef: "N", GPSLatitude: "14/1 35/1 0/1" },
      })
      .toBuffer();
    expect((await sharp(input).metadata()).exif).toBeDefined();

    const result = await normalizeThemeImage(input);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.contentType).toBe("image/jpeg");
    const out = await sharp(result.buffer).metadata();
    expect(out.format).toBe("jpeg");
    expect(out.exif).toBeUndefined();
    expect(out.xmp).toBeUndefined();
    expect(out.iptc).toBeUndefined();
    expect(out.icc).toBeUndefined();
    expect(result.buffer.includes(Buffer.from("Camera"))).toBe(false);
  });

  it("auto-orients from EXIF so the stored image is upright", async () => {
    const input = await solid(1800, 1200).jpeg().withMetadata({ orientation: 6 }).toBuffer();
    const result = await normalizeThemeImage(input);
    expect(result.ok && [result.width, result.height]).toEqual([1200, 1800]);
    if (!result.ok) return;
    expect((await sharp(result.buffer).metadata()).orientation).toBeUndefined();
  });

  it("resizes to a 2400 px long edge and never enlarges", async () => {
    const big = await normalizeThemeImage(await solid(4800, 3200).jpeg().toBuffer());
    expect(big.ok && [big.width, big.height]).toEqual([2400, 1600]);
    const modest = await normalizeThemeImage(await solid(1000, 800).png().toBuffer());
    expect(modest.ok && [modest.width, modest.height]).toEqual([1000, 800]);
  });

  it("flags a long edge under 1600 px as small but still accepts it", async () => {
    const small = await normalizeThemeImage(await solid(1200, 800).jpeg().toBuffer());
    expect(small.ok && small.small).toBe(true);
    const fine = await normalizeThemeImage(await solid(1600, 900).jpeg().toBuffer());
    expect(fine.ok && fine.small).toBe(false);
  });

  it("keeps PNG only when the source actually has transparent pixels", async () => {
    const transparent = await normalizeThemeImage(await solid(900, 900, 4, 0.4).png().toBuffer());
    expect(transparent.ok && transparent.contentType).toBe("image/png");
    const opaqueAlpha = await normalizeThemeImage(await solid(900, 900, 4, 1).png().toBuffer());
    expect(opaqueAlpha.ok && opaqueAlpha.contentType).toBe("image/jpeg");
  });

  it("accepts a static WebP", async () => {
    const result = await normalizeThemeImage(await solid(1200, 900).webp().toBuffer());
    expect(result.ok && result.contentType).toBe("image/jpeg");
  });

  it("accepts a decodable HEIF container (AV1-coded)", async () => {
    const heif = await solid(1200, 900).heif({ compression: "av1" }).toBuffer();
    const result = await normalizeThemeImage(heif);
    expect(result.ok && result.contentType).toBe("image/jpeg");
  });

  it("routes a real HEVC HEIC through the HEIF branch and refuses it calmly on this runtime", async () => {
    // A genuine HEVC HEIC made by macOS `sips` (test/fixtures). sharp's prebuilt libvips parses
    // it (format heif, compression hevc) but ships no HEVC decoder, so decode fails. If a future
    // runtime can decode HEVC, the same call starts succeeding and this test still passes.
    const heic = readFileSync(path.resolve(import.meta.dirname, "../../test/fixtures/theme-sample.heic"));
    const meta = await sharp(heic).metadata();
    expect([meta.format, meta.compression]).toEqual(["heif", "hevc"]);

    const result = await normalizeThemeImage(heic);
    if (result.ok) {
      expect(result.contentType).toBe("image/jpeg");
    } else {
      expect(result.reason).toBe("heic_undecodable");
    }
  });

  it("refuses SVG, even though libvips could rasterize it", async () => {
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900"><script>alert(1)</script><rect width="1200" height="900"/></svg>',
    );
    expect(await normalizeThemeImage(svg)).toEqual({ ok: false, reason: "unsupported" });
  });

  it("refuses GIF, TIFF, PDF and non-image bytes regardless of the declared type", async () => {
    expect(await normalizeThemeImage(await solid(900, 900).gif().toBuffer())).toEqual({
      ok: false,
      reason: "unsupported",
    });
    expect(await normalizeThemeImage(await solid(900, 900).tiff().toBuffer())).toEqual({
      ok: false,
      reason: "unsupported",
    });
    expect(await normalizeThemeImage(Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF"))).toEqual({
      ok: false,
      reason: "unsupported",
    });
    expect(await normalizeThemeImage(Buffer.from("definitely not an image"))).toEqual({
      ok: false,
      reason: "unsupported",
    });
  });

  it("refuses animated WebP and animated PNG", async () => {
    // Two visibly different 900 × 900 frames stacked, encoded as a two-frame animation.
    const width = 900;
    const height = 1800;
    const raw = Buffer.alloc(width * height * 3);
    for (let i = 0; i < width * height; i++) raw[i * 3] = i < width * 900 ? 255 : 0;
    const animatedWebp = await sharp(raw, { raw: { width, height, channels: 3, pageHeight: 900 } })
      .webp()
      .toBuffer();
    expect((await sharp(animatedWebp).metadata()).pages).toBe(2);
    const frame = await solid(900, 900).png().toBuffer();
    expect(await normalizeThemeImage(animatedWebp)).toEqual({ ok: false, reason: "animated" });

    const apng = toApng(frame);
    expect(await normalizeThemeImage(apng)).toEqual({ ok: false, reason: "animated" });
  });

  it("refuses a source over 15 MB before decoding it", async () => {
    expect(await normalizeThemeImage(Buffer.alloc(15 * 1024 * 1024 + 1))).toEqual({
      ok: false,
      reason: "too_large",
    });
  });

  it("refuses images over the ~40 MP decode cap", async () => {
    const huge = await solid(8000, 6000).jpeg({ quality: 30 }).toBuffer();
    const result = await normalizeThemeImage(huge);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(["too_many_pixels", "unsupported"]).toContain(result.reason);
  });

  it("refuses a shortest edge under 600 px", async () => {
    expect(await normalizeThemeImage(await solid(1600, 500).jpeg().toBuffer())).toEqual({
      ok: false,
      reason: "too_small",
    });
  });
});
