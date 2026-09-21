"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { GalleryCaptureView } from "@/lib/dal/captures";
import { PhotoViewer } from "./photo-viewer";

const SPREAD_SIZE = 3;
const INITIAL_SPREADS = 4;
const SPREADS_PER_REVEAL = 4;

/**
 * The revealed public gallery (design-direction "Public gallery" section, A24-anchored). Photos
 * are grouped into repeating "spread" units of up to three, alternating between two asymmetric
 * templates — a photobook-spread rhythm, not a uniform grid and not the guest scope's fixed
 * five-frame board (that pattern is specific to the capture mechanic). All captures are fetched
 * and signed server-side already; "Show more" is a bounded reveal of already-loaded data for a
 * shorter initial scroll on large collections, not a real pagination subsystem.
 */
export function GalleryArchive({ captures }: { captures: GalleryCaptureView[] }) {
  const [visibleSpreads, setVisibleSpreads] = useState(INITIAL_SPREADS);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const lastFocused = useRef<HTMLElement | null>(null);

  const visibleCount = Math.min(captures.length, visibleSpreads * SPREAD_SIZE);
  const visible = captures.slice(0, visibleCount);
  const hasMore = visibleCount < captures.length;

  const spreads: GalleryCaptureView[][] = [];
  for (let i = 0; i < visible.length; i += SPREAD_SIZE) {
    spreads.push(visible.slice(i, i + SPREAD_SIZE));
  }

  function openViewer(index: number, trigger: HTMLElement) {
    lastFocused.current = trigger;
    setViewerIndex(index);
  }

  function closeViewer() {
    setViewerIndex(null);
    lastFocused.current?.focus();
  }

  return (
    <div className="flex flex-col gap-8" inert={viewerIndex !== null}>
      {spreads.map((spread, spreadIndex) => (
        <Spread
          key={spreadIndex}
          photos={spread}
          startIndex={spreadIndex * SPREAD_SIZE}
          template={spreadIndex % 2 === 0 ? "hero" : "portrait"}
          onOpen={openViewer}
        />
      ))}

      {hasMore && (
        <button
          type="button"
          onClick={() => setVisibleSpreads((count) => count + SPREADS_PER_REVEAL)}
          className="self-center text-sm text-(--guest-ink-muted) underline underline-offset-4 hover:text-(--guest-ink)"
        >
          Show more
        </button>
      )}

      {viewerIndex !== null && (
        <PhotoViewer captures={captures} initialIndex={viewerIndex} onClose={closeViewer} />
      )}
    </div>
  );
}

function Spread({
  photos,
  startIndex,
  template,
  onOpen,
}: {
  photos: GalleryCaptureView[];
  startIndex: number;
  template: "hero" | "portrait";
  onOpen: (index: number, trigger: HTMLElement) => void;
}) {
  if (photos.length === 1) {
    return (
      <Tile
        capture={photos[0]}
        index={startIndex}
        onOpen={onOpen}
        className="aspect-4/3 w-full"
      />
    );
  }

  if (photos.length === 2) {
    return (
      <div className="grid grid-cols-2 gap-2">
        <Tile capture={photos[0]} index={startIndex} onOpen={onOpen} className="aspect-square" />
        <Tile
          capture={photos[1]}
          index={startIndex + 1}
          onOpen={onOpen}
          className="aspect-square"
        />
      </div>
    );
  }

  if (template === "hero") {
    return (
      <div className="grid grid-cols-2 gap-2">
        <Tile
          capture={photos[0]}
          index={startIndex}
          onOpen={onOpen}
          className="col-span-2 aspect-16/10"
        />
        <Tile
          capture={photos[1]}
          index={startIndex + 1}
          onOpen={onOpen}
          className="aspect-square"
        />
        <Tile
          capture={photos[2]}
          index={startIndex + 2}
          onOpen={onOpen}
          className="aspect-square"
        />
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <Tile
        capture={photos[0]}
        index={startIndex}
        onOpen={onOpen}
        className="aspect-3/4 w-[42%] shrink-0"
      />
      <div className="flex flex-1 flex-col gap-2">
        <Tile capture={photos[1]} index={startIndex + 1} onOpen={onOpen} className="aspect-3/2" />
        <Tile capture={photos[2]} index={startIndex + 2} onOpen={onOpen} className="aspect-3/2" />
      </div>
    </div>
  );
}

function Tile({
  capture,
  index,
  onOpen,
  className,
}: {
  capture: GalleryCaptureView;
  index: number;
  onOpen: (index: number, trigger: HTMLElement) => void;
  className: string;
}) {
  return (
    <button
      type="button"
      onClick={(event) => onOpen(index, event.currentTarget)}
      aria-label={`Open photo ${index + 1}`}
      className={cn(
        "overflow-hidden rounded-2xl bg-(--guest-surface) shadow-[0_6px_20px_-10px_oklch(0.27_0.025_50/0.4)]",
        className,
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed url */}
      <img
        src={capture.imageUrl}
        alt=""
        loading="lazy"
        className="h-full w-full object-cover"
      />
    </button>
  );
}
