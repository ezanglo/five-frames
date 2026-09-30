import type { CSSProperties, ReactNode } from "react";
import { BrandLockup } from "@/components/ff/brand-mark";
import { cn } from "@/lib/utils";

/**
 * Host Look previews of signage (Slice 15 foundation; docs/design-direction.md → "Event Theme &
 * Keepsakes"). Presentational DOM compositions of the accepted board, drawn at each format's real
 * canvas size and scaled by FitCanvas. Not the production renderer: Slice 17 replaces these with
 * the real signage renderer and its live/placeholder QR. Nothing here can be downloaded, shared or
 * scanned — the QR plate is a non-code dot field — and none of it carries a link or token.
 * (Keepsake previews are the real templates: components/ff/keepsakes/keepsake-preview.tsx.)
 *
 * They expect to sit inside an `.ff-event-theme` scope so `brand-*` utilities take the event
 * color. Sample photography only: never a guest's capture.
 */

export type OutputPreviewContent = {
  name: string;
  dateLabel: string | null;
  hashtag: string | null;
  imageUrl: string | null;
};

function Img({ src, className, style }: { src: string; className?: string; style?: CSSProperties }) {
  // eslint-disable-next-line @next/next/no-img-element -- bundled sample art or a signed URL
  return <img src={src} alt="" draggable={false} className={cn("block", className)} style={style} />;
}

