import { CENTER_FOCUS, type CropFocus } from "./crop";
import type { FullSetStyleId, KeepsakeStyleId, SingleStyleId } from "./styles";

/**
 * Keepsake geometry, straight from the approved board (docs/design-direction.md → "The five
 * keepsake styles" and "Full Set keepsakes", docs/design-handoff/FiveFrames_Theme_Keepsakes_v1.0).
 * Pure numbers shared by the templates (both render targets) and the server image preparation,
 * so the box a photo is prepared for is the box the template draws.
 */

// ------------------------------------------------------------------------------------ canvases

/** One canvas per family, never per style, event or guest. */
export const SINGLE_CANVAS = { width: 1080, height: 1350 } as const; // 4:5
export const FULL_SET_CANVAS = { width: 1200, height: 1800 } as const; // 2:3, 2.16 MP

export type Box = { width: number; height: number };
export type SlotRect = { x: number; y: number; width: number; height: number };
export type FiveSlots = readonly [SlotRect, SlotRect, SlotRect, SlotRect, SlotRect];

// ------------------------------------------------------------------------------ Full Set slots

/**
 * Each Full Set style's five slot rectangles in canvas px, in canonical order (photo 1 → slot 1).
 * The template draws `photos[i]` in `slots[i]` and nothing else in a slot.
 *
 * Signature is the brandmark's construction (`SYMBOL_FRAMES` in lib/brand/logo.ts): landscape top,
 * portrait right, landscape bottom, portrait left, then the closing square. The landscape arms are
 * opened to 3:2 and the gutter set to 24 px, as the design amendment decided; the portrait arms
 * keep the mark's 36:76.
 *
 * Prints rotates its outer print wrappers in the template; the rectangles here are the unrotated
 * photo windows, so the in-bounds / non-overlapping rule applies as written.
 */
export const FULL_SET_SLOTS: Record<FullSetStyleId, FiveSlots> = {
  signature: [
    { x: 72, y: 72, width: 672, height: 448 },
    { x: 768, y: 72, width: 360, height: 760 },
    { x: 456, y: 856, width: 672, height: 448 },
    { x: 72, y: 544, width: 360, height: 760 },
    { x: 456, y: 544, width: 288, height: 288 },
  ],
  strip: [
    { x: 126, y: 126, width: 384, height: 278 },
    { x: 126, y: 422, width: 384, height: 278 },
    { x: 126, y: 718, width: 384, height: 278 },
    { x: 126, y: 1014, width: 384, height: 278 },
    { x: 126, y: 1310, width: 384, height: 278 },
  ],
  grid: [
    { x: 64, y: 64, width: 526, height: 544 },
    { x: 610, y: 64, width: 526, height: 544 },
    { x: 64, y: 628, width: 526, height: 544 },
    { x: 610, y: 628, width: 526, height: 544 },
    { x: 64, y: 1192, width: 526, height: 544 },
  ],
  spotlight: [
    { x: 64, y: 64, width: 1072, height: 1072 },
    { x: 64, y: 1156, width: 253, height: 316 },
    { x: 337, y: 1156, width: 253, height: 316 },
    { x: 610, y: 1156, width: 253, height: 316 },
    { x: 883, y: 1156, width: 253, height: 316 },
  ],
  prints: [
    { x: 116, y: 110, width: 404, height: 404 },
    { x: 674, y: 174, width: 404, height: 404 },
    { x: 142, y: 690, width: 404, height: 404 },
    { x: 652, y: 754, width: 404, height: 404 },
    { x: 128, y: 1260, width: 404, height: 404 },
  ],
};

/** Prints: each print wrapper's rotation about its own centre (template composition only). */
export const PRINTS_ROTATION = [-3, 2.4, 1.8, -2.2, -1.4] as const;

// ------------------------------------------------------------------------ Single-photo windows

type WindowBoxes = { portrait: Box; landscape: Box };

/**
 * Single-photo styles contain the photo: its window takes the photo's own ratio, fitted inside
 * the style's box. Portrait photos use the portrait box; landscape and square use the landscape
 * box (Journal lays a square out like a portrait, with the side column).
 */
const SINGLE_WINDOW_BOXES: Record<SingleStyleId, WindowBoxes> = {
  print: { portrait: { width: 952, height: 860 }, landscape: { width: 952, height: 880 } },
  booth: { portrait: { width: 904, height: 800 }, landscape: { width: 904, height: 780 } },
  poster: { portrait: { width: 936, height: 740 }, landscape: { width: 936, height: 700 } },
  journal: { portrait: { width: 640, height: 820 }, landscape: { width: 936, height: 620 } },
  album: { portrait: { width: 860, height: 800 }, landscape: { width: 860, height: 700 } },
};

/** Whether a style lays this photo out as portrait (Journal treats a square as portrait). */
export function isPortraitLayout(style: SingleStyleId, photoW: number, photoH: number): boolean {
  return style === "journal" ? photoW <= photoH : photoW < photoH;
}

/** The photo's window on a Single-photo canvas: the photo's ratio, as large as the box allows. */
export function singlePhotoWindow(style: SingleStyleId, photoW: number, photoH: number): Box {
  const w = Math.max(1, photoW);
  const h = Math.max(1, photoH);
  const boxes = SINGLE_WINDOW_BOXES[style];
  const box = isPortraitLayout(style, w, h) ? boxes.portrait : boxes.landscape;
  const scale = Math.min(box.width / w, box.height / h);
  return {
    width: Math.max(1, Math.round(w * scale)),
    height: Math.max(1, Math.round(h * scale)),
  };
}

// ------------------------------------------------------------------------- theme image boxes

/**
 * Where a style uses the theme image, the box it fills and the crop focus. Never a capture-sized
 * rectangle: a field, a plate, a texture, a seal, a ground or a band. Styles absent here don't
 * use the image at all.
 */
export const THEME_IMAGE_BOXES: Partial<Record<KeepsakeStyleId, Box & { focus: CropFocus }>> = {
  poster: { width: 1080, height: 560, focus: { x: 0.5, y: 0.35 } },
  journal: { width: 112, height: 112, focus: { x: 0.5, y: 0.35 } },
  album: { width: 1080, height: 1350, focus: CENTER_FOCUS },
  signature: { width: 128, height: 128, focus: { x: 0.5, y: 0.35 } },
  strip: { width: 1200, height: 1800, focus: { x: 0.5, y: 0.35 } },
  spotlight: { width: 1200, height: 264, focus: { x: 0.5, y: 0.45 } },
  prints: { width: 1200, height: 1800, focus: CENTER_FOCUS },
};

// ------------------------------------------------------------------------------ text sizing

/** Four name sizes, by length: ≤ 14, ≤ 24, ≤ 34, then anything longer (which also clamps). */
export type NameSteps = readonly [number, number, number, number];

/** The event name's size: steps down by length, then the template clamps its lines. */
export function nameSize(name: string, steps: NameSteps): number {
  const length = Array.from(name).length;
  if (length <= 14) return steps[0];
  if (length <= 24) return steps[1];
  if (length <= 34) return steps[2];
  return steps[3];
}
