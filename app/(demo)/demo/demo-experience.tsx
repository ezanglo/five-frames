"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Camera, ImagePlus, Pointer, RotateCcw, Sparkles } from "lucide-react";
import { Button, ButtonLink } from "@/components/ff/button";
import { GuestShell, SheetActions } from "@/components/ff/guest-shell";
import { HighlightCard } from "@/components/ff/cards";
import { StatusPill } from "@/components/ff/pill";
import { Wordmark } from "@/components/ff/wordmark";
import { PhotoViewer, type ViewerPhoto } from "@/components/ff/photo-viewer";
import { PreviewSheet } from "@/components/ff/preview-sheet";
import { EmptySlotFace, ShotNumber, ShotProgress, SHOTS_PER_GUEST } from "@/components/ff/shots";
import { DEMO_SAMPLE_PHOTOS, type DemoSamplePhoto } from "@/lib/demo/samples";
import {
  createEmptyDemoFrames,
  filledSlotCount,
  isDemoComplete,
  nextEmptySlotIndex,
  withSlotFilled,
  type DemoFrames,
} from "@/lib/demo/state";
import { EVENT_PRICE_PHP } from "@/lib/payments/pricing";

type Composing = {
  index: number;
  source: "own" | "sample";
  previewUrl: string;
  /** Only an own-photo preview is a real object URL that needs revoking. */
  isOwnObjectUrl: boolean;
};

/**
 * The public pre-purchase demo (product.md §7.1, decision D14), in the same guest shell and
 * five-shot composition as a real event. Everything lives in this component's memory: no
 * server action, no upload, no persisted row, no link or token.
 */
