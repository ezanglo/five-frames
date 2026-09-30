"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, ChevronsLeftRight, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "./avatar";
import { ButtonAnchor } from "./button";

export type ViewerPhoto = {
  id: string;
  src: string;
  /** Meaningful alt text (DS06): "Photo by Mia Reyes, 2:18 PM" + message when present. */
  alt: string;
  name?: string | null;
  meta?: string | null;
  message?: string | null;
  /** Small pill beside the name, e.g. "Shot 2 of 5". */
  badge?: string | null;
  /** Present only where the viewer is allowed to download this photo. */
  downloadUrl?: string | null;
};

/**
 * Full-screen photo viewer (DS05/DS06, guest 05 "Photo view"): surface/dark, a viewer bar of
 * 40px frosted circles (back · counter · download), pager dots, and an info block below.
 * A native horizontal scroll-snap track — touch swipe and momentum come from the browser,
 * desktop gets arrow keys and side arrows. Each image renders `object-contain` so any aspect
 * ratio is shown complete, never cropped. ≥1024 it becomes a proper media viewer: a large
 * photo stage and a 380px side panel carrying the counter, attribution, message and actions
 * (the bar's download circle yields to the panel's Download button there).
 */
export function PhotoViewer({
  photos,
  initialIndex,
  onClose,
  keepsakeActions,
  downloadLabel = "Download photo",
}: {
  photos: ViewerPhoto[];
  initialIndex: number;
  onClose: () => void;
  /**
   * The guest's own viewer with keepsakes on: the actions for the "Keepsake" group. The viewer
   * then separates it from the "Original photo" group, so the two outputs never blur together
   * (design-direction → "Guest keepsake flow").
   */
  keepsakeActions?: (photo: ViewerPhoto) => ReactNode;
  downloadLabel?: string;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const backButtonRef = useRef<HTMLButtonElement>(null);
  const [current, setCurrent] = useState(initialIndex);

  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    track.scrollLeft = initialIndex * track.clientWidth;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once, on mount only
  }, []);

  useEffect(() => {
    backButtonRef.current?.focus();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    function handleKeydown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      else if (event.key === "ArrowRight") page(1);
      else if (event.key === "ArrowLeft") page(-1);
    }
    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [onClose]);

  function page(direction: 1 | -1) {
    const track = trackRef.current;
    if (!track) return;
    track.scrollBy({ left: direction * track.clientWidth, behavior: "smooth" });
  }

  function handleScroll() {
    const track = trackRef.current;
    if (!track) return;
    setCurrent(Math.round(track.scrollLeft / track.clientWidth));
  }

  const photo = photos[Math.min(current, photos.length - 1)];

  const info = photo && (photo.name || photo.meta || photo.badge);
  const actions = photo && photo.downloadUrl;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Photo viewer"
      className="fixed inset-0 z-50 flex flex-col bg-surface-dark text-ink-inverse lg:grid lg:grid-cols-[minmax(0,1fr)_380px]"
    >
      {/* Media stage: the photo, the viewer bar and the side arrows. */}
      <div className="relative flex min-h-0 flex-1 flex-col">
        <div className="ff-safe-top absolute inset-x-0 top-0 z-10 flex items-center justify-between px-4 lg:px-6 lg:pt-6">
          <button
            ref={backButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Back"
            className="ff-focus ff-frosted flex size-10 items-center justify-center rounded-full"
          >
            <ChevronLeft className="size-5" />
          </button>
          <span className="ff-frosted tabular flex h-10 items-center rounded-full px-4 text-micro font-semibold">
            {current + 1} / {photos.length}
          </span>
          {photo?.downloadUrl ? (
            <a
              href={photo.downloadUrl}
              aria-label="Download photo"
              className="ff-focus ff-frosted flex size-10 items-center justify-center rounded-full lg:invisible"
            >
              <Download className="size-[18px]" />
            </a>
          ) : (
            <span className="size-10" aria-hidden />
          )}
        </div>

        <div className="relative min-h-0 flex-1">
          <div
            ref={trackRef}
            onScroll={handleScroll}
            className="flex h-full w-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none]"
          >
            {photos.map((p, index) => (
              <div
                key={p.id}
                className="flex h-full w-full flex-none snap-center items-center justify-center px-2 pt-16 pb-4 lg:px-20 lg:pt-24 lg:pb-12"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed url */}
                <img
                  src={p.src}
                  alt={p.alt}
                  className="max-h-full max-w-full rounded-lg object-contain"
                  loading={Math.abs(index - initialIndex) <= 1 ? "eager" : "lazy"}
                />
              </div>
            ))}
          </div>
          {photos.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => page(-1)}
                disabled={current === 0}
                aria-label="Previous photo"
                className="ff-focus ff-frosted absolute top-1/2 left-3 flex size-10 -translate-y-1/2 items-center justify-center rounded-full disabled:opacity-0 lg:left-6 lg:size-12"
              >
                <ChevronLeft className="size-5" />
              </button>
              <button
                type="button"
                onClick={() => page(1)}
                disabled={current === photos.length - 1}
                aria-label="Next photo"
                className="ff-focus ff-frosted absolute top-1/2 right-3 flex size-10 -translate-y-1/2 items-center justify-center rounded-full disabled:opacity-0 lg:right-6 lg:size-12"
              >
                <ChevronRight className="size-5" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Info: under the photo on phones; a side panel beside it on desktop. */}
      <div className="ff-safe-bottom mx-auto flex w-full max-w-[430px] flex-col gap-4 px-5 pt-2 md:max-w-[600px] lg:max-w-none lg:justify-center lg:gap-5 lg:overflow-y-auto lg:border-l lg:border-white/10 lg:px-8 lg:py-10">
        <p className="tabular hidden text-label font-semibold text-ink-on-dark lg:block">
          Photo {current + 1} of {photos.length}
        </p>
        {photos.length > 1 && (
          <PagerDots count={photos.length} current={current} className="lg:hidden" />
        )}
        {photo && info && (
          <div className="flex items-center gap-3">
            {photo.name && <Avatar name={photo.name} />}
            <div className="flex min-w-0 flex-1 flex-col">
              {photo.name && <p className="truncate text-[16px] font-bold">{photo.name}</p>}
              {photo.meta && (
                <p className="text-caption font-medium text-ink-on-dark">{photo.meta}</p>
              )}
            </div>
            {photo.badge && (
              <span className="ff-frosted flex h-8 items-center rounded-full px-3 text-micro font-semibold">
                {photo.badge}
              </span>
            )}
          </div>
        )}
        {photo?.message && (
          <p className="rounded-lg bg-white/[0.07] px-4 py-3.5 text-body font-medium lg:text-[17px] lg:leading-relaxed">
            &ldquo;{photo.message}&rdquo;
          </p>
        )}
        {photos.length > 1 && (
          <p className="flex items-center justify-center gap-1.5 text-caption font-medium text-ink-on-dark lg:justify-start">
            <ChevronsLeftRight className="size-4" aria-hidden />
            <span className="lg:hidden">Swipe for more photos</span>
            <span className="hidden lg:inline">Use ← → to browse · Esc to close</span>
          </p>
        )}
        {photo && keepsakeActions ? (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <p className="text-micro font-bold tracking-[0.08em] text-ink-on-dark uppercase">Keepsake</p>
              <div className="flex gap-3">{keepsakeActions(photo)}</div>
            </div>
            {photo.downloadUrl && (
              <div className="flex items-center justify-between gap-3 border-t border-white/10 pt-3">
                <div className="flex flex-col">
                  <p className="text-micro font-bold tracking-[0.08em] text-ink-on-dark uppercase">Original photo</p>
                  <p className="text-caption font-medium text-ink-on-dark">Exactly as you took it</p>
                </div>
                <ButtonAnchor href={photo.downloadUrl} variant="frosted" size="sm" className="h-11">
                  <Download aria-hidden />
                  Download
                </ButtonAnchor>
              </div>
            )}
          </div>
        ) : (
          actions && (
            <div className="flex gap-3 lg:flex-col">
              <ButtonAnchor href={photo.downloadUrl!} className="flex-1 lg:flex-none">
                <Download aria-hidden />
                {downloadLabel}
              </ButtonAnchor>
            </div>
          )
        )}
      </div>
    </div>
  );
}

/** Pager dots (DS03): active dot stretches to 18px. Shows a window of at most 5 dots. */
function PagerDots({
  count,
  current,
  className,
}: {
  count: number;
  current: number;
  className?: string;
}) {
  const windowSize = Math.min(5, count);
  const start = Math.min(Math.max(0, current - 2), count - windowSize);
  return (
    <div className={cn("flex items-center justify-center gap-1.5", className)} aria-hidden>
      {Array.from({ length: windowSize }, (_, i) => {
        const index = start + i;
        return (
          <span
            key={index}
            className={cn(
              "h-1.5 rounded-full transition-[width,background-color]",
              index === current ? "w-[18px] bg-ink-inverse" : "w-1.5 bg-ink-inverse/40",
            )}
          />
        );
      })}
    </div>
  );
}
