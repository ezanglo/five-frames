"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import type { GalleryCaptureView } from "@/lib/dal/captures";

/**
 * Full-screen immersive photo viewer (RemyShoots-inspired secondary reference, design-direction
 * "Public gallery" section). A native horizontal scroll-snap track, not a gesture-library
 * carousel — touch swipe and momentum come from the browser for free, and desktop gets arrow-key
 * paging. Every image renders with `object-contain` against a dark matting surface so an
 * arbitrary aspect ratio (portrait, landscape, square) is shown complete, never cropped to fit —
 * the opposite tradeoff from the overview grid, which crops deliberately for rhythm.
 */
export function PhotoViewer({
  captures,
  initialIndex,
  onClose,
}: {
  captures: GalleryCaptureView[];
  initialIndex: number;
  onClose: () => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [current, setCurrent] = useState(initialIndex);

  // Jump to the tapped photo before paint, with no scroll animation to fight.
  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    track.scrollLeft = initialIndex * track.clientWidth;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once, on mount only
  }, []);

  useEffect(() => {
    closeButtonRef.current?.focus();
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    function handleKeydown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      const track = trackRef.current;
      if (!track) return;
      if (event.key === "ArrowRight") {
        track.scrollBy({ left: track.clientWidth, behavior: "smooth" });
      } else if (event.key === "ArrowLeft") {
        track.scrollBy({ left: -track.clientWidth, behavior: "smooth" });
      }
    }
    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [onClose]);

  function handleScroll() {
    const track = trackRef.current;
    if (!track) return;
    setCurrent(Math.round(track.scrollLeft / track.clientWidth));
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Photo viewer"
      className="fixed inset-0 z-50 bg-(--guest-ink)"
    >
      <button
        ref={closeButtonRef}
        type="button"
        onClick={onClose}
        aria-label="Close photo viewer"
        className="absolute top-3 right-3 z-10 flex size-11 items-center justify-center rounded-full bg-(--guest-ink)/60 text-(--guest-accent-foreground) backdrop-blur-sm"
      >
        <X className="size-5" />
      </button>

      <div
        ref={trackRef}
        onScroll={handleScroll}
        className="flex h-full w-full snap-x snap-mandatory overflow-x-auto scroll-smooth"
      >
        {captures.map((capture, index) => (
          <div
            key={capture.id}
            className="flex h-full w-full flex-none snap-center items-center justify-center p-4"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed url */}
            <img
              src={capture.imageUrl}
              alt=""
              className="max-h-full max-w-full object-contain"
              loading={Math.abs(index - initialIndex) <= 1 ? "eager" : "lazy"}
            />
          </div>
        ))}
      </div>

      <p className="absolute inset-x-0 bottom-4 text-center text-xs text-(--guest-accent-foreground)/70">
        {current + 1} / {captures.length}
      </p>
    </div>
  );
}
