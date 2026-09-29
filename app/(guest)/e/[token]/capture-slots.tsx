"use client";

import { useEffect, useRef, useState } from "react";
import * as tus from "tus-js-client";
import { Camera, Clock, Image as ImageIcon, Pointer, RefreshCw, Share2 } from "lucide-react";
import { reserveSlot, commitSlot } from "./actions";
import { RESUMABLE_UPLOAD_THRESHOLD_BYTES, TUS_CHUNK_SIZE_BYTES } from "@/lib/media/constants";
import type { ReserveResponse } from "./actions";
import { Button } from "@/components/ff/button";
import { ActionFootnote, GuestShell, SheetActions } from "@/components/ff/guest-shell";
import { HighlightCard, InfoCard } from "@/components/ff/cards";
import { StatusPill } from "@/components/ff/pill";
import { PhotoViewer, type ViewerPhoto } from "@/components/ff/photo-viewer";
import { PreviewSheet } from "@/components/ff/preview-sheet";
import { EmptySlotFace, ShotNumber, ShotProgress, SHOTS_PER_GUEST } from "@/components/ff/shots";
import { firstName, formatEventTime } from "@/lib/events/format";
import { DownloadOwnPhotosButton, OwnPhotoList, type OwnPhoto } from "./own-photos";
import { useShareCapture } from "./use-share-capture";

/** Guest message limit shown in the UI (DS04: max 100 guest). The server stays authoritative. */
const MESSAGE_MAX = 100;

type SlotStatus = "committed" | "pending";
type Slot = {
  id: string;
  status: SlotStatus;
  message: string | null;
  capturedAt: string | null;
  thumbnailUrl: string | null;
  displayUrl: string | null;
  downloadUrl: string | null;
} | null;

/**
 * Uploads directly to Supabase Storage over TUS (D7) — resumable in fixed 6MB chunks, and
 * automatically continues from a previous attempt's byte offset if this same file (by name,
 * size, type and last-modified) was already partway uploaded, including across a reload.
 */
function uploadViaTus(params: {
  file: File;
  endpoint: string;
  token: string;
  bucket: string;
  objectName: string;
}): Promise<void> {
  return new Promise((resolve, reject) => {
    const upload = new tus.Upload(params.file, {
      endpoint: params.endpoint,
      retryDelays: [0, 1000, 3000, 5000],
      chunkSize: TUS_CHUNK_SIZE_BYTES,
      headers: { "x-signature": params.token, "x-upsert": "true" },
      metadata: {
        bucketName: params.bucket,
        objectName: params.objectName,
        contentType: params.file.type || "application/octet-stream",
        cacheControl: "3600",
      },
      onError: (error) => reject(error),
      onSuccess: () => resolve(),
    });

    upload.findPreviousUploads().then((previousUploads) => {
      if (previousUploads.length > 0) {
        upload.resumeFromPreviousUpload(previousUploads[0]);
      }
      upload.start();
    });
  });
}

type Phase =
  | "idle"
  | "resuming"
  | "previewing"
  | "reserving"
  | "uploading"
  | "committing"
  | "error";

function pendingStorageKey(eventId: string) {
  return `ff_pending_reserve:${eventId}`;
}

/** Standard signed-URL PUT for typical phone photos; TUS above the threshold (D7). */
async function uploadFile(
  file: File,
  reserved: Extract<ReserveResponse, { kind: "reserved" }>,
): Promise<void> {
  if (file.size >= RESUMABLE_UPLOAD_THRESHOLD_BYTES) {
    await uploadViaTus({
      file,
      endpoint: reserved.resumableEndpoint,
      token: reserved.uploadToken,
      bucket: reserved.bucket,
      objectName: reserved.objectName,
    });
    return;
  }

  const putResponse = await fetch(reserved.uploadUrl, {
    method: "PUT",
    body: file,
    headers: { "content-type": file.type || "application/octet-stream" },
  });
  if (!putResponse.ok) throw new Error("upload failed");
}

/**
 * The guest's capture journey while capture is open (guest 02 Your Five → 03 Preview +
 * Message → 04 Completion). Presentation only changed in the redesign: the reserve → upload →
 * commit sequence, the client-persisted reserve key (D6), resumable upload (D7) and every
 * server-authoritative outcome are exactly as before. Retake is free; Keep is the only
 * committing action.
 */
