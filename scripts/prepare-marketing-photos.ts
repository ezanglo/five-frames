/**
 * Prepares the marketing site's photographs (lib/marketing/photos.ts, docs/asset-credits.md).
 *
 *   pnpm tsx scripts/prepare-marketing-photos.ts <source-dir>
 *
 * Every JPEG/PNG/WebP in <source-dir> must be named after its registry file name (e.g.
 * `guest-birthday-candles.jpg`). Each one is written to public/marketing/photos/ as WebP at 480
 * and 960 px wide (never upscaled): rotated upright, with all metadata stripped, so no camera
 * EXIF or location ever ships. The 960 output's size is printed for the registry. To swap in
 * pilot-event photos later, run this on the new files and update the registry entries.
 */
import { mkdirSync, readdirSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const WIDTHS = [480, 960] as const;
const OUT = path.resolve(import.meta.dirname, "../public/marketing/photos");

async function main() {
  const source = process.argv[2];
  if (!source) throw new Error("Usage: pnpm tsx scripts/prepare-marketing-photos.ts <source-dir>");
  mkdirSync(OUT, { recursive: true });

  const files = readdirSync(source).filter((file) => /\.(jpe?g|png|webp)$/i.test(file));
  for (const file of files) {
    const name = file.replace(/\.[^.]+$/, "");
    for (const width of WIDTHS) {
      const info = await sharp(path.join(source, file))
        .rotate()
        .resize({ width, withoutEnlargement: true })
        .webp({ quality: 72, effort: 6 })
        .toFile(path.join(OUT, `${name}-${width}.webp`));
      if (width === 960) console.log(`${name}: ${info.width}×${info.height} (${Math.round(info.size / 1024)} KB)`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
