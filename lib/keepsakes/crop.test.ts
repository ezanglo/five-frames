import { describe, expect, it } from "vitest";
import { coverCrop, FULL_SET_FOCUS, objectPosition, type CropFocus } from "./crop";

/**
 * The browser's rule, independently: `object-fit: cover` scales by max(boxW/w, boxH/h), and
 * `object-position: X% Y%` offsets the scaled image by (box − scaled) × X. Mapping that back to
 * source pixels gives the visible rectangle.
 */
function cssVisibleRect(w: number, h: number, boxW: number, boxH: number, focus: CropFocus) {
  const scale = Math.max(boxW / w, boxH / h);
  const scaledW = w * scale;
  const scaledH = h * scale;
  const offsetX = (boxW - scaledW) * focus.x; // ≤ 0
  const offsetY = (boxH - scaledH) * focus.y;
  return { left: -offsetX / scale, top: -offsetY / scale, width: boxW / scale, height: boxH / scale };
}

const CASES: [string, number, number, number, number][] = [
  ["portrait → landscape slot", 1200, 1600, 672, 448],
  ["landscape → portrait slot", 1600, 1067, 360, 760],
  ["square → landscape slot", 1400, 1400, 384, 278],
  ["equal ratio", 1600, 1200, 400, 300],
  ["extreme portrait (9:16) → landscape", 900, 1600, 672, 448],
  ["extreme landscape (16:9) → portrait arm", 1600, 900, 360, 760],
  ["panorama → square", 3000, 800, 404, 404],
];

describe("coverCrop", () => {
  it.each(CASES)("matches CSS object-fit: cover + object-position (%s)", (_, w, h, boxW, boxH) => {
    for (const focus of [FULL_SET_FOCUS, { x: 0.5, y: 0.5 }, { x: 0.5, y: 0.35 }, { x: 0, y: 1 }]) {
      const rect = coverCrop(w, h, boxW, boxH, focus);
      const css = cssVisibleRect(w, h, boxW, boxH, focus);
      expect(Math.abs(rect.left - css.left)).toBeLessThanOrEqual(1);
      expect(Math.abs(rect.top - css.top)).toBeLessThanOrEqual(1);
      expect(Math.abs(rect.width - css.width)).toBeLessThanOrEqual(1);
      expect(Math.abs(rect.height - css.height)).toBeLessThanOrEqual(1);
    }
  });

  it.each(CASES)("is uniform, in bounds and exact-coverage (%s)", (_, w, h, boxW, boxH) => {
    const rect = coverCrop(w, h, boxW, boxH, FULL_SET_FOCUS);
    expect(rect.left).toBeGreaterThanOrEqual(0);
    expect(rect.top).toBeGreaterThanOrEqual(0);
    expect(rect.left + rect.width).toBeLessThanOrEqual(w);
    expect(rect.top + rect.height).toBeLessThanOrEqual(h);
    // One axis is kept whole; the kept rectangle has the box's ratio (no distortion).
    expect(rect.width === w || rect.height === h).toBe(true);
    expect(Math.abs(rect.width / rect.height - boxW / boxH)).toBeLessThan(0.01);
  });

  it("is deterministic", () => {
    const a = coverCrop(1200, 1600, 672, 448, FULL_SET_FOCUS);
    for (let i = 0; i < 5; i++) expect(coverCrop(1200, 1600, 672, 448, FULL_SET_FOCUS)).toEqual(a);
  });

  it("trims 30% from the top and 70% from the bottom when a portrait fills a wide slot", () => {
    const rect = coverCrop(1200, 1600, 600, 400, FULL_SET_FOCUS);
    expect(rect.width).toBe(1200);
    expect(rect.height).toBe(800);
    expect(rect.top).toBe(240); // (1600 − 800) × 0.3
  });

  it("centres horizontally when a landscape fills a tall slot", () => {
    const rect = coverCrop(1600, 1000, 360, 760, FULL_SET_FOCUS);
    expect(rect.height).toBe(1000);
    expect(rect.left).toBe(Math.round((1600 - rect.width) / 2));
  });

  it("writes the focus as the CSS object-position the preview uses", () => {
    expect(objectPosition(FULL_SET_FOCUS)).toBe("50% 30%");
    expect(objectPosition({ x: 0.5, y: 0.35 })).toBe("50% 35%");
  });

  it("refuses empty dimensions", () => {
    expect(() => coverCrop(0, 10, 10, 10)).toThrow();
  });
});
