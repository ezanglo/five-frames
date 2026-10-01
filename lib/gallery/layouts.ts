import type { GalleryLayout } from "@/lib/db/types";

/**
 * Revealed-gallery layouts (decision D22, architecture §7d). The host picks one of three
 * arrangements for the same photos: what is shown, in what order, and to whom never depends on
 * it. Pure and DOM-free so the real gallery, the host setting and the marketing preview all share
 * one definition, and so it can be unit-tested.
 *
 * The geometry lives in app/globals.css (`.ff-gallery-*`), driven by container queries on the
 * gallery's own width. The tiers there must match `GALLERY_TIERS` below.
 */

export const GALLERY_LAYOUTS: readonly GalleryLayout[] = ["masonry", "rows", "grid"];

/** New events get it from the column default; anything unreadable renders as it too. */
export const DEFAULT_GALLERY_LAYOUT: GalleryLayout = "masonry";

export function isGalleryLayout(value: unknown): value is GalleryLayout {
  return typeof value === "string" && (GALLERY_LAYOUTS as readonly string[]).includes(value);
}

/** The stored value, or Masonry for a missing or unknown one. Never throws. */
export function resolveGalleryLayout(value: unknown): GalleryLayout {
  return isGalleryLayout(value) ? value : DEFAULT_GALLERY_LAYOUT;
}

/** One line under each choice in the host setting. Plain words, no layout jargon. */
export const GALLERY_LAYOUT_DESCRIPTION: Record<GalleryLayout, string> = {
  masonry: "Every photo keeps its own shape, in a relaxed collage.",
  rows: "Photos line up neatly across the page, in their own shapes.",
  grid: "Even square tiles. Tap one to see the whole photo.",
};

/**
 * Container-width tiers, narrowest first (mirrored in app/globals.css). A phone gets the first
 * tier, a tablet the second, a desktop column the third.
 */
export const GALLERY_TIERS = [
  { minWidth: 0, masonryColumns: 2, gridColumns: 3, rowHeight: 140, gap: 6 },
  { minWidth: 560, masonryColumns: 3, gridColumns: 4, rowHeight: 150, gap: 12 },
  { minWidth: 880, masonryColumns: 4, gridColumns: 5, rowHeight: 200, gap: 16 },
] as const;

/**
 * Tile shape limits. Masonry and Rows show each photo's own shape. Only beyond these bounds
 * (an extreme panorama or a very tall strip) is a tile trimmed, so it never becomes a sliver.
 * The viewer always shows the whole photo.
 */
export const MIN_TILE_ASPECT = 1 / 3;
export const MAX_TILE_ASPECT = 3;

/** width ÷ height for a tile. Unknown dimensions render as a square, never an error. */
export function tileAspect(width: number | null | undefined, height: number | null | undefined): number {
  if (!width || !height || !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return 1;
  }
  return Math.min(MAX_TILE_ASPECT, Math.max(MIN_TILE_ASPECT, width / height));
}

export type MasonryPlacement = {
  /** Zero-based column of each item. */
  column: number[];
  /** Sum of the heights above each item in its column, in column widths (each is 1 ÷ aspect). */
  offset: number[];
  /** How many items sit above each item in its column (one gap each). */
  above: number[];
  /** Per column: total height in column widths and item count, for the container height. */
  columns: { height: number; count: number }[];
};

/**
 * Greedy shortest-column placement, in the gallery's own order: each photo goes to the column
 * that currently ends highest, leftmost on a tie. Positions depend only on earlier photos, so
 * "Show more" appends without moving anything already on screen.
 *
 * Heights are in column widths, so the result holds at every screen size. Gaps are fixed pixels,
 * so choosing "shortest" uses a nominal gap; the rendered positions are still exact (the CSS adds
 * the real gap per item above), so tiles never overlap whatever the true gap is.
 */
export function placeMasonry(
  aspects: readonly number[],
  columnCount: number,
  nominalGap = 0.05,
): MasonryPlacement {
  const columns = Array.from({ length: columnCount }, () => ({ height: 0, count: 0 }));
  const placement: MasonryPlacement = { column: [], offset: [], above: [], columns };
  const end = (col: { height: number; count: number }) => col.height + col.count * nominalGap;

  for (const aspect of aspects) {
    let target = 0;
    for (let c = 1; c < columnCount; c++) {
      if (end(columns[c]) < end(columns[target]) - 1e-9) target = c;
    }
    const col = columns[target];
    placement.column.push(target);
    placement.offset.push(col.height);
    placement.above.push(col.count);
    col.height += 1 / aspect;
    col.count += 1;
  }
  return placement;
}
