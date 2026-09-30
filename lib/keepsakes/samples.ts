import { SAMPLE_SCENES } from "@/lib/marketing/sample-scenes";
import type { KeepsakePhoto } from "./context";

/**
 * Bundled sample photos for the host's Look previews (product.md §10.1: host previews use sample
 * photography, never a guest's capture). They are the marketing site's illustrated scenes, cropped
 * to true photo ratios so the previews show real portrait and landscape behavior. Inline SVG data
 * URIs: no network request, no token, nothing a guest could reach.
 */

/** The scene cropped (centred) to `width × height`, as a data URI with those intrinsic dimensions. */
function sceneAt(index: number, width: number, height: number): KeepsakePhoto {
  const markup = decodeURIComponent(SAMPLE_SCENES[index].src.slice(SAMPLE_SCENES[index].src.indexOf(",") + 1));
  const ratio = width / height;
  let w = 400;
  let h = 400 / ratio;
  if (h > 500) {
    h = 500;
    w = 500 * ratio;
  }
  const viewBox = `${round((400 - w) / 2)} ${round((500 - h) / 2)} ${round(w)} ${round(h)}`;
  const cropped = markup.replace('viewBox="0 0 400 500"', `viewBox="${viewBox}" width="${width}" height="${height}"`);
  return { src: `data:image/svg+xml,${encodeURIComponent(cropped)}`, width, height };
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Single-photo samples: a portrait (4:5) and a landscape (3:2) photo. */
export const SINGLE_SAMPLES = {
  portrait: sceneAt(1, 1280, 1600),
  landscape: sceneAt(7, 1500, 1000),
} as const;

/** A guest-message sample for styles that show one. Never the host's welcome message. */
export const SAMPLE_MESSAGE = "Best. Cake. Ever.";

/**
 * Full Set samples, in the design's order: portrait, portrait, landscape, portrait, square. Slot 1
 * of Signature and Strip is landscape, so the host always sees real portrait-in-landscape cropping.
 */
export const FULL_SET_SAMPLES = [
  sceneAt(1, 1200, 1600),
  sceneAt(0, 1200, 1600),
  sceneAt(2, 1600, 1200),
  sceneAt(6, 1200, 1600),
  sceneAt(4, 1400, 1400),
] as const;
