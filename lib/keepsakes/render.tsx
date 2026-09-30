import "server-only";

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import { ImageResponse } from "next/og";
import type { ReactElement } from "react";
import { coverCrop, CENTER_FOCUS, FULL_SET_FOCUS, type CropFocus } from "./crop";
import {
  buildFullSetKeepsakeInput,
  buildKeepsakeContext,
  buildSingleKeepsakeInput,
  type KeepsakeEventSource,
  type KeepsakeImageRef,
} from "./context";
import {
  FULL_SET_CANVAS,
  FULL_SET_SLOTS,
  singlePhotoWindow,
  SINGLE_CANVAS,
  THEME_IMAGE_BOXES,
  type Box,
} from "./geometry";
import type { FullSetStyleId, SingleStyleId } from "./styles";
import { FULL_SET_SHADOWS, FullSetKeepsake, type FullSetShadowSprites } from "./templates/full-set";
import { shadowPad, type ShadowSpec } from "./templates/parts";
import { SingleKeepsake } from "./templates/single";

/**
 * The keepsake export pipeline (architecture §7b, decisions D19/D20): prepare each image for the
 * exact box its template draws it in (`coverCrop` + resize, so the server crop is the preview's
 * `object-position` crop), compose the template with `next/og`'s `ImageResponse` (Satori +
 * resvg) at the family canvas, then re-encode the PNG as JPEG with `sharp` (quality 88, no
 * metadata). Nothing here reads an original or writes anything anywhere: input bytes in, JPEG out.
 */

const FONT_DIR = join(process.cwd(), "lib/media/fonts");

type FontSpec = { name: string; data: ArrayBuffer; weight: 500 | 600 | 700 | 800; style: "normal" };

let fontsPromise: Promise<FontSpec[]> | null = null;

function loadFonts(): Promise<FontSpec[]> {
  fontsPromise ??= (async () => {
    const file = async (name: string) => {
      const buffer = await readFile(join(FONT_DIR, name));
      return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
    };
    const [fraunces, j500, j600, j700, j800] = await Promise.all([
      file("fraunces-600.ttf"),
      file("plus-jakarta-sans-500.ttf"),
      file("plus-jakarta-sans-600.ttf"),
      file("plus-jakarta-sans-700.ttf"),
      file("plus-jakarta-sans-800.ttf"),
    ]);
    return [
      { name: "Fraunces", data: fraunces, weight: 600, style: "normal" },
      { name: "Plus Jakarta Sans", data: j500, weight: 500, style: "normal" },
      { name: "Plus Jakarta Sans", data: j600, weight: 600, style: "normal" },
      { name: "Plus Jakarta Sans", data: j700, weight: 700, style: "normal" },
      { name: "Plus Jakarta Sans", data: j800, weight: 800, style: "normal" },
    ];
  })();
  return fontsPromise;
}

/** Upright pixel dimensions of an image (display derivatives are already auto-oriented). */
export async function imageSize(bytes: Buffer): Promise<{ width: number; height: number }> {
  const meta = await sharp(bytes).metadata();
  const upright = (meta.orientation ?? 1) >= 5;
  const width = (upright ? meta.height : meta.width) ?? 1;
  const height = (upright ? meta.width : meta.height) ?? 1;
  return { width, height };
}

/**
 * Crops and resizes `bytes` to exactly `box` with the CSS cover rule and `focus`, as a JPEG data
 * URI for the template. Never mutates the source; the result exists only inside this render.
 */
export async function prepareImage(
  bytes: Buffer,
  box: Box,
  focus: CropFocus = CENTER_FOCUS,
): Promise<KeepsakeImageRef> {
  const image = sharp(bytes).rotate();
  const { width, height } = await imageSize(bytes);
  const rect = coverCrop(width, height, box.width, box.height, focus);
  const out = await image
    .extract(rect)
    .resize(box.width, box.height, { fit: "fill" })
    .jpeg({ quality: 90 })
    .toBuffer();
  return { src: `data:image/jpeg;base64,${out.toString("base64")}` };
}

/** Satori → PNG → JPEG. `sharp` writes no EXIF/ICC/XMP unless asked, so the output carries none. */
export async function composeJpeg(element: ReactElement, canvas: Box): Promise<Buffer> {
  const response = new ImageResponse(element, {
    width: canvas.width,
    height: canvas.height,
    fonts: await loadFonts(),
  });
  const png = Buffer.from(await response.arrayBuffer());
  return sharp(png).flatten({ background: "#FFFFFF" }).jpeg({ quality: 88, chromaSubsampling: "4:2:0" }).toBuffer();
}

