"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Check, Eye, ImagePlus, Info } from "lucide-react";
import {
  beginThemeImageUploadAction,
  commitThemeImageUploadAction,
  removeThemeImageAction,
} from "@/app/(host)/events/actions";
import {
  precheckThemeImageFile,
  THEME_IMAGE_REFUSAL_COPY,
  themeUploadContentType,
  type ThemeImageRefusal,
} from "@/lib/theme/image";
import { Button } from "@/components/ff/button";
import { ConfirmButton } from "@/components/ff/confirm-button";
import { cn } from "@/lib/utils";

type Phase =
  | { kind: "idle" }
  | { kind: "uploading"; progress: number; localUrl: string }
  | { kind: "processing"; localUrl: string }
  | { kind: "refused"; reason: ThemeImageRefusal }
  | { kind: "failed"; file: File };

const FAILED_COPY = "That upload didn’t finish. Your current image is unchanged.";

/** PUT to the signed upload URL with progress (fetch can't report upload progress). */
function putWithProgress(
  url: string,
  file: File,
  contentType: string,
  onProgress: (fraction: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("content-type", contentType);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(String(xhr.status))));
    xhr.onerror = () => reject(new Error("network"));
    xhr.send(file);
  });
}

/**
 * Theme image (design-direction "Theme image control states"; architecture §7a). This control
 * has its own persistence: the image saves the moment its upload commits — begin → direct upload
 * → server normalize → swap → prune — and Remove saves after a confirm. It never waits for the
 * surrounding form's Save changes or Continue, and it posts nothing with that form.
 *
 * Every refusal or failure leaves the current image exactly as it was, and says so. There is no
 * crop or position control: FiveFrames crops per surface.
 */
