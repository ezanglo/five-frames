"use client";

import { useState, useTransition } from "react";
import { Download, Share } from "lucide-react";
import { Button } from "@/components/ff/button";
import { PhotoViewer, type ViewerPhoto } from "@/components/ff/photo-viewer";
import { ShotNumber, SHOTS_PER_GUEST } from "@/components/ff/shots";
import { formatEventTime } from "@/lib/events/format";
import { FullSetCard, useKeepsakePicker, type GuestKeepsakes } from "./keepsakes";

export type OwnPhoto = {
  id: string;
  slotIndex: number;
  message: string | null;
  capturedAt: string | null;
  thumbnailUrl: string | null;
  displayUrl: string | null;
  downloadUrl: string | null;
};

/**
 * A guest's own kept photos as a list (DS05 "Photo list row", guest 04 Completion): thumbnail
 * with its shot number, the guest's message or a muted italic "No message". Tapping a row opens
 * the dark viewer. A guest always keeps this private, downloadable view of their own captures,
 * independent of gallery visibility and after capture closes (product.md §8.3, §13).
 *
 * Keepsakes are offered only when the host allows them (product.md §10.3): each row's share
 * button and the viewer's Keepsake group open the "Make a keepsake" picker for that photo. A
 * keepsake is a separate image; the original download stays its own action.
 */
export function OwnPhotoList({
  timezone,
  guestName,
  keepsakes,
  photos,
}: {
  timezone: string;
  guestName: string | null;
  keepsakes: GuestKeepsakes | null;
  photos: OwnPhoto[];
}) {
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const { openFor, openFullSet, fullSetPhotos, picker } = useKeepsakePicker(keepsakes, photos);

  const viewerPhotos: ViewerPhoto[] = photos
    .filter((p) => p.thumbnailUrl)
    .map((p) => {
      const time = formatEventTime(p.capturedAt, timezone);
      return {
        id: p.id,
        src: p.displayUrl ?? p.thumbnailUrl!,
        alt: [`Your shot ${p.slotIndex + 1}`, time, p.message].filter(Boolean).join(", "),
        name: guestName,
        meta: time,
        badge: `Shot ${p.slotIndex + 1} of ${SHOTS_PER_GUEST}`,
        message: p.message,
        downloadUrl: p.downloadUrl,
      };
    });

  return (
    <div className="flex flex-col gap-3">
      {keepsakes && (
        <p className="-mt-1 text-caption font-medium text-ink-muted">
          <span className="lg:hidden">Tap a photo to see it, share it as a keepsake, or save the original.</span>
          <span className="hidden lg:inline">Open a photo to see it, share it as a keepsake, or save the original.</span>
        </p>
      )}
      {/* Phones: a compact list (DS05 photo list row). Desktop: the same rows become photo
          cards so each kept shot is seen as a photograph, not a 56px thumbnail. */}
      <ul className="flex flex-col gap-2 lg:grid lg:grid-cols-3 lg:gap-4 xl:grid-cols-5">
        {photos.map((photo) => {
          const index = viewerPhotos.findIndex((v) => v.id === photo.id);
          return (
            <li key={photo.id} className="relative flex items-center gap-3 lg:items-start">
              <button
                type="button"
                disabled={index === -1}
                onClick={() => setViewerIndex(index)}
                className="ff-focus group flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left lg:flex-col lg:items-stretch lg:gap-2.5"
                aria-label={`View shot ${photo.slotIndex + 1}${photo.message ? `: ${photo.message}` : ""}`}
              >
                <span className="relative size-14 shrink-0 overflow-hidden rounded-sm bg-surface-subtle lg:aspect-[4/5] lg:h-auto lg:w-full lg:rounded-lg">
                  {photo.thumbnailUrl && (
                    // eslint-disable-next-line @next/next/no-img-element -- short-lived signed url
                    <img
                      src={photo.thumbnailUrl}
                      alt=""
                      className="size-full object-cover transition-transform duration-300 lg:group-hover:scale-[1.03] motion-reduce:transition-none"
                    />
                  )}
                  <ShotNumber
                    n={photo.slotIndex + 1}
                    className="absolute top-1 left-1 size-5 text-[11px] lg:top-2 lg:left-2 lg:size-7 lg:text-micro"
                  />
                </span>
                <span
                  className={
                    photo.message
                      ? "line-clamp-2 text-label font-medium text-ink lg:line-clamp-3 lg:text-caption"
                      : "text-label font-medium text-ink-muted italic lg:text-caption"
                  }
                >
                  {photo.message ?? "No message"}
                </span>
              </button>
              {keepsakes && photo.displayUrl && (
                <Button
                  variant="secondary"
                  size="icon"
                  onClick={() => openFor(photo)}
                  aria-label={`Make a keepsake of shot ${photo.slotIndex + 1}`}
                  className="lg:absolute lg:top-2 lg:right-2 lg:shadow-card"
                >
                  <Share />
                </Button>
              )}
            </li>
          );
        })}
      </ul>
      {keepsakes && fullSetPhotos && (
        <FullSetCard keepsakes={keepsakes} photos={fullSetPhotos} onOpen={openFullSet} />
      )}

      {viewerIndex !== null && (
        <PhotoViewer
          photos={viewerPhotos}
          initialIndex={viewerIndex}
          onClose={() => setViewerIndex(null)}
          downloadLabel="Download original"
          keepsakeActions={
            keepsakes
              ? (viewed) => <KeepsakeViewerActions onOpen={() => {
                  const own = photos.find((p) => p.id === viewed.id);
                  if (own) openFor(own);
                }} />
              : undefined
          }
        />
      )}
      {picker}
    </div>
  );
}

/**
 * The own-photo viewer's Keepsake group (board §07 state 2): Share (the accent action) and Save
 * keepsake. Both open the picker, where the guest chooses the style first.
 */
export function KeepsakeViewerActions({ onOpen }: { onOpen: () => void }) {
  return (
    <>
      <Button size="md" className="flex-1" onClick={onOpen}>
        <Share aria-hidden />
        Share
      </Button>
      <Button variant="frosted" size="md" className="flex-1" onClick={onOpen}>
        <Download aria-hidden />
        Save keepsake
      </Button>
    </>
  );
}

/**
 * "Download my photos" — the guest's own originals, one after another. Same client-driven
 * sequential pattern as the host's bulk download (decision D11); each signed URL already carries
 * an attachment disposition, so each click saves rather than navigating away.
 */
export function DownloadOwnPhotosButton({ photos }: { photos: OwnPhoto[] }) {
  const [pending, startTransition] = useTransition();
  const downloadable = photos.filter((p) => p.downloadUrl);

  function handleClick() {
    startTransition(async () => {
      for (const photo of downloadable) {
        const anchor = document.createElement("a");
        anchor.href = photo.downloadUrl!;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        await new Promise((resolve) => setTimeout(resolve, 400));
      }
    });
  }

  return (
    <Button onClick={handleClick} disabled={pending || downloadable.length === 0} className="w-full">
      <Download aria-hidden />
      {pending
        ? "Saving your photos…"
        : downloadable.length === 1
          ? "Download my photo"
          : "Download my photos"}
    </Button>
  );
}
