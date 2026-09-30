"use client";

import { useEffect, useId, useState } from "react";
import { Download, Lock } from "lucide-react";
import { Button, ButtonAnchor } from "@/components/ff/button";
import type { AccentKey } from "@/lib/theme/accents";
import {
  SIGNAGE_FORMAT_SPECS,
  signageFormatSpec,
  type SignageFormat,
} from "@/lib/media/signage-formats";
import { cn } from "@/lib/utils";
import { SegmentedTabs, tabPanelProps } from "./segmented-tabs";

/**
 * Look → Signage (design-direction "Signage"; board §10). Every preview here is the production
 * renderer's own SVG (`/events/[id]/signage/[format]/preview`, architecture §7c), so the host sees
 * what prints. Before activation it carries the URL-less placeholder QR and there is no download;
 * afterwards it carries the real QR and each format downloads from the existing route.
 */

export type SignageLook = {
  eventId: string;
  accent: AccentKey;
  hashtag: string | null;
  /** Changes whenever the theme image does, so the preview is re-rendered. */
  imageKey: string;
};

/** A short, stable key for the current theme image (never the URL itself). */
export function themeImageKey(imageUrl: string | null): string {
  if (!imageUrl) return "none";
  const path = imageUrl.split("?")[0];
  let hash = 5381;
  for (let i = 0; i < path.length; i++) hash = ((hash * 33) ^ path.charCodeAt(i)) >>> 0;
  return hash.toString(36);
}

function previewSrc(look: SignageLook, format: SignageFormat, attempt: number): string {
  const query = new URLSearchParams({ accent: look.accent, hashtag: look.hashtag ?? "", v: look.imageKey });
  if (attempt) query.set("r", String(attempt));
  return `/events/${look.eventId}/signage/${format}/preview?${query}`;
}

function useDebounced<T>(value: T, ms: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return settled;
}

/**
 * One format, as the renderer draws it. The last loaded version stays on screen while the next
 * one renders, so changing a color or typing a hashtag never flashes an empty card.
 */
export function SignageImage({
  look,
  format,
  className,
}: {
  look: SignageLook;
  format: SignageFormat;
  className?: string;
}) {
  const spec = signageFormatSpec(format);
  const hashtag = useDebounced(look.hashtag, 350);
  const [attempt, setAttempt] = useState(0);
  const src = previewSrc({ ...look, hashtag }, format, attempt);
  const [loaded, setLoaded] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  // A previous format's image must never stand in for this one.
  const previous = loaded?.includes(`/signage/${format}/`) ? loaded : null;

  return (
    <div
      className={cn("relative w-full overflow-hidden bg-surface", className)}
      style={{ aspectRatio: `${spec.width} / ${spec.height}` }}
    >
      {previous && previous !== src && (
        // eslint-disable-next-line @next/next/no-img-element -- host-only SVG from the signage renderer
        <img src={previous} alt="" aria-hidden className="absolute inset-0 size-full" draggable={false} />
      )}
      {/* eslint-disable-next-line @next/next/no-img-element -- host-only SVG from the signage renderer */}
      <img
        key={src}
        src={src}
        alt={`${spec.label} signage preview`}
        width={spec.width}
        height={spec.height}
        draggable={false}
        onLoad={() => setLoaded(src)}
        onError={() => setFailed(src)}
        className={cn(
          "absolute inset-0 size-full transition-opacity duration-200",
          loaded === src ? "opacity-100" : "opacity-0",
        )}
      />
      {failed === src && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-surface p-4 text-center">
          <p className="text-caption font-medium text-ink-muted">Couldn’t load this preview.</p>
          <Button type="button" variant="secondary" size="compact" onClick={() => setAttempt((a) => a + 1)}>
            Try again
          </Button>
        </div>
      )}
    </div>
  );
}

function DraftBadge() {
  return (
    <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-surface px-3 text-micro font-bold tracking-[0.06em] text-ink uppercase">
      <Lock className="size-3 text-warning" aria-hidden />
      Draft preview
    </span>
  );
}

/**
 * The Signage tab: format switcher, one large format with its size and use, and the Draft badge
 * or the Download action. Downloads use the saved look, so they wait while there are unsaved
 * changes rather than handing over something other than the preview.
 */
export function SignagePanel({
  look,
  activated,
  liveCode,
  dirty,
  large,
}: {
  look: SignageLook;
  /** Payment confirmed. */
  activated: boolean;
  /** Activated and the capture link is current: the real QR exists. */
  liveCode: boolean;
  dirty: boolean;
  large?: boolean;
}) {
  const idBase = useId();
  const [format, setFormat] = useState<SignageFormat>("table-card");
  const spec = signageFormatSpec(format);
  const portrait = spec.height > spec.width;
  const downloadLabel = `Download ${format === "qr" ? "QR" : spec.label.toLowerCase()}`;

  let note: string;
  if (!activated) note = "The code here is a placeholder. Your real QR and downloads arrive when you activate.";
  else if (!liveCode) note = "Your capture link is revoked, so there’s no code to print. Create a new one in Settings → Links.";
  else if (dirty) note = "Downloads use your saved look. Save your changes to download this one.";
  else note = "Uses your event’s real QR. Changing the look never changes where it points.";

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedTabs
          idBase={idBase}
          label="Signage format"
          size="sm"
          value={format}
          onChange={setFormat}
          // All four chips stay visible on a phone rather than scrolling out of view.
          className="w-full sm:w-auto [&>button]:px-2.5 sm:[&>button]:px-4"
          tabs={SIGNAGE_FORMAT_SPECS.map((f) => ({ id: f.id, label: f.label }))}
        />
        {!liveCode ? (
          <DraftBadge />
        ) : dirty ? (
          <Button type="button" variant="dark" size="sm" disabled>
            <Download aria-hidden />
            {downloadLabel}
          </Button>
        ) : (
          <ButtonAnchor href={`/events/${look.eventId}/signage/${format}`} download variant="dark" size="sm">
            <Download aria-hidden />
            {downloadLabel}
          </ButtonAnchor>
        )}
      </div>
      <div
        {...tabPanelProps(idBase, format)}
        className="flex flex-1 flex-col items-center justify-center gap-4"
      >
        <div
          className={cn(
            "shadow-[0_18px_36px_rgb(21_20_26/0.14)]",
            portrait ? (large ? "w-[min(100%,320px)]" : "w-[62%]") : large ? "w-[min(100%,560px)]" : "w-full",
          )}
        >
          <SignageImage look={look} format={format} />
        </div>
        <div className="flex w-full flex-col gap-1 text-caption font-medium text-ink-muted sm:flex-row sm:justify-between sm:gap-6">
          <p className="sm:max-w-[48%]">
            <span className="font-semibold text-ink">{spec.label}</span> · {spec.size}. {spec.use}
          </p>
          <p className="sm:max-w-[48%] sm:text-right" aria-live="polite">
            {note}
          </p>
        </div>
      </div>
    </div>
  );
}