export function ThemeImageControl({
  eventId,
  imageUrl,
  small: initialSmall = false,
  onImageChange,
}: {
  eventId: string;
  imageUrl: string | null;
  small?: boolean;
  onImageChange: (imageUrl: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [small, setSmall] = useState(initialSmall);
  const [justSaved, setJustSaved] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const busy = phase.kind === "uploading" || phase.kind === "processing";

  // The local preview URL lives exactly as long as its attempt, and never past unmount.
  const localUrlRef = useRef<string | null>(null);
  function releaseLocalUrl() {
    if (localUrlRef.current) URL.revokeObjectURL(localUrlRef.current);
    localUrlRef.current = null;
  }
  useEffect(() => releaseLocalUrl, []);

  async function upload(file: File) {
    const precheck = precheckThemeImageFile(file);
    if (!precheck.ok) {
      setPhase({ kind: "refused", reason: precheck.reason });
      setAnnouncement(THEME_IMAGE_REFUSAL_COPY[precheck.reason]);
      return;
    }

    releaseLocalUrl();
    const localUrl = URL.createObjectURL(file);
    localUrlRef.current = localUrl;
    const contentType = themeUploadContentType(file);
    setJustSaved(false);
    setPhase({ kind: "uploading", progress: 0, localUrl });
    setAnnouncement("Uploading your theme image.");

    try {
      const begun = await beginThemeImageUploadAction(eventId, {
        sizeBytes: file.size,
        contentType,
      });
      if (begun.kind === "refused") {
        setPhase({ kind: "refused", reason: begun.reason });
        setAnnouncement(THEME_IMAGE_REFUSAL_COPY[begun.reason]);
        return;
      }
      if (begun.kind !== "ready") {
        setPhase({ kind: "failed", file });
        setAnnouncement(FAILED_COPY);
        return;
      }

      await putWithProgress(begun.signedUrl, file, contentType, (fraction) =>
        setPhase({ kind: "uploading", progress: fraction, localUrl }),
      );

      setPhase({ kind: "processing", localUrl });
      setAnnouncement("Getting your theme image ready.");
      const committed = await commitThemeImageUploadAction(eventId, begun.uploadId);

      if (committed.kind === "saved") {
        setSmall(committed.small);
        setJustSaved(true);
        setPhase({ kind: "idle" });
        onImageChange(committed.imageUrl);
        setAnnouncement("Theme image saved.");
      } else if (committed.kind === "refused") {
        setPhase({ kind: "refused", reason: committed.reason });
        setAnnouncement(THEME_IMAGE_REFUSAL_COPY[committed.reason]);
      } else {
        setPhase({ kind: "failed", file });
        setAnnouncement(FAILED_COPY);
      }
    } catch {
      setPhase({ kind: "failed", file });
      setAnnouncement(FAILED_COPY);
    } finally {
      releaseLocalUrl();
    }
  }

  async function remove() {
    const result = await removeThemeImageAction(eventId);
    if (result.kind === "removed") {
      setPhase({ kind: "idle" });
      setJustSaved(false);
      setSmall(false);
      onImageChange(null);
      setAnnouncement("Theme image removed.");
    }
  }

  const shownUrl = phase.kind === "uploading" || phase.kind === "processing" ? phase.localUrl : imageUrl;

  const fileInput = (
    <input
      ref={inputRef}
      type="file"
      // image/* rather than an explicit list: iOS then hands over its photos as JPEG.
      accept="image/*"
      className="sr-only"
      tabIndex={-1}
      aria-hidden
      onChange={(e) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (file) void upload(file);
      }}
    />
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-label font-semibold text-ink" id={`${eventId}-theme-image-label`}>
          Theme image
        </p>
        <span className="text-caption font-medium text-ink-muted">optional</span>
      </div>

      {shownUrl ? (
        <div className="relative aspect-[16/10] overflow-hidden rounded-lg bg-surface-dark">
          {/* eslint-disable-next-line @next/next/no-img-element -- signed or local preview URL */}
          <img
            src={shownUrl}
            alt="Your theme image"
            className={cn("size-full object-cover", busy && "opacity-60")}
          />
          {!busy && (justSaved || imageUrl) && (
            <span className="absolute top-3 left-3 inline-flex h-7 items-center gap-1 rounded-full bg-surface px-2.5 text-micro font-bold text-success shadow-card">
              <Check className="size-3.5" strokeWidth={3} aria-hidden />
              Saved
            </span>
          )}
          {phase.kind === "uploading" && (
            <ProgressCard label="Uploading…" value={phase.progress} />
          )}
          {phase.kind === "processing" && <ProgressCard label="Getting it ready…" />}
        </div>
      ) : (
        <div className="ff-dashed flex flex-col items-center gap-2 rounded-lg bg-surface-subtle px-5 py-6 text-center">
          <ImagePlus className="size-5 text-brand-ink" aria-hidden />
          <p className="text-label font-bold text-ink">Add a theme image</p>
          <p className="max-w-[280px] text-caption font-medium text-ink-muted">
            A photo or artwork for your event. JPG, PNG or HEIC. Big images look best on posters.
          </p>
          <Button
            variant="secondary"
            size="sm"
            className="mt-1 bg-surface"
            onClick={() => inputRef.current?.click()}
            aria-describedby={`${eventId}-theme-image-notice`}
          >
            Choose image
          </Button>
        </div>
      )}

      {busy && (
        <p className="text-caption font-medium text-ink-muted">You can keep editing while this finishes.</p>
      )}

      {shownUrl && !busy && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-caption font-medium text-ink-muted">Shown on guest screens, keepsakes and signage</p>
          <div className="flex shrink-0 items-center gap-1">
            <Button variant="secondary" size="sm" onClick={() => inputRef.current?.click()}>
              Replace
            </Button>
            {imageUrl && (
              <ConfirmButton
                action={remove}
                title="Remove theme image?"
                body="Guest screens, keepsakes and signage go back to the default look. You can add an image again anytime."
                confirmLabel="Remove"
                destructive
                variant="text"
                className="px-3 text-danger"
              >
                Remove
              </ConfirmButton>
            )}
          </div>
        </div>
      )}

      {phase.kind === "idle" && small && imageUrl && (
        <p className="flex items-start gap-2 text-caption font-medium text-ink">
          <Info className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
          This image is on the small side. It looks good on screens but may print a little soft on
          the poster.
        </p>
      )}
      {phase.kind === "refused" && (
        <p className="flex items-start gap-2 text-caption font-medium text-danger">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {THEME_IMAGE_REFUSAL_COPY[phase.reason]}
        </p>
      )}
      {phase.kind === "failed" && (
        <div className="flex items-start justify-between gap-3">
          <p className="flex items-start gap-2 text-caption font-medium text-danger">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            {FAILED_COPY}
          </p>
          <Button variant="secondary" size="sm" onClick={() => void upload(phase.file)}>
            Try again
          </Button>
        </div>
      )}

      {!shownUrl && (
        <p id={`${eventId}-theme-image-notice`} className="flex items-start gap-2 text-caption font-medium text-ink-muted">
          <Eye className="mt-0.5 size-4 shrink-0" aria-hidden />
          Anyone with your event link or signage can see it — it isn’t part of your private
          gallery.
        </p>
      )}

      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>
      {fileInput}
    </div>
  );
}

function ProgressCard({ label, value }: { label: string; value?: number }) {
  const percent = value === undefined ? undefined : Math.round(value * 100);
  return (
    <div className="absolute inset-x-3 bottom-3 flex flex-col gap-2 rounded-md bg-surface p-3 shadow-card">
      <div className="flex items-center justify-between text-caption font-semibold text-ink">
        <span>{label}</span>
        {percent !== undefined && <span className="tabular text-ink-muted">{percent}%</span>}
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="h-1.5 overflow-hidden rounded-full bg-line"
      >
        <div
          className={cn("h-full rounded-full bg-brand", percent === undefined && "animate-pulse")}
          style={{ width: `${percent ?? 100}%` }}
        />
      </div>
    </div>
  );
}