export function CaptureSlots({
  token,
  eventId,
  eventName,
  eventDateLabel,
  timezone,
  guestName,
  sharingEnabled,
  initialCaptures,
}: {
  token: string;
  eventId: string;
  eventName: string;
  eventDateLabel: string | null;
  timezone: string;
  guestName: string;
  sharingEnabled: boolean;
  initialCaptures: {
    id: string;
    slotIndex: number;
    status: SlotStatus;
    message: string | null;
    capturedAt: string | null;
    thumbnailUrl: string | null;
    displayUrl: string | null;
    downloadUrl: string | null;
  }[];
}) {
  const [slots, setSlots] = useState<Slot[]>(() => {
    const next: Slot[] = [null, null, null, null, null];
    for (const c of initialCaptures) {
      next[c.slotIndex] = {
        id: c.id,
        status: c.status,
        message: c.message,
        capturedAt: c.capturedAt,
        thumbnailUrl: c.thumbnailUrl,
        displayUrl: c.displayUrl,
        downloadUrl: c.downloadUrl,
      };
    }
    return next;
  });
  const [phase, setPhase] = useState<Phase>("idle");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const pendingKeyRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { share, pendingCaptureId, error: shareError, status: shareStatus } = useShareCapture(
    token,
    eventName,
  );

  const storageKey = pendingStorageKey(eventId);

  useEffect(() => {
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(storageKey);
    } catch {
      return;
    }
    if (!raw) return;

    let reserveKey: string | undefined;
    try {
      reserveKey = JSON.parse(raw).reserveKey;
    } catch {
      clearPending();
      return;
    }
    if (!reserveKey) return;

    pendingKeyRef.current = reserveKey;
    reserveSlot(token, reserveKey).then((res) => {
      if (res.kind === "reserved") {
        setPhase("resuming");
      } else if (res.kind === "already_committed") {
        setSlots((prev) => {
          const next = [...prev];
          next[res.slotIndex] = {
            id: res.captureId,
            status: "committed",
            message: null,
            capturedAt: null,
            thumbnailUrl: null,
            displayUrl: null,
            downloadUrl: null,
          };
          return next;
        });
        clearPending();
      } else {
        clearPending();
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function clearPending() {
    pendingKeyRef.current = null;
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // Private browsing or blocked storage — nothing to clean up.
    }
    setPhase("idle");
  }

  function resetAttemptUI() {
    setSelectedFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setMessage("");
    setError(null);
  }

  function onFileChosen(file: File) {
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setError(null);
    setPhase("previewing");
  }

  function openPicker() {
    fileInputRef.current?.click();
  }

  /** Discard the previewed photo without committing anything — a free retake. */
  function discardPreview() {
    resetAttemptUI();
    setPhase(pendingKeyRef.current ? "resuming" : "idle");
  }

  function retake() {
    discardPreview();
    openPicker();
  }

  async function confirmAttempt() {
    if (!selectedFile) return;
    setError(null);
    setPhase("reserving");

    let key = pendingKeyRef.current;
    if (!key) {
      key = crypto.randomUUID();
      pendingKeyRef.current = key;
      try {
        localStorage.setItem(storageKey, JSON.stringify({ reserveKey: key }));
      } catch {
        // Attempt still works without persistence; it just won't survive a reload.
      }
    }

    const reserved = await reserveSlot(token, key);

    if (reserved.kind === "frames_exhausted") {
      setError("All five shots are already kept.");
      clearPending();
      resetAttemptUI();
      return;
    }
    if (reserved.kind === "capture_not_open") {
      setError("Capture has ended.");
      clearPending();
      resetAttemptUI();
      return;
    }
    if (reserved.kind === "expired") {
      setError("That attempt took too long. Please try again.");
      clearPending();
      resetAttemptUI();
      return;
    }
    if (reserved.kind === "not_joined") {
      setError("Your session isn't recognized. Reload the page and rejoin.");
      setPhase("error");
      return;
    }

    let captureId: string;
    let slotIndex: number;

    if (reserved.kind === "reserved") {
      captureId = reserved.captureId;
      slotIndex = reserved.slotIndex;
      setPhase("uploading");
      try {
        await uploadFile(selectedFile, reserved);
      } catch {
        setPhase("error");
        setError("Photo didn’t upload. Check your connection and tap Retry — your shot is safe.");
        return;
      }
    } else {
      captureId = reserved.captureId;
      slotIndex = reserved.slotIndex;
    }

    setPhase("committing");
    const keptMessage = message.trim() || null;
    const committed = await commitSlot(token, captureId, message);

    if (committed.kind === "committed") {
      setSlots((prev) => {
        const next = [...prev];
        next[slotIndex] = {
          id: captureId,
          status: "committed",
          message: committed.capture.message ?? keptMessage,
          capturedAt: committed.capture.committed_at,
          thumbnailUrl: committed.thumbnailUrl,
          displayUrl: committed.displayUrl,
          downloadUrl: committed.downloadUrl,
        };
        return next;
      });
      clearPending();
      resetAttemptUI();
      return;
    }
    if (committed.kind === "not_uploaded") {
      setPhase("error");
      setError("We couldn’t confirm the upload yet. Tap Retry — your shot is safe.");
      return;
    }
    if (committed.kind === "expired" || committed.kind === "capture_not_open") {
      setError(
        committed.kind === "expired"
          ? "That attempt took too long. Please try again."
          : "Capture has ended.",
      );
      clearPending();
      resetAttemptUI();
      return;
    }
    setPhase("error");
    setError("Something went wrong. Tap Retry — your shot is safe.");
  }

  const nextEmptyIndex = slots.findIndex((s) => s === null);
  const pendingIndex = slots.findIndex((s) => s?.status === "pending");
  const activeIndex = pendingIndex !== -1 ? pendingIndex : nextEmptyIndex;
  const busy = phase === "reserving" || phase === "uploading" || phase === "committing";
  const composing = Boolean(
    selectedFile && previewUrl && (phase === "previewing" || busy || phase === "error"),
  );
  const taken = slots.filter((s) => s?.status === "committed").length;
  const allCaptured = activeIndex === -1;
  const greetingName = firstName(guestName) ?? guestName;

  const keptPhotos: OwnPhoto[] = slots.flatMap((slot, index) =>
    slot?.status === "committed"
      ? [
          {
            id: slot.id,
            slotIndex: index,
            message: slot.message,
            capturedAt: slot.capturedAt,
            thumbnailUrl: slot.thumbnailUrl,
            displayUrl: slot.displayUrl,
            downloadUrl: slot.downloadUrl,
          },
        ]
      : [],
  );

  const viewerPhotos: ViewerPhoto[] = keptPhotos
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

  const fileInput = (
    <input
      ref={fileInputRef}
      type="file"
      accept="image/*"
      capture="environment"
      className="hidden"
      onChange={(e) => {
        const file = e.target.files?.[0];
        if (file) onFileChosen(file);
        e.target.value = "";
      }}
    />
  );

  const shareFeedback = (
    <>
      {shareError && (
        <p className="text-caption font-medium text-danger" role="alert">
          {shareError}
        </p>
      )}
      {!shareError && shareStatus && (
        <p className="text-caption font-medium text-ink-muted" role="status">
          {shareStatus}
        </p>
      )}
    </>
  );

  if (allCaptured && !composing) {
    return (
      <GuestShell
        topRight={
          <StatusPill tone="frosted" icon="check">
            All 5 shots in
          </StatusPill>
        }
        eyebrow={[eventName, eventDateLabel].filter(Boolean).join(" · ")}
        title={`That’s a wrap, ${greetingName}!`}
        subtitle="Thanks for sharing your five. Here’s what you captured."
      >
        <div className="flex items-baseline justify-between">
          <h2 className="text-heading font-bold text-ink">Your best moments</h2>
          <span className="tabular text-caption font-semibold text-brand">
            {taken} of {SHOTS_PER_GUEST} kept
          </span>
        </div>
        <OwnPhotoList
          token={token}
          eventName={eventName}
          timezone={timezone}
          guestName={guestName}
          sharingEnabled={sharingEnabled}
          photos={keptPhotos}
        />
        <HighlightCard
          icon={<ImageIcon />}
          title="The shared gallery comes later"
          body="Your host shares the full gallery through its own link when it’s ready. Your five stay here for you to download."
        />
        <SheetActions>
          <DownloadOwnPhotosButton photos={keptPhotos} />
        </SheetActions>
        {fileInput}
      </GuestShell>
    );
  }

  const nextShot = activeIndex + 1;

  return (
    <>
      <GuestShell
        topRight={
          <StatusPill tone="frosted" icon="live">
            Capture is live
          </StatusPill>
        }
        title={`Hi, ${greetingName}!`}
        subtitle={`Welcome to ${eventName}`}
        meta={eventDateLabel}
      >
        <div className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-label font-semibold text-ink">
              <span className="tabular mr-1.5 text-title font-extrabold text-brand">
                {SHOTS_PER_GUEST - taken} of {SHOTS_PER_GUEST}
              </span>
              shots left
            </p>
            <span className="tabular text-caption font-medium text-ink-muted">{taken} taken</span>
          </div>
          <ShotProgress taken={taken} />
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          {slots.map((slot, index) => {
            if (slot?.status === "committed") {
              const viewer = viewerPhotos.findIndex((v) => v.id === slot.id);
              return (
                <button
                  key={index}
                  type="button"
                  disabled={viewer === -1}
                  onClick={() => setViewerIndex(viewer)}
                  aria-label={`View shot ${index + 1}`}
                  className="ff-focus relative h-[150px] overflow-hidden rounded-lg bg-surface-subtle"
                >
                  {slot.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- short-lived signed url
                    <img src={slot.thumbnailUrl} alt="" className="size-full object-cover" />
                  ) : (
                    <span className="flex size-full items-center justify-center text-caption font-medium text-ink-muted">
                      Kept
                    </span>
                  )}
                  <ShotNumber n={index + 1} className="absolute top-2 left-2" />
                </button>
              );
            }
            if (index === activeIndex) {
              return (
                <button
                  key={index}
                  type="button"
                  onClick={openPicker}
                  aria-label={
                    phase === "resuming" ? `Finish shot ${nextShot}` : `Take shot ${nextShot}`
                  }
                  className="ff-focus h-[150px] rounded-lg"
                >
                  <EmptySlotFace n={index + 1} next>
                    {phase === "resuming" ? (
                      <RefreshCw className="size-4" aria-hidden />
                    ) : (
                      <Camera className="size-4" aria-hidden />
                    )}
                  </EmptySlotFace>
                </button>
              );
            }
            return (
              <div key={index} className="h-[150px]" aria-hidden>
                <EmptySlotFace n={index + 1} />
              </div>
            );
          })}
          {taken > 0 && (
            <p className="flex h-[150px] flex-col justify-center gap-2 px-1 text-caption font-medium text-ink-muted">
              <Pointer className="size-5" aria-hidden />
              Tap your photo to preview.
            </p>
          )}
        </div>

        {shareFeedback}

        {phase === "resuming" ? (
          <InfoCard
            icon={<RefreshCw />}
            title={`Shot ${nextShot} is still in progress`}
            body="Pick the photo again to finish it — this won’t use an extra shot."
          />
        ) : (
          <InfoCard
            icon={<Clock />}
            title="Capture is open"
            body="Your host closes capture when the party winds down."
          />
        )}

        <SheetActions>
          {error && !composing && (
            <p className="text-caption font-medium text-danger" role="alert">
              {error}
            </p>
          )}
          <Button onClick={openPicker} className="w-full">
            <Camera aria-hidden />
            {phase === "resuming" ? `Finish shot ${nextShot}` : `Take shot ${nextShot}`}
          </Button>
          <ActionFootnote>No rush — keep only the moments that matter.</ActionFootnote>
        </SheetActions>
        {fileInput}
      </GuestShell>

      {composing && previewUrl && (
        <PreviewSheet
          previewUrl={previewUrl}
          shot={nextShot}
          taken={taken}
          message={message}
          messageMax={MESSAGE_MAX}
          onMessage={setMessage}
          keepState={busy ? "busy" : phase === "error" ? "retry" : "idle"}
          keepLabel={
            phase === "uploading"
              ? "Uploading…"
              : phase === "committing"
                ? "Saving…"
                : phase === "reserving"
                  ? "Keeping…"
                  : phase === "error"
                    ? "Retry"
                    : "Keep photo"
          }
          error={error}
          onDiscard={discardPreview}
          onRetake={retake}
          onKeep={confirmAttempt}
        />
      )}

      {viewerIndex !== null && (
        <PhotoViewer
          photos={viewerPhotos}
          initialIndex={viewerIndex}
          onClose={() => setViewerIndex(null)}
          extraAction={
            sharingEnabled
              ? (photo) => (
                  <Button
                    variant="frosted"
                    size="lg"
                    onClick={() => share(photo.id)}
                    disabled={pendingCaptureId === photo.id}
                    aria-label="Share this photo"
                  >
                    {pendingCaptureId === photo.id ? (
                      <RefreshCw className="animate-spin" aria-hidden />
                    ) : (
                      <Share2 aria-hidden />
                    )}
                    Share
                  </Button>
                )
              : undefined
          }
        />
      )}
    </>
  );
}
