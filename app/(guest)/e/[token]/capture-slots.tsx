"use client";

import { useEffect, useRef, useState } from "react";
import * as tus from "tus-js-client";
import { reserveSlot, commitSlot } from "./actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RESUMABLE_UPLOAD_THRESHOLD_BYTES, TUS_CHUNK_SIZE_BYTES } from "@/lib/media/constants";
import type { ReserveResponse } from "./actions";

type SlotStatus = "committed" | "pending";
type Slot = {
  id: string;
  status: SlotStatus;
  thumbnailUrl: string | null;
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

export function CaptureSlots({
  token,
  eventId,
  initialCaptures,
}: {
  token: string;
  eventId: string;
  initialCaptures: {
    id: string;
    slotIndex: number;
    status: SlotStatus;
    thumbnailUrl: string | null;
    downloadUrl: string | null;
  }[];
}) {
  const [slots, setSlots] = useState<Slot[]>(() => {
    const next: Slot[] = [null, null, null, null, null];
    for (const c of initialCaptures) {
      next[c.slotIndex] = {
        id: c.id,
        status: c.status,
        thumbnailUrl: c.thumbnailUrl,
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
  const pendingKeyRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
            thumbnailUrl: null,
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
      setError("All five frames are already taken.");
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
        setError("Upload failed. Check your connection and try again — your frame is safe.");
        return;
      }
    } else {
      captureId = reserved.captureId;
      slotIndex = reserved.slotIndex;
    }

    setPhase("committing");
    const committed = await commitSlot(token, captureId, message);

    if (committed.kind === "committed") {
      setSlots((prev) => {
        const next = [...prev];
        next[slotIndex] = {
          id: captureId,
          status: "committed",
          thumbnailUrl: committed.thumbnailUrl,
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
      setError("We couldn't confirm the upload yet. Try again.");
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
    setError("Something went wrong. Try again.");
  }

  const capturedCount = slots.filter((s) => s?.status === "committed").length;
  const nextEmptyIndex = slots.findIndex((s) => s === null);
  const busy = phase === "reserving" || phase === "uploading" || phase === "committing";

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-muted-foreground">{capturedCount} of 5 frames captured</p>

      <div className="grid grid-cols-3 gap-3">
        {slots.map((slot, index) =>
          slot?.status === "committed" && slot.thumbnailUrl ? (
            <a
              key={index}
              href={slot.downloadUrl ?? undefined}
              download
              className="block aspect-square overflow-hidden rounded-lg border"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={slot.thumbnailUrl}
                alt="Your capture"
                className="h-full w-full object-cover"
              />
            </a>
          ) : (
            <div
              key={index}
              className="flex aspect-square items-center justify-center rounded-lg border text-xs text-muted-foreground"
            >
              {slot?.status === "committed"
                ? "Captured"
                : slot?.status === "pending"
                  ? "Uploading…"
                  : index === nextEmptyIndex && phase === "idle"
                    ? null
                    : "Frame"}
            </div>
          ),
        )}
      </div>

      {phase === "resuming" && (
        <p className="text-sm text-muted-foreground">
          You have a photo still in progress. Choose it again to finish, or pick a new one.
        </p>
      )}

      {(phase === "idle" || phase === "resuming") && nextEmptyIndex !== -1 && (
        <div>
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
          <Button type="button" onClick={() => fileInputRef.current?.click()}>
            Add a photo
          </Button>
        </div>
      )}

      {nextEmptyIndex === -1 && (
        <p className="text-sm text-muted-foreground">
          All five frames are captured. Thanks for sharing these moments.
        </p>
      )}

      {selectedFile && previewUrl && (phase === "previewing" || busy || phase === "error") && (
        <div className="flex flex-col gap-3 rounded-lg border p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewUrl} alt="Selected capture preview" className="max-h-64 rounded-md object-contain" />

          <Textarea
            placeholder="Add a short message (optional)"
            value={message}
            maxLength={280}
            onChange={(e) => setMessage(e.target.value)}
            disabled={busy}
          />

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex gap-2">
            <Button type="button" onClick={confirmAttempt} disabled={busy}>
              {phase === "uploading"
                ? "Uploading…"
                : phase === "committing"
                  ? "Saving…"
                  : phase === "reserving"
                    ? "Confirming…"
                    : phase === "error"
                      ? "Try again"
                      : "Keep this frame"}
            </Button>
            {!busy && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  resetAttemptUI();
                  setPhase(pendingKeyRef.current ? "resuming" : "idle");
                }}
              >
                Choose a different photo
              </Button>
            )}
          </div>
        </div>
      )}

      {!selectedFile && error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