export function DemoExperience() {
  const [frames, setFrames] = useState<DemoFrames>(() => createEmptyDemoFrames());
  const [pickerOpen, setPickerOpen] = useState(false);
  const [composing, setComposing] = useState<Composing | null>(null);
  const [message, setMessage] = useState("");
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Every own-photo object URL this demo has created, committed or still being composed, so a
  // discard, a reset, or leaving the page can revoke exactly the ones this demo itself made —
  // never a sample data URI, which needs no revocation.
  const ownUrlsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const urls = ownUrlsRef.current;
    return () => {
      for (const url of urls) URL.revokeObjectURL(url);
      urls.clear();
    };
  }, []);

  const activeIndex = composing ? -1 : nextEmptySlotIndex(frames);
  const complete = isDemoComplete(frames);
  const taken = filledSlotCount(frames);

  function revokeOwnUrl(url: string) {
    URL.revokeObjectURL(url);
    ownUrlsRef.current.delete(url);
  }

  function chooseOwnFile(file: File) {
    const index = nextEmptySlotIndex(frames);
    if (index === -1) return;
    const url = URL.createObjectURL(file);
    ownUrlsRef.current.add(url);
    setComposing({ index, source: "own", previewUrl: url, isOwnObjectUrl: true });
    setPickerOpen(false);
  }

  function chooseSample(sample: DemoSamplePhoto) {
    const index = nextEmptySlotIndex(frames);
    if (index === -1) return;
    setComposing({ index, source: "sample", previewUrl: sample.dataUrl, isOwnObjectUrl: false });
    setPickerOpen(false);
  }

  function discardComposing() {
    if (composing?.isOwnObjectUrl) revokeOwnUrl(composing.previewUrl);
    setComposing(null);
    setMessage("");
  }

  function chooseDifferentPhoto() {
    discardComposing();
    setPickerOpen(true);
  }

  function keepFrame() {
    if (!composing) return;
    // Already tracked in ownUrlsRef since creation — committing just stops treating it as
    // discardable-on-replace; it now lives for as long as the filled slot does.
    setFrames((prev) =>
      withSlotFilled(prev, composing.index, {
        kind: "filled",
        source: composing.source,
        previewUrl: composing.previewUrl,
        message: message.trim(),
      }),
    );
    setComposing(null);
    setMessage("");
  }

  function startOver() {
    for (const url of ownUrlsRef.current) URL.revokeObjectURL(url);
    ownUrlsRef.current.clear();
    setFrames(createEmptyDemoFrames());
    setComposing(null);
    setMessage("");
    setPickerOpen(false);
    setViewerIndex(null);
  }

  const viewerPhotos: ViewerPhoto[] = frames.flatMap((slot, index) =>
    slot.kind === "filled"
      ? [
          {
            id: `demo-slot-${index}`,
            src: slot.previewUrl,
            alt: `Demo shot ${index + 1}${slot.message ? `, ${slot.message}` : ""}`,
            badge: `Shot ${index + 1} of ${SHOTS_PER_GUEST}`,
            meta: "Demo — not saved",
            message: slot.message || null,
          },
        ]
      : [],
  );

  return (
    <>
      <GuestShell
        topLeft={<Wordmark tone="light" href="/" />}
        topRight={
          <StatusPill tone="frosted" icon="none">
            Demo · nothing is saved
          </StatusPill>
        }
        title="Everyone gets five shots."
        subtitle="Try it here — your photos stay on your device and are never uploaded."
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
          {frames.map((slot, index) => {
            if (slot.kind === "filled") {
              const viewer = viewerPhotos.findIndex((v) => v.id === `demo-slot-${index}`);
              return (
                <button
                  key={index}
                  type="button"
                  onClick={() => setViewerIndex(viewer)}
                  aria-label={`View demo shot ${index + 1}`}
                  className="ff-focus relative h-[150px] overflow-hidden rounded-lg bg-surface-subtle"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- local preview */}
                  <img src={slot.previewUrl} alt="" className="size-full object-cover" />
                  <ShotNumber n={index + 1} className="absolute top-2 left-2" />
                </button>
              );
            }
            if (index === activeIndex) {
              return (
                <button
                  key={index}
                  type="button"
                  onClick={() => setPickerOpen(true)}
                  aria-label={`Take demo shot ${index + 1}`}
                  className="ff-focus h-[150px] rounded-lg"
                >
                  <EmptySlotFace n={index + 1} next>
                    <Camera className="size-4" aria-hidden />
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
              Tap a photo to see it.
            </p>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) chooseOwnFile(file);
            e.target.value = "";
          }}
        />

        {pickerOpen && !composing && (
          <div className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-4">
            <Button
              variant="secondary"
              size="md"
              onClick={() => fileInputRef.current?.click()}
              className="w-full"
            >
              <ImagePlus aria-hidden />
              Use your own photo
            </Button>
            <p className="-mt-2 text-center text-caption font-medium text-ink-muted">
              Stays on your device — never uploaded.
            </p>
            <div className="flex items-center gap-2 text-caption font-medium text-ink-muted">
              <span className="h-px flex-1 bg-line" aria-hidden />
              or try a sample
              <span className="h-px flex-1 bg-line" aria-hidden />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {DEMO_SAMPLE_PHOTOS.map((sample) => (
                <button
                  key={sample.id}
                  type="button"
                  onClick={() => chooseSample(sample)}
                  aria-label={sample.label}
                  className="ff-focus size-16 flex-none overflow-hidden rounded-sm transition-transform active:scale-95"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={sample.dataUrl} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
            <Button variant="text" onClick={() => setPickerOpen(false)} className="self-center">
              Cancel
            </Button>
          </div>
        )}

        <HighlightCard
          icon={<Sparkles />}
          title="Ready for a real event?"
          body={
            <>
              Creating an event needs a host account and payment — ₱{EVENT_PRICE_PHP} per event,
              pay once, no subscription.{" "}
              <Link href="/signup" className="font-semibold text-brand underline-offset-4 hover:underline">
                Create your event
              </Link>
            </>
          }
        />

        <SheetActions>
          {complete ? (
            <ButtonLink href="/signup" className="w-full">
              Create your event
            </ButtonLink>
          ) : (
            <Button onClick={() => setPickerOpen(true)} className="w-full">
              <Camera aria-hidden />
              Take shot {activeIndex === -1 ? taken : activeIndex + 1}
            </Button>
          )}
          {taken > 0 && (
            <Button variant="text" onClick={startOver} className="self-center text-ink-muted">
              <RotateCcw className="size-4" aria-hidden />
              Start over
            </Button>
          )}
        </SheetActions>
      </GuestShell>

      {composing && (
        <PreviewSheet
          previewUrl={composing.previewUrl}
          shot={composing.index + 1}
          taken={taken}
          message={message}
          messageMax={100}
          onMessage={setMessage}
          keepState="idle"
          keepLabel="Keep photo"
          note="Demo only — this photo stays on your device and is never uploaded or saved."
          onDiscard={discardComposing}
          onRetake={chooseDifferentPhoto}
          onKeep={keepFrame}
        />
      )}

      {viewerIndex !== null && (
        <PhotoViewer
          photos={viewerPhotos}
          initialIndex={viewerIndex}
          onClose={() => setViewerIndex(null)}
        />
      )}
    </>
  );
}
