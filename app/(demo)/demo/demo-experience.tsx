"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FrameGrid, type FrameState } from "@/app/(guest)/e/[token]/frame-grid";
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

export function DemoExperience() {
  const [frames, setFrames] = useState<DemoFrames>(() => createEmptyDemoFrames());
  const [pickerOpen, setPickerOpen] = useState(false);
  const [composing, setComposing] = useState<Composing | null>(null);
  const [message, setMessage] = useState("");
  const [viewMode, setViewMode] = useState<"capture" | "preview">("capture");
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
  const hasAnyFilled = filledSlotCount(frames) > 0;

  function revokeOwnUrl(url: string) {
    URL.revokeObjectURL(url);
    ownUrlsRef.current.delete(url);
  }

  function openPicker() {
    setPickerOpen(true);
  }

  function closePicker() {
    setPickerOpen(false);
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
    setViewMode("capture");
  }

  const gridFrames = frames.map((slot, index): FrameState => {
    if (slot.kind === "filled") {
      return {
        kind: "filled",
        captureId: `demo-slot-${index}`,
        thumbnailUrl: slot.previewUrl,
        downloadUrl: null,
      };
    }
    if (composing && composing.index === index) {
      return { kind: "composing", previewUrl: composing.previewUrl, busy: false, error: false };
    }
    if (index === activeIndex) {
      return { kind: "active" };
    }
    return { kind: "future" };
  }) as [FrameState, FrameState, FrameState, FrameState, FrameState];

  return (
    <div className="flex flex-1 flex-col gap-6">
      <DemoBadgeHeader />

      {viewMode === "capture" ? (
        <>
          <p className="font-guest-display text-lg text-(--guest-ink)">
            {complete ? "These are yours to keep — for now." : "Try capturing a few frames."}
          </p>

          <FrameGrid frames={gridFrames} onActivate={openPicker} />

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
            <div className="flex flex-col gap-3 rounded-2xl border border-(--guest-border) bg-(--guest-canvas-raised) p-4">
              <p className="text-sm text-(--guest-ink-muted)">
                Use your own photo, or try a sample.
              </p>
              <Button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="bg-(--guest-accent) text-(--guest-accent-foreground) hover:bg-(--guest-accent)/90"
              >
                Choose or take a photo
              </Button>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {DEMO_SAMPLE_PHOTOS.map((sample) => (
                  <button
                    key={sample.id}
                    type="button"
                    onClick={() => chooseSample(sample)}
                    aria-label={sample.label}
                    className="size-16 flex-none overflow-hidden rounded-xl ring-1 ring-(--guest-border) transition-transform active:scale-95"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={sample.dataUrl} alt={sample.label} className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
              <Button type="button" variant="ghost" onClick={closePicker}>
                Cancel
              </Button>
            </div>
          )}

          {composing && (
            <div className="flex flex-col gap-3 rounded-2xl border border-(--guest-border) bg-(--guest-canvas-raised) p-4">
              <Textarea
                placeholder="Add a short message (optional)"
                value={message}
                maxLength={280}
                onChange={(e) => setMessage(e.target.value)}
                className="border-(--guest-border) bg-(--guest-canvas)"
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  onClick={keepFrame}
                  className="bg-(--guest-accent) text-(--guest-accent-foreground) hover:bg-(--guest-accent)/90"
                >
                  Keep this frame
                </Button>
                <Button type="button" variant="ghost" onClick={chooseDifferentPhoto}>
                  Choose a different photo
                </Button>
              </div>
            </div>
          )}

          {hasAnyFilled && !composing && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setViewMode("preview")}
              className="border-(--guest-border)"
            >
              See your gallery so far
            </Button>
          )}
        </>
      ) : (
        <>
          <p className="font-guest-display text-lg text-(--guest-ink)">
            A taste of a revealed FiveFrames gallery.
          </p>
          <FrameGrid frames={gridFrames} />
          <Button type="button" variant="outline" onClick={() => setViewMode("capture")} className="border-(--guest-border)">
            {complete ? "Back to your frames" : "Keep capturing"}
          </Button>
        </>
      )}

      <Button type="button" variant="ghost" onClick={startOver} className="self-start text-(--guest-ink-muted)">
        Start over
      </Button>

      <TrustAndConversion />
    </div>
  );
}

function DemoBadgeHeader() {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-guest-display w-fit rounded-full bg-(--guest-accent)/15 px-2.5 py-0.5 text-xs font-semibold tracking-wide text-(--guest-accent)">
        Demo
      </span>
      <h1 className="font-guest-display text-xl font-semibold text-(--guest-ink)">
        Five frames. That&rsquo;s the whole idea.
      </h1>
      <p className="text-sm text-(--guest-ink-muted)">
        This is a demo, not a real event. Photos stay on your device and are never uploaded or
        saved — reload this page any time to start fresh.
      </p>
    </div>
  );
}

function TrustAndConversion() {
  return (
    <div className="mt-auto flex flex-col gap-3 border-t border-(--guest-border) pt-5">
      <p className="text-sm text-(--guest-ink-muted)">
        Ready to run this at a real event? Creating an event needs host setup and payment — ₱
        {EVENT_PRICE_PHP} per event, pay once, no subscription.
      </p>
      <Button
        nativeButton={false}
        render={<Link href="/signup" />}
        className="bg-(--guest-accent) text-(--guest-accent-foreground) hover:bg-(--guest-accent)/90"
      >
        Create your event
      </Button>
    </div>
  );
}
