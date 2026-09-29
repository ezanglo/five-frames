"use client";

import { useRef, useState } from "react";
import type { GalleryCaptureView } from "@/lib/dal/captures";
import { Button } from "@/components/ff/button";
import { PhotoViewer, type ViewerPhoto } from "@/components/ff/photo-viewer";

const INITIAL_COUNT = 30;
const PAGE_SIZE = 30;

/**
 * The revealed public gallery (guest 05 Gallery · revealed; DS05 gallery tile): a square-ish
 * 3-column grid, 6px gap, radius/sm, object-fit cover — widening to 4 columns on tablets and 5
 * on desktop inside the wide shell's 1200px column, so tiles stay ~230px (inspectable) instead
 * of shrinking a phone grid into the middle of the browser. Tapping a tile opens the dark viewer.
 * All captures are fetched and signed server-side already; "Show more" is a bounded reveal of
 * already-loaded data for a shorter initial scroll, not a pagination subsystem.
 *
 * Only the photo and its message are shown: the public gallery never exposes who took a photo
 * or when (see docs/design-direction.md "Known discrepancies").
 */
export function GalleryArchive({ captures }: { captures: GalleryCaptureView[] }) {
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

  function closeViewer() {
    setViewerIndex(null);
    lastFocused.current?.focus();
  }

  return (
    <div className="flex flex-col gap-4" inert={viewerIndex !== null}>
      <div className="hidden items-center justify-between gap-4 text-label font-medium text-ink-muted md:flex">
        <p className="tabular">
          Showing {Math.min(visibleCount, captures.length)} of {captures.length}
        </p>
        <p>Click a photo to open it · ← → to browse</p>
      </div>
      <ul className="grid grid-cols-3 gap-1.5 md:grid-cols-4 md:gap-3 lg:grid-cols-5 lg:gap-4">
        {visible.map((capture, index) => (
          <li key={capture.id}>
            <button
              type="button"
              onClick={(event) => {
                lastFocused.current = event.currentTarget;
                setViewerIndex(index);
              }}
              aria-label={photos[index].alt}
              className="ff-focus group block aspect-square w-full overflow-hidden rounded-sm bg-surface-subtle md:rounded-md"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed url */}
              <img
                src={capture.imageUrl}
                alt=""
                loading="lazy"
                className="size-full object-cover transition-transform duration-300 md:group-hover:scale-[1.03] motion-reduce:transition-none"
              />
            </button>
          </li>
        ))}
      </ul>

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

      {viewerIndex !== null && (
        <PhotoViewer photos={photos} initialIndex={viewerIndex} onClose={closeViewer} />
      )}
    </div>
  );
}
