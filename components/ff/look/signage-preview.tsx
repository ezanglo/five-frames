"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { Download, Lock } from "lucide-react";
import { Button, ButtonAnchor } from "@/components/ff/button";
import { fieldControlClass } from "@/components/ff/field";
import type { AccentKey } from "@/lib/theme/accents";
import {
  TABLE_COUNT_MAX,
  TABLE_COUNT_MIN,
  TABLE_NUMBER_PREVIEW,
  parseTableCount,
  signageFormatsFor,
  signageFormatSpec,
  type SignageFormat,
} from "@/lib/media/signage-formats";
import type { PlanFeatures } from "@/lib/plans/registry";
import { cn } from "@/lib/utils";
import { SegmentedTabs, tabPanelProps } from "./segmented-tabs";

/**
 * Look → Signage (design-direction "Signage"; board §10). Every preview here is the production
 * renderer's own SVG (`/events/[id]/signage/[format]/preview`, architecture §7c), so the host sees
 * what prints. Before activation it carries the URL-less placeholder QR and there is no download;
 * afterwards it carries the real QR and each format downloads from the existing route.
 * Table-number cards preview one sample card and download as a set of the host's count.
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
 * Table-number cards: how many tables (the host's only input, never stored), then one ZIP of
 * that many cards. Enter never submits the surrounding Look form.
 */
function TableNumbersDownload({ eventId, disabled }: { eventId: string; disabled: boolean }) {
  const id = useId();
  const [value, setValue] = useState("");
  const count = parseTableCount(value.trim());
  const invalid = value.trim() !== "" && count === null;
  const label = count ? `Download ${count} card${count === 1 ? "" : "s"}` : "Download cards";

  let action: ReactNode;
  if (disabled || !count) {
    action = (
      <Button type="button" variant="dark" size="sm" disabled>
        <Download aria-hidden />
        {label}
      </Button>
    );
  } else {
    action = (
      <ButtonAnchor href={`/events/${eventId}/signage/table-numbers?count=${count}`} download variant="dark" size="sm">
        <Download aria-hidden />
        {label}
      </ButtonAnchor>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <label htmlFor={`${id}-count`} className="text-caption font-semibold text-ink">
          Tables
        </label>
        <input
          id={`${id}-count`}
          type="number"
          inputMode="numeric"
          min={TABLE_COUNT_MIN}
          max={TABLE_COUNT_MAX}
          step={1}
          placeholder={`${TABLE_COUNT_MIN}–${TABLE_COUNT_MAX}`}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.preventDefault();
          }}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? `${id}-error` : undefined}
          className={cn(fieldControlClass, "h-11 w-[5.5rem] px-3")}
        />
        {action}
      </div>
      {invalid && (
        <p id={`${id}-error`} className="text-caption font-medium text-danger" role="alert">
          Enter a whole number from {TABLE_COUNT_MIN} to {TABLE_COUNT_MAX}.
        </p>
      )}
    </div>
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
  features,
  dirty,
  large,
  initialFormat,
}: {
  look: SignageLook;
  /** Activated: paid for, or the account's Free event. */
  activated: boolean;
  /** Activated and the capture link is current: the real QR exists. */
  liveCode: boolean;
  /** The plan's formats: a Free event has the phone-screen format only (product.md §15.3.1). */
  features: PlanFeatures;
  dirty: boolean;
  large?: boolean;
  /** Open on this format when the plan has it (e.g. the dashboard's "Table numbers" link). */
  initialFormat?: SignageFormat;
}) {
  const idBase = useId();
  const formats = signageFormatsFor(features);
  const [format, setFormat] = useState<SignageFormat>(
    initialFormat && formats.some((f) => f.id === initialFormat)
      ? initialFormat
      : formats.some((f) => f.id === "table-card")
        ? "table-card"
        : formats[0].id,
  );
  const spec = signageFormatSpec(format);
  const portrait = spec.height > spec.width;
  const downloadLabel = `Download ${format === "qr" ? "QR" : spec.label.toLowerCase()}`;

  let note: string;
  if (!activated) note = "The code here is a placeholder. Your real QR and downloads arrive when you activate.";
  else if (!liveCode) note = "Your capture link is revoked, so there’s no code to print. Create a new one in Settings → Links.";
  else if (dirty) note = "Downloads use your saved look. Save your changes to download this one.";
  else if (format === "table-number") note = "Print-ready files to print yourself. Every card has your event’s real QR, the same on every table.";
  else if (format === "digital") note = "Uses your event’s real QR. Changing the look never changes where it points.";
  else note = "A print-ready file to print yourself. Uses your event’s real QR, and changing the look never changes where it points.";

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {formats.length > 1 ? (
          <SegmentedTabs
            idBase={idBase}
            label="Signage format"
            size="sm"
            value={format}
            onChange={setFormat}
            // Every chip stays visible on a phone rather than scrolling out of view.
            className="w-full sm:w-auto [&>button]:px-2.5 sm:[&>button]:px-4"
            tabs={formats.map((f) => ({ id: f.id, label: f.chip ?? f.label }))}
          />
        ) : (
          <p className="text-label font-semibold text-ink">
            Phone-screen sign
            <span className="block text-caption font-medium text-ink-muted">
              Print-ready signs come with Standard and Premium.
            </span>
          </p>
        )}
        {!liveCode ? (
          <DraftBadge />
        ) : format === "table-number" ? (
          <TableNumbersDownload eventId={look.eventId} disabled={dirty} />
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
        {...(formats.length > 1 ? tabPanelProps(idBase, format) : {})}
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
            {format === "table-number" && ` The preview shows table ${TABLE_NUMBER_PREVIEW}.`}
          </p>
          <p className="sm:max-w-[48%] sm:text-right" aria-live="polite">
            {note}
          </p>
        </div>
      </div>
    </div>
  );
}
