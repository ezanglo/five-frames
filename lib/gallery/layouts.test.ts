import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { GALLERY_LAYOUT_LABEL } from "@/lib/events/labels";
import {
  DEFAULT_GALLERY_LAYOUT,
  GALLERY_LAYOUTS,
  GALLERY_LAYOUT_DESCRIPTION,
  GALLERY_TIERS,
  MAX_TILE_ASPECT,
  MIN_TILE_ASPECT,
  isGalleryLayout,
  placeMasonry,
  resolveGalleryLayout,
  tileAspect,
} from "./layouts";

/** Gallery layouts (decision D22): the three choices, the default and the masonry geometry. */
describe("gallery layout choices", () => {
  it("offers exactly Masonry, Rows and Grid, with Masonry the default", () => {
    expect(GALLERY_LAYOUTS).toEqual(["masonry", "rows", "grid"]);
    expect(DEFAULT_GALLERY_LAYOUT).toBe("masonry");
    expect(Object.values(GALLERY_LAYOUT_LABEL)).toEqual(["Masonry", "Rows", "Grid"]);
  });

  it("resolves each stored value to itself, and anything missing or unknown to Masonry", () => {
    for (const layout of GALLERY_LAYOUTS) expect(resolveGalleryLayout(layout)).toBe(layout);
    for (const value of [null, undefined, "", "slideshow", "Masonry", 3, {}]) {
      expect(isGalleryLayout(value)).toBe(false);
      expect(resolveGalleryLayout(value)).toBe("masonry");
    }
  });

  it("describes the layouts plainly, without implying playback, keepsakes or frames", () => {
    for (const text of Object.values(GALLERY_LAYOUT_DESCRIPTION)) {
      expect(text).not.toMatch(/slide|play|story|auto|keepsake|frame|custom|AI/i);
    }
  });

  it("mirrors its container tiers in app/globals.css", () => {
    const css = readFileSync(path.resolve(import.meta.dirname, "../../app/globals.css"), "utf-8");
    for (const tier of GALLERY_TIERS.slice(1)) {
      expect(css).toContain(`@container (min-width: ${tier.minWidth}px)`);
    }
    for (const tier of GALLERY_TIERS) {
      expect(css).toContain(`--cols: ${tier.masonryColumns};`);
      expect(css).toContain(`repeat(${tier.gridColumns}, minmax(0, 1fr))`);
      expect(css).toContain(`--row: ${tier.rowHeight}px;`);
      expect(css).toContain(`--gap: ${tier.gap}px;`);
    }
  });
});

describe("tileAspect", () => {
  it("is the photo's own width ÷ height for portrait, landscape and square", () => {
    expect(tileAspect(1200, 1600)).toBe(0.75);
    expect(tileAspect(1600, 1067)).toBeCloseTo(1.4996, 3);
    expect(tileAspect(1600, 1600)).toBe(1);
  });

  it("renders unknown dimensions as a square rather than failing", () => {
    for (const [w, h] of [[null, null], [1600, null], [0, 900], [-1, 4], [Number.NaN, 3]]) {
      expect(tileAspect(w, h)).toBe(1);
    }
  });

  it("bounds only extreme panoramas and strips", () => {
    expect(tileAspect(9000, 1000)).toBe(MAX_TILE_ASPECT);
    expect(tileAspect(500, 4000)).toBe(MIN_TILE_ASPECT);
  });
});

describe("placeMasonry", () => {
  const mixed = [1.5, 0.75, 1, 0.5625, 1.333, 0.667, 1.778, 1, 0.75, 1.5, 0.8, 1.2];

  /** Pixel rectangles for a placement at a given column width and gap, as the CSS lays them out. */
  function rects(aspects: number[], columns: number, colW: number, gap: number) {
    const p = placeMasonry(aspects, columns);
    return aspects.map((a, i) => ({
      left: p.column[i] * (colW + gap),
      top: p.offset[i] * colW + p.above[i] * gap,
      width: colW,
      height: colW / a,
    }));
  }

  it("puts each photo in the shortest column, leftmost on a tie", () => {
    const p = placeMasonry([1, 1, 1, 0.5, 2, 1], 3);
    expect(p.column.slice(0, 3)).toEqual([0, 1, 2]);
    // After three squares every column ends at 1; the tall one goes left, the wide one next,
    // and the last square to the one column still ending at 1.
    expect(p.column[3]).toBe(0);
    expect(p.column[4]).toBe(1);
    expect(p.column[5]).toBe(2);
  });

  it("never overlaps tiles and keeps the full gap between neighbours, at every tier and size", () => {
    for (const tier of GALLERY_TIERS) {
      for (const colW of [120, 176, 290]) {
        const r = rects(mixed, tier.masonryColumns, colW, tier.gap);
        for (let i = 0; i < r.length; i++) {
          for (let j = i + 1; j < r.length; j++) {
            const sameColumn = r[i].left === r[j].left;
            if (!sameColumn) continue;
            const [upper, lower] = r[i].top < r[j].top ? [r[i], r[j]] : [r[j], r[i]];
            expect(lower.top - (upper.top + upper.height)).toBeGreaterThanOrEqual(tier.gap - 1e-6);
          }
        }
      }
    }
  });

  it("is prefix-stable: showing more photos never moves one already placed", () => {
    for (const tier of GALLERY_TIERS) {
      const short = placeMasonry(mixed.slice(0, 5), tier.masonryColumns);
      const long = placeMasonry(mixed, tier.masonryColumns);
      expect(long.column.slice(0, 5)).toEqual(short.column);
      expect(long.offset.slice(0, 5)).toEqual(short.offset);
      expect(long.above.slice(0, 5)).toEqual(short.above);
    }
  });

  it("keeps every photo exactly once and balances the columns", () => {
    const many = Array.from({ length: 120 }, (_, i) => mixed[i % mixed.length]);
    const p = placeMasonry(many, 4);
    expect(p.column).toHaveLength(120);
    expect(p.columns.reduce((sum, col) => sum + col.count, 0)).toBe(120);
    const heights = p.columns.map((col) => col.height);
    // No column ends more than one tallest photo below another.
    expect(Math.max(...heights) - Math.min(...heights)).toBeLessThanOrEqual(1 / Math.min(...many) + 0.5);
  });
});
