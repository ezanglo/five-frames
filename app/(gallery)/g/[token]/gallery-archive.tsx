"use client";

import { useRef, useState } from "react";
import type { GalleryCaptureView } from "@/lib/dal/captures";
import { Button } from "@/components/ff/button";
import { PhotoViewer, type ViewerPhoto } from "@/components/ff/photo-viewer";

const INITIAL_COUNT = 30;
const PAGE_SIZE = 30;

/**
 * The revealed public gallery (guest 05 Gallery · revealed; DS05 gallery tile): a square-ish
 * 3-column grid, 6px gap, radius/sm, object-fit cover. Tapping a tile opens the dark viewer.
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
      <ul className="grid grid-cols-3 gap-1.5">
        {visible.map((capture, index) => (
          <li key={capture.id}>
            <button
              type="button"
              onClick={(event) => {
                lastFocused.current = event.currentTarget;
                setViewerIndex(index);
              }}
              aria-label={photos[index].alt}
              className="ff-focus block aspect-square w-full overflow-hidden rounded-sm bg-surface-subtle"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed url */}
              <img src={capture.imageUrl} alt="" loading="lazy" className="size-full object-cover" />
            </button>
          </li>
        ))}
      </ul>

      {hasMore ? (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
          className="self-center"
        >
          Show more
        </Button>
      ) : (
        <p className="text-center text-caption font-medium text-ink-muted">
          Tap a photo to open it.
        </p>
      )}

      {viewerIndex !== null && (
        <PhotoViewer photos={photos} initialIndex={viewerIndex} onClose={closeViewer} />
      )}
    </div>
  );
}
