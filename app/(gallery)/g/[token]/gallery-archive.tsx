"use client";

import { useEffect, useRef, useState } from "react";
import type { GalleryCaptureView } from "@/lib/dal/captures";
import type { GalleryLayout } from "@/lib/db/types";
import { groupBySection } from "@/lib/gallery/time-sections";
import { GalleryLayoutList } from "@/components/ff/gallery-layout";
import { Button } from "@/components/ff/button";
import { PhotoViewer, type ViewerPhoto } from "@/components/ff/photo-viewer";

const INITIAL_COUNT = 30;
const PAGE_SIZE = 30;

/**
 * The revealed public gallery (guest 05 Gallery · revealed): one flat, scrollable list of photos
 * in the host's chosen layout (decision D22): Masonry (the default), Rows or Grid. The layout
 * only arranges the photos. Every layout gets the same list, in the same order, with the same
 * viewer. Tapping a tile opens the dark viewer, which always shows the whole photo
 * (`object-contain`), whatever the tile's crop. There is no slideshow, autoplay or play control:
 * the gallery is meant to be scrolled.
 *
 * All captures are fetched and signed server-side already. "Show more" is a bounded reveal of
 * already-loaded data for a shorter initial scroll, not a pagination subsystem. It appends
 * without moving any tile already shown, in every layout (placeMasonry is prefix-stable).
 *
 * With time sections on (the default, D24, architecture §7d), consecutive photos from the same
 * local hour are grouped under an `h2` with the server-computed label ("7 PM"). Each group is
 * its own layout list, so "Show more" only grows the last group or adds groups after it, and
 * never moves a tile. Off, the gallery is the single flat list exactly as before.
 *
 * Only the photo and its message are shown: the public gallery never exposes who took a photo
 * or when (see docs/design-direction.md "Known discrepancies"). A section names an hour, never
 * a photo's own time.
 */
export function GalleryArchive({
  captures,
  layout,
  timeSections,
}: {
  captures: GalleryCaptureView[];
  layout: GalleryLayout;
  timeSections: boolean;
}) {
  const [visibleCount, setVisibleCount] = useState(INITIAL_COUNT);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const lastFocused = useRef<HTMLElement | null>(null);

  const visible = captures.slice(0, visibleCount);
  const hasMore = visibleCount < captures.length;

  const photos: ViewerPhoto[] = captures.map((capture, index) => ({
    id: capture.id,
    src: capture.imageUrl,
    alt: capture.message
      ? `Photo ${index + 1} of ${captures.length}: ${capture.message}`
      : `Photo ${index + 1} of ${captures.length}`,
    message: capture.message,
  }));

  // Focus goes back to the tile that opened the viewer only once the close has rendered: until
  // then the list is still `inert`, and focusing inside it silently does nothing.
  useEffect(() => {
    if (viewerIndex === null) lastFocused.current?.focus();
  }, [viewerIndex]);

  function closeViewer() {
    setViewerIndex(null);
  }

  /** One tile; `index` is the photo's place in the whole gallery, across sections. */
  function renderTile(capture: GalleryCaptureView, index: number) {
    return (
      <button
        type="button"
        onClick={(event) => {
          lastFocused.current = event.currentTarget;
          setViewerIndex(index);
        }}
        aria-label={photos[index].alt}
        className="ff-focus group block size-full overflow-hidden rounded-sm bg-surface-subtle md:rounded-md"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed url */}
        <img
          src={capture.imageUrl}
          alt=""
          loading="lazy"
          decoding="async"
          className="size-full object-cover transition-transform duration-300 md:group-hover:scale-[1.03] motion-reduce:transition-none"
        />
      </button>
    );
  }

  // The viewer renders beside the inert list, never inside it: `inert` covers the whole
  // subtree, so a viewer nested there would ignore every tap, swipe and key.
  return (
    <>
      <div className="flex flex-col gap-4" inert={viewerIndex !== null}>
        <div className="hidden items-center justify-between gap-4 text-label font-medium text-ink-muted md:flex">
          <p className="tabular">
            Showing {Math.min(visibleCount, captures.length)} of {captures.length}
          </p>
          <p>Click a photo to open it · ← → to browse</p>
        </div>
        {timeSections ? (
          groupBySection(visible).map((group) => (
            <section key={group.key} aria-labelledby={`section-${group.key}`} className="flex flex-col gap-3">
              <h2 id={`section-${group.key}`} className="text-heading font-bold text-ink">
                {group.label}
              </h2>
              <GalleryLayoutList
                layout={layout}
                items={group.items}
                label={`Photos from ${group.label}`}
                renderTile={(capture, index) => renderTile(capture, group.start + index)}
              />
            </section>
          ))
        ) : (
          <GalleryLayoutList layout={layout} items={visible} label="Event photos" renderTile={renderTile} />
        )}

        {hasMore ? (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
            className="self-center md:mt-2"
          >
            Show more
          </Button>
        ) : (
          <p className="text-center text-caption font-medium text-ink-muted md:hidden">
            Tap a photo to open it.
          </p>
        )}
      </div>

      {viewerIndex !== null && (
        <PhotoViewer photos={photos} initialIndex={viewerIndex} onClose={closeViewer} />
      )}
    </>
  );
}
