import type { CSSProperties, ReactNode } from "react";
import type { GalleryLayout } from "@/lib/db/types";
import { GALLERY_TIERS, placeMasonry, tileAspect } from "@/lib/gallery/layouts";
import { cn } from "@/lib/utils";

export type GalleryLayoutItem = {
  id: string;
  /** Natural pixel size; null renders a square tile. */
  width: number | null;
  height: number | null;
};

const round = (value: number) => Math.round(value * 10_000) / 10_000;

/**
 * One list of photos in one of the three gallery layouts (decision D22, architecture §7d). The
 * revealed gallery and the marketing preview both render through this, so the site can only
 * show an arrangement the product actually produces.
 *
 * Every layout keeps the items in the order given, as one flat `<ul>`. DOM, focus and
 * screen-reader order are the gallery's own order whatever the arrangement. The geometry is CSS
 * (`.ff-gallery-*` in app/globals.css) sized by container queries on this element's own width,
 * with no measuring script and no reflow on load: tile shapes come from the stored dimensions.
 * - **Masonry:** columns, each photo in its own shape. Positions are precomputed per column
 *   count (`placeMasonry`) as CSS variables; the CSS picks the set for the current width.
 * - **Rows:** justified rows. Each tile grows in proportion to its aspect ratio, so a row
 *   shares one height and fills the width; the last row keeps its natural size.
 * - **Grid:** equal squares, cropped for display only.
 *
 * `renderTile` draws the inside of each tile and fills it (the tile box already has the right
 * shape). Not a client component: it holds no state.
 */
export function GalleryLayoutList<T extends GalleryLayoutItem>({
  layout,
  items,
  renderTile,
  className,
  label,
}: {
  layout: GalleryLayout;
  items: readonly T[];
  renderTile: (item: T, index: number) => ReactNode;
  className?: string;
  label?: string;
}) {
  const aspects = items.map((item) => tileAspect(item.width, item.height));
  const masonry =
    layout === "masonry"
      ? GALLERY_TIERS.map((tier) => placeMasonry(aspects, tier.masonryColumns))
      : null;

  const listStyle: Record<string, string> = {};
  if (masonry) {
    masonry.forEach((placement, tier) => {
      const columns = placement.columns.filter((col) => col.count > 0);
      listStyle[`--m${tier}-h`] =
        columns.length === 0
          ? "0px"
          : `max(${columns
              .map((col) => `calc(${round(col.height)} * var(--colw) + ${col.count - 1} * var(--gap))`)
              .join(", ")})`;
    });
  }

  return (
    <div className={cn("ff-gallery", className)} data-layout={layout}>
      <ul
        aria-label={label}
        className={`ff-gallery-list ff-gallery-${layout}`}
        style={listStyle as CSSProperties}
      >
        {items.map((item, index) => {
          const style: Record<string, string | number> = { "--a": round(aspects[index]) };
          masonry?.forEach((placement, tier) => {
            style[`--m${tier}-x`] = placement.column[index];
            style[`--m${tier}-y`] = round(placement.offset[index]);
            style[`--m${tier}-k`] = placement.above[index];
          });
          return (
            <li key={item.id} style={style as CSSProperties}>
              <div className="ff-gallery-tile">{renderTile(item, index)}</div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
