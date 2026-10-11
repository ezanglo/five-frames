import { readFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { LINK_PREVIEW_SIZE, renderLinkPreviewJpeg } from "./link-preview";

/** The link preview renders at the Open Graph size with and without a theme image. */

const OUT = process.env.LINK_PREVIEW_OUT;

async function render(themeImage: Buffer | null, eventName: string, name: string) {
  const jpeg = await renderLinkPreviewJpeg({
    eventName,
    kicker: "Photo gallery",
    dateLabel: "Sun, Oct 18, 2026",
    themeImage,
  });
  if (OUT) await sharp(jpeg).toFile(join(OUT, `${name}.jpg`));
  return jpeg;
}

describe("link preview image", () => {
  it("renders a 1200 × 630 JPEG with the theme image, without it, and with a broken one", async () => {
    const theme = await readFile(join(process.cwd(), "test/fixtures/theme-sample-transcoded.jpg"));
    const long = "The Annual Santos–Reyes Family Reunion and Grandma Lita’s Ninetieth Birthday Celebration";
    for (const [name, jpeg] of [
      ["with-theme", await render(theme, "Maria & Jon’s Wedding", "with-theme")],
      ["no-theme", await render(null, long, "no-theme")],
      ["broken-theme", await render(Buffer.from("not an image"), "Dani’s 40th", "broken-theme")],
    ] as const) {
      const meta = await sharp(jpeg).metadata();
      expect([name, meta.format, meta.width, meta.height]).toEqual([
        name,
        "jpeg",
        LINK_PREVIEW_SIZE.width,
        LINK_PREVIEW_SIZE.height,
      ]);
    }
  }, 30_000);
});
