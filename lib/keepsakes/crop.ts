/**
 * The one crop rule keepsakes use (architecture §7b "Crop and orientation", decision D20). Pure,
 * so the server pre-crop (`sharp` extract + resize) and the browser preview (`object-fit: cover`
 * with the same `object-position`) are the same crop by construction.
 *
 * CSS semantics: the photo is scaled uniformly until it covers the box, then the overflow on each
 * axis is trimmed and split `focus : (1 − focus)` — exactly what `object-position: X% Y%` does.
 * Nothing is ever stretched. There is no content analysis of any kind: the focus is a template
 * constant, never a per-photo value.
 */

export type CropFocus = { x: number; y: number };
export type CropRect = { left: number; top: number; width: number; height: number };

/** The Full Set family's one focus: centred across, 30% from the top when height is trimmed. */
export const FULL_SET_FOCUS: CropFocus = { x: 0.5, y: 0.3 };
export const CENTER_FOCUS: CropFocus = { x: 0.5, y: 0.5 };

/**
 * The source-pixel rectangle that fills a `boxW × boxH` box with the photo, uniformly scaled.
 * Integers, clamped to the photo, so `sharp().extract()` accepts it as is.
 */
export function coverCrop(
  photoW: number,
  photoH: number,
  boxW: number,
  boxH: number,
  focus: CropFocus = CENTER_FOCUS,
): CropRect {
  if (photoW <= 0 || photoH <= 0 || boxW <= 0 || boxH <= 0) {
    throw new RangeError("coverCrop needs positive dimensions");
  }
  const scale = Math.max(boxW / photoW, boxH / photoH);
  const width = Math.min(photoW, Math.max(1, Math.round(boxW / scale)));
  const height = Math.min(photoH, Math.max(1, Math.round(boxH / scale)));
  const left = Math.min(photoW - width, Math.max(0, Math.round((photoW - width) * focus.x)));
  const top = Math.min(photoH - height, Math.max(0, Math.round((photoH - height) * focus.y)));
  return { left, top, width, height };
}

/** The same focus as a CSS `object-position` value, for the DOM preview. */
export function objectPosition(focus: CropFocus): string {
  return `${round(focus.x * 100)}% ${round(focus.y * 100)}%`;
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}
