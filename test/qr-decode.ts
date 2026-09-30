import jsQR from "jsqr";
import sharp from "sharp";

export type Frame = { x: number; y: number; width: number; height: number };

/**
 * Rasterizes an SVG (librsvg, via sharp) and decodes it with a real QR decoder — the whole
 * image, or only `frame` of it (what a phone pointed at the code sees). Null when nothing decodes.
 */
export async function decodeSvgQr(svg: string, frame?: Frame): Promise<string | null> {
  let image = sharp(Buffer.from(svg));
  if (frame) {
    const png = await image.png().toBuffer();
    image = sharp(png).extract({
      left: Math.max(0, Math.floor(frame.x)),
      top: Math.max(0, Math.floor(frame.y)),
      width: Math.floor(frame.width),
      height: Math.floor(frame.height),
    });
  }
  const { data, info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const pixels = new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength);
  return jsQR(pixels, info.width, info.height, { inversionAttempts: "attemptBoth" })?.data ?? null;
}