function MetaRow({ dateLabel, hashtag, size, dark }: { dateLabel: string | null; hashtag: string | null; size: number; dark?: boolean }) {
  if (!dateLabel && !hashtag) return null;
  return (
    <div className="flex min-w-0 items-center" style={{ gap: size * 0.45, fontSize: size }}>
      <span aria-hidden className="shrink-0 rounded-[3px] bg-brand-base" style={{ width: size * 0.6, height: size * 0.6 }} />
      {dateLabel && <span className={cn("shrink-0 font-semibold", dark ? "text-ink-inverse/85" : "text-ink-muted")}>{dateLabel}</span>}
      {hashtag && <span className={cn("truncate font-bold", dark ? "text-brand-highlight" : "text-brand-ink")}>#{hashtag}</span>}
    </div>
  );
}

/** Theme image under the night gradient, or night + a glow in the event color. */
function IdentityField({ imageUrl, className, children }: { imageUrl: string | null; className?: string; children?: ReactNode }) {
  return (
    <div className={cn("relative overflow-hidden text-ink-inverse", !imageUrl && "ff-photo-header", className)}>
      {imageUrl && (
        <>
          <Img src={imageUrl} className="absolute inset-0 size-full object-cover object-[50%_33%]" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgb(20_20_20/0.2),rgb(20_20_20/0.25)_45%,rgb(20_20_20/0.92))]" />
        </>
      )}
      <div className="relative flex size-full flex-col">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Signage
// ---------------------------------------------------------------------------------------------

export type SignageFormat = "qr" | "table-card" | "poster" | "digital";

export const SIGNAGE_FORMATS: {
  id: SignageFormat;
  label: string;
  width: number;
  height: number;
  size: string;
  use: string;
}[] = [
  { id: "qr", label: "QR", width: 600, height: 720, size: "Printable QR", use: "Tape it up anywhere guests arrive." },
  { id: "table-card", label: "Table card", width: 700, height: 500, size: "7 × 5 in", use: "Close-range scanning at a table or desk." },
  { id: "poster", label: "Poster", width: 1200, height: 1800, size: "24 × 36 in (2:3)", use: "Entrances and standing signs, readable from a distance." },
  { id: "digital", label: "Digital", width: 1920, height: 1080, size: "16:9 screen", use: "TVs, projectors, tablets and group chats." },
];

/**
 * The QR plate's footprint, filled with a pale dot field instead of a code: no finder patterns,
 * so it neither decodes nor looks like a working code. Always dark-on-light and never themed.
 */
function PlaceholderPlate({ size }: { size: number }) {
  const pad = Math.round(size * 0.1);
  const dot = Math.max(6, Math.round(size / 26));
  return (
    <div className="relative shrink-0 bg-surface" style={{ width: size, height: size, padding: pad }}>
      <div
        className="flex size-full items-center justify-center"
        style={{
          backgroundImage: "radial-gradient(circle, var(--color-border-dashed) 30%, transparent 34%)",
          backgroundSize: `${dot}px ${dot}px`,
        }}
      >
        <div className="flex flex-col items-center bg-surface text-center text-ink" style={{ padding: `${size * 0.03}px ${size * 0.06}px`, gap: size * 0.01 }}>
          <span className="font-extrabold tracking-[0.08em]" style={{ fontSize: size * 0.07 }}>PREVIEW</span>
          <span className="font-semibold text-ink-muted" style={{ fontSize: size * 0.045 }}>Not a working code</span>
        </div>
      </div>
    </div>
  );
}

/** Accent brackets sit outside the plate with a clear gap (design-direction "Signage"). */
function BracketedPlate({ size }: { size: number }) {
  const gap = Math.max(9, size * 0.05);
  const arm = size * 0.14;
  const stroke = Math.max(3, size * 0.014);
  const corners = [
    { top: 0, left: 0, borderTopWidth: stroke, borderLeftWidth: stroke },
    { top: 0, right: 0, borderTopWidth: stroke, borderRightWidth: stroke },
    { bottom: 0, left: 0, borderBottomWidth: stroke, borderLeftWidth: stroke },
    { bottom: 0, right: 0, borderBottomWidth: stroke, borderRightWidth: stroke },
  ];
  return (
    <div className="relative" style={{ padding: gap + stroke }}>
      {corners.map((c, i) => (
        <span key={i} aria-hidden className="absolute border-0 border-brand-base" style={{ ...c, width: arm, height: arm, borderStyle: "solid" }} />
      ))}
      <PlaceholderPlate size={size} />
    </div>
  );
}

function ScanCopy({ size }: { size: number }) {
  return (
    <div className="flex flex-col items-center text-center" style={{ gap: size * 0.3 }}>
      <p className="font-extrabold text-ink" style={{ fontSize: size }}>Scan. You have five frames.</p>
      <p className="font-semibold text-ink-muted" style={{ fontSize: size * 0.62 }}>No app. No account.</p>
    </div>
  );
}

function FieldTitle({ content, nameSize, lockupHeight, padding }: { content: OutputPreviewContent; nameSize: number; lockupHeight: number; padding: number }) {
  return (
    <div className="flex size-full flex-col justify-between" style={{ padding }}>
      <div className="self-start" style={{ height: lockupHeight }}>
        <BrandLockup tone="onDark" className="h-full" label="" />
      </div>
      <div className="flex flex-col" style={{ gap: nameSize * 0.2 }}>
        <p className="font-heading line-clamp-3 leading-[1.05] font-semibold" style={{ fontSize: nameSize }}>{content.name}</p>
        <MetaRow dateLabel={content.dateLabel} hashtag={content.hashtag} size={nameSize * 0.34} dark />
      </div>
    </div>
  );
}

export function SignagePreview({ format, content }: { format: SignageFormat; content: OutputPreviewContent }) {
  if (format === "qr") {
    return (
      <div className="relative flex size-full flex-col items-center bg-surface px-12 pt-10 font-sans text-ink">
        <div className="flex w-full items-center justify-between gap-4">
          <BrandLockup label="" className="h-[26px]" />
          {content.hashtag && <span className="truncate text-[20px] font-bold text-brand-ink">#{content.hashtag}</span>}
        </div>
        <p className="font-heading mt-6 line-clamp-2 text-center text-[40px] leading-[1.08] font-semibold">{content.name}</p>
        <div className="mt-5">
          <BracketedPlate size={300} />
        </div>
        <div className="mt-5">
          <ScanCopy size={24} />
        </div>
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-4 bg-brand-base" />
      </div>
    );
  }

  if (format === "table-card") {
    return (
      <div className="relative flex size-full bg-surface font-sans">
        <IdentityField imageUrl={content.imageUrl} className="h-full w-[280px] shrink-0">
          <FieldTitle content={content} nameSize={34} lockupHeight={20} padding={24} />
        </IdentityField>
        <div className="flex flex-1 flex-col items-center justify-center gap-4 pb-3">
          <BracketedPlate size={200} />
          <ScanCopy size={17} />
        </div>
        <div aria-hidden className="absolute right-0 bottom-0 left-[280px] h-2.5 bg-brand-base" />
      </div>
    );
  }

  if (format === "poster") {
    return (
      <div className="relative flex size-full flex-col bg-surface font-sans">
        <IdentityField imageUrl={content.imageUrl} className="h-[780px] w-full shrink-0">
          <FieldTitle content={content} nameSize={100} lockupHeight={48} padding={72} />
        </IdentityField>
        <div className="flex flex-1 flex-col items-center justify-center gap-10 pb-8">
          <BracketedPlate size={520} />
          <ScanCopy size={52} />
        </div>
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-6 bg-brand-base" />
      </div>
    );
  }

  return (
    <div className="relative flex size-full bg-surface font-sans">
      <IdentityField imageUrl={content.imageUrl} className="h-full w-[1040px] shrink-0">
        <FieldTitle content={content} nameSize={112} lockupHeight={52} padding={88} />
      </IdentityField>
      <div className="flex flex-1 flex-col items-center justify-center gap-10">
        <BracketedPlate size={480} />
        <ScanCopy size={44} />
      </div>
      <div aria-hidden className="absolute right-0 bottom-0 left-[1040px] h-5 bg-brand-base" />
    </div>
  );
}
