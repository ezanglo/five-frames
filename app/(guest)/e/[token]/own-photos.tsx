"use client";

import { useState, useTransition } from "react";
import { Download, RefreshCw, Share2 } from "lucide-react";
import { Button } from "@/components/ff/button";
import { PhotoViewer, type ViewerPhoto } from "@/components/ff/photo-viewer";
import { ShotNumber, SHOTS_PER_GUEST } from "@/components/ff/shots";
import { formatEventTime } from "@/lib/events/format";
import { useShareCapture } from "./use-share-capture";

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
 * Sharing is offered only when the host allows it (product.md §10) — it shares a separate
 * branded share card, never the gallery.
 */
export function OwnPhotoList({
  token,
  eventName,
  timezone,
  guestName,
  sharingEnabled,
  photos,
}: {
  token: string;
  eventName: string;
  timezone: string;
  guestName: string | null;
  sharingEnabled: boolean;
  photos: OwnPhoto[];
}) {
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const { share, pendingCaptureId, error, status } = useShareCapture(token, eventName);

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
      <ul className="flex flex-col gap-2">
        {photos.map((photo) => {
          const index = viewerPhotos.findIndex((v) => v.id === photo.id);
          const sharing = pendingCaptureId === photo.id;
          return (
            <li key={photo.id} className="flex items-center gap-3">
              <button
                type="button"
                disabled={index === -1}
                onClick={() => setViewerIndex(index)}
                className="ff-focus group flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left"
                aria-label={`View shot ${photo.slotIndex + 1}${photo.message ? `: ${photo.message}` : ""}`}
              >
                <span className="relative size-14 shrink-0 overflow-hidden rounded-sm bg-surface-subtle">
                  {photo.thumbnailUrl && (
                    // eslint-disable-next-line @next/next/no-img-element -- short-lived signed url
                    <img src={photo.thumbnailUrl} alt="" className="size-full object-cover" />
                  )}
                  <ShotNumber n={photo.slotIndex + 1} className="absolute top-1 left-1 size-5 text-[11px]" />
                </span>
                <span
                  className={
                    photo.message
                      ? "line-clamp-2 text-label font-medium text-ink"
                      : "text-label font-medium text-ink-muted italic"
                  }
                >
                  {photo.message ?? "No message"}
                </span>
              </button>
              {sharingEnabled && (
                <Button
                  variant="secondary"
                  size="iconSm"
                  onClick={() => share(photo.id)}
                  disabled={sharing}
                  aria-label={`Share shot ${photo.slotIndex + 1}`}
                >
                  {sharing ? <RefreshCw className="animate-spin" /> : <Share2 />}
                </Button>
              )}
            </li>
          );
        })}
      </ul>
      {error && (
        <p className="text-caption font-medium text-danger" role="alert">
          {error}
        </p>
      )}
      {!error && status && (
        <p className="text-caption font-medium text-ink-muted" role="status">
          {status}
        </p>
      )}

      {viewerIndex !== null && (
        <PhotoViewer
          photos={viewerPhotos}
          initialIndex={viewerIndex}
          onClose={() => setViewerIndex(null)}
        />
      )}
    </div>
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
