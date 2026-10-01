import { Check } from "lucide-react";
import type { GalleryLayout } from "@/lib/db/types";
import { GALLERY_LAYOUT_LABEL } from "@/lib/events/labels";
import {
  DEFAULT_GALLERY_LAYOUT,
  GALLERY_LAYOUTS,
  GALLERY_LAYOUT_DESCRIPTION,
} from "@/lib/gallery/layouts";

/**
 * Settings · Event & gallery → Gallery layout (decision D22). Three native radio cards posted as
 * `galleryLayout`, so arrow keys move the choice and the unsaved-changes guard sees it like any
 * other field. Each card names the layout, says what it looks like in one plain line, and draws
 * a small abstract picture of it, so the difference is clear without trying each one. The
 * selected card has a check and a border, never color alone. Uncontrolled: Discard remounts the
 * form, which restores `value`.
 */
export function GalleryLayoutField({ value }: { value: GalleryLayout }) {
  return (
    <fieldset>
      <legend className="sr-only">Gallery layout</legend>
      <div className="grid gap-3 sm:grid-cols-3">
        {GALLERY_LAYOUTS.map((layout) => (
          <label key={layout} className="group relative flex cursor-pointer">
            <input
              type="radio"
              name="galleryLayout"
              value={layout}
              defaultChecked={layout === value}
              className="peer sr-only"
            />
            <span
              className="flex w-full items-center gap-4 rounded-lg border border-line bg-surface p-3 transition-colors group-hover:border-ink-muted/40 peer-checked:border-brand peer-checked:bg-brand-tint/40 peer-focus-visible:shadow-[0_0_0_2px_var(--color-surface-base),0_0_0_4px_var(--brand-primary)] sm:flex-col sm:items-stretch sm:gap-3 sm:p-4"
            >
              <LayoutSketch
                layout={layout}
                className="h-14 w-20 shrink-0 rounded-[6px] bg-surface-subtle p-1.5 text-brand/35 sm:h-auto sm:w-full"
              />
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="text-label font-semibold text-ink">
                  {GALLERY_LAYOUT_LABEL[layout]}
                  {layout === DEFAULT_GALLERY_LAYOUT && (
                    <span className="font-medium text-ink-muted"> · default</span>
                  )}
                </span>
                <span className="text-caption font-medium text-ink-muted">
                  {GALLERY_LAYOUT_DESCRIPTION[layout]}
                </span>
              </span>
            </span>
            <span
              aria-hidden
              className="absolute top-3 right-3 hidden size-5 items-center justify-center rounded-full bg-brand text-ink-inverse peer-checked:flex"
            >
              <Check className="size-3" strokeWidth={3} />
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** Rects for each sketch on a 96 × 60 canvas: [x, y, width, height]. Clipped at the bottom, as a
 *  gallery continues below the fold. */
const SKETCH: Record<GalleryLayout, [number, number, number, number][]> = {
  // Columns of natural shapes, staggered.
  masonry: [
    [0, 0, 30, 24], [0, 26, 30, 40],
    [33, 0, 30, 40], [33, 42, 30, 20],
    [66, 0, 30, 18], [66, 20, 30, 28], [66, 50, 30, 20],
  ],
  // Rows of one height each, widths following each photo's shape.
  rows: [
    [0, 0, 40, 18], [42, 0, 22, 18], [66, 0, 30, 18],
    [0, 20, 24, 18], [26, 20, 44, 18], [72, 20, 24, 18],
    [0, 40, 30, 20], [32, 40, 30, 20], [64, 40, 32, 20],
  ],
  // Equal squares.
  grid: [0, 1, 2, 3].flatMap((col) =>
    [0, 1, 2].map((row): [number, number, number, number] => [col * 24.75, row * 24.75, 21.75, 21.75]),
  ),
};

function LayoutSketch({ layout, className }: { layout: GalleryLayout; className?: string }) {
  return (
    <span aria-hidden className={className}>
      <svg viewBox="0 0 96 60" preserveAspectRatio="xMidYMin slice" className="block size-full sm:h-auto">
        {SKETCH[layout].map(([x, y, w, h], i) => (
          <rect key={i} x={x} y={y} width={w} height={h} rx={3} fill="currentColor" />
        ))}
      </svg>
    </span>
  );
}
