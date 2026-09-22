import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { renderShareCardPng } from "./share-card";

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

async function samplePhoto(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: { r: 168, g: 99, b: 47 } },
  })
    .jpeg()
    .toBuffer();
}

describe("renderShareCardPng", () => {
  it("renders a valid PNG at the fixed canvas size for a landscape photo", async () => {
    const png = await renderShareCardPng({
      eventName: "Ezia's Birthday",
      eventDateLabel: "Sept 20, 2026",
      hashtag: "EziaTurns30",
      message: "best night ever",
      photoBuffer: await samplePhoto(1600, 900),
    });

    expect(png.subarray(0, 4)).toEqual(PNG_MAGIC);
    const metadata = await sharp(png).metadata();
    expect(metadata.width).toBe(1080);
    expect(metadata.height).toBe(1356);
  });

  it("handles a portrait photo without throwing (arbitrary aspect ratio safety)", async () => {
    const png = await renderShareCardPng({
      eventName: "Matty's Birthday",
      eventDateLabel: null,
      hashtag: null,
      message: null,
      photoBuffer: await samplePhoto(900, 1600),
    });
    expect(png.subarray(0, 4)).toEqual(PNG_MAGIC);
  });

  it("handles a square photo without throwing (arbitrary aspect ratio safety)", async () => {
    const png = await renderShareCardPng({
      eventName: "Square Event",
      eventDateLabel: null,
      hashtag: null,
      message: null,
      photoBuffer: await samplePhoto(1000, 1000),
    });
    expect(png.subarray(0, 4)).toEqual(PNG_MAGIC);
  });

  it("does not throw for a long message, long name, or a bare hashtag with a leading #", async () => {
    const png = await renderShareCardPng({
      eventName: "A".repeat(120),
      eventDateLabel: "Jan 1, 2027",
      hashtag: "#AlreadyHashed",
      message: "M".repeat(280),
      photoBuffer: await samplePhoto(1200, 1200),
    });
    expect(png.subarray(0, 4)).toEqual(PNG_MAGIC);
  });
});