/** The theme image for one style's box, or null (the style's no-image treatment) if unusable. */
async function themeImageFor(styleId: keyof typeof THEME_IMAGE_BOXES, themeBytes: Buffer | null) {
  const box = THEME_IMAGE_BOXES[styleId];
  if (!box || !themeBytes) return null;
  try {
    return await prepareImage(themeBytes, box, box.focus);
  } catch (error) {
    // Architecture §7b failure semantics: a missing or undecodable theme image renders the
    // style's no-image treatment (every style is complete without one) and is logged.
    console.warn("keepsake: theme image unusable, rendering without it", error);
    return null;
  }
}

export type SingleRenderSource = {
  event: KeepsakeEventSource;
  style: SingleStyleId;
  /** The capture's display derivative. */
  photo: Buffer;
  message: string | null;
  themeImage: Buffer | null;
};

export async function renderSingleKeepsakeJpeg(source: SingleRenderSource): Promise<Buffer> {
  const { width, height } = await imageSize(source.photo);
  const window = singlePhotoWindow(source.style, width, height);
  const [photo, theme] = await Promise.all([
    prepareImage(source.photo, window),
    themeImageFor(source.style, source.themeImage),
  ]);
  const input = buildSingleKeepsakeInput(
    buildKeepsakeContext(source.event, theme),
    source.style,
    { src: photo.src, width, height },
    source.message,
  );
  return composeJpeg(<SingleKeepsake input={input} target="export" />, SINGLE_CANVAS);
}

/**
 * A drop shadow as a pre-blurred PNG (see ShadowedBox): each layer is the box, offset and blurred
 * with σ = blur / 2 exactly as CSS does it, composited in order. Depends only on the fixed spec,
 * so it is made once per server instance.
 */
const spriteCache = new Map<ShadowSpec, Promise<string>>();

function shadowSprite(spec: ShadowSpec): Promise<string> {
  let sprite = spriteCache.get(spec);
  if (!sprite) {
    sprite = (async () => {
      const pad = shadowPad(spec);
      const width = spec.width + 2 * pad;
      const height = spec.height + 2 * pad;
      const layers = await Promise.all(
        spec.layers.map((layer) => {
          const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect x="${pad}" y="${pad + layer.y}" width="${spec.width}" height="${spec.height}" rx="${spec.radius}" fill="rgb(${layer.rgb.join(",")})" fill-opacity="${layer.alpha}"/></svg>`;
          return sharp(Buffer.from(svg)).blur(Math.max(0.3, layer.blur / 2)).png().toBuffer();
        }),
      );
      const png = await sharp({ create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
        .composite(layers.map((input) => ({ input })))
        .png()
        .toBuffer();
      return `data:image/png;base64,${png.toString("base64")}`;
    })();
    spriteCache.set(spec, sprite);
  }
  return sprite;
}

async function fullSetShadowSprites(): Promise<FullSetShadowSprites> {
  const [stripPaper, print] = await Promise.all([shadowSprite(FULL_SET_SHADOWS.stripPaper), shadowSprite(FULL_SET_SHADOWS.print)]);
  return { stripPaper, print };
}

export type FullSetRenderSource = {
  event: KeepsakeEventSource;
  style: FullSetStyleId;
  /** Exactly five display derivatives, in canonical order. */
  photos: readonly Buffer[];
  themeImage: Buffer | null;
};

/**
 * A Full Set: each of the five display derivatives is cover-cropped (`coverCrop`, focus
 * `50% 30%`) and resized to its slot's pixel box before composition, so Satori embeds five
 * slot-sized images rather than five 1600 px ones. The crops exist only inside this render.
 */
export async function renderFullSetKeepsakeJpeg(source: FullSetRenderSource): Promise<Buffer> {
  if (source.photos.length !== 5) throw new RangeError("A Full Set is made from exactly five photos");
  const slots = FULL_SET_SLOTS[source.style];
  const [shadows, theme, ...photos] = await Promise.all([
    fullSetShadowSprites(),
    themeImageFor(source.style, source.themeImage),
    ...source.photos.map((bytes, i) => prepareImage(bytes, slots[i], FULL_SET_FOCUS)),
  ]);
  const input = buildFullSetKeepsakeInput(buildKeepsakeContext(source.event, theme as KeepsakeImageRef | null), source.style, photos as KeepsakeImageRef[]);
  return composeJpeg(<FullSetKeepsake input={input} target="export" shadows={shadows as FullSetShadowSprites} />, FULL_SET_CANVAS);
}
