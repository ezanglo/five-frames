import type { CSSProperties, ReactNode } from "react";
import {
  Camera,
  Check,
  Download,
  EyeOff,
  Heart,
  Lock,
  Plus,
  RotateCcw,
  ShieldCheck,
  Smartphone,
  UserX,
} from "lucide-react";
import { StatusPill } from "@/components/ff/pill";
import { FiveShotTeaser, SHOTS_PER_GUEST } from "@/components/ff/shots";
import { scene } from "@/lib/marketing/sample-scenes";
import { cn } from "@/lib/utils";
import { PhotoPrint, ShotNumber } from "./photo-print";

/**
 * Marketing mockups of the real FiveFrames screens (guest 01–05, host 06–07), drawn from the
 * same tokens and primitives at phone scale — the way the Settings guest preview
 * (components/ff/guest-preview.tsx) already does. They are pictures, not UI: each frame is a
 * single `role="img"` with a label, and nothing inside is focusable. "Photos" are the
 * illustrated sample scenes, and every name and number is a labelled sample, never a claim.
 */

export const SAMPLE_EVENT = {
  name: "Santos Family Reunion",
  date: "Sat, Dec 20",
  guest: "Bea",
};

/** 300 × 600 phone with an ink bezel (the guest-preview bezel, one size up). */
export function PhoneFrame({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="img"
      aria-label={label}
      className={cn(
        "relative flex h-[600px] w-[300px] shrink-0 flex-col overflow-hidden rounded-[44px] border-[9px] border-ink bg-surface-dark shadow-[0_40px_80px_-24px_rgb(21_20_26/0.45)] select-none",
        className,
      )}
    >
      <span aria-hidden className="absolute top-2 left-1/2 z-20 h-[22px] w-[84px] -translate-x-1/2 rounded-full bg-ink" />
      {children}
    </div>
  );
}

function MockHeader({
  pill,
  title,
  subtitle,
  topRight,
  className,
}: {
  pill?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  topRight?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "ff-photo-header flex h-[206px] shrink-0 flex-col px-4 pt-10 pb-8 text-ink-inverse",
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-extrabold tracking-[-0.01em]">FiveFrames</span>
        {topRight}
      </div>
      <div className="mt-auto flex flex-col gap-1.5">
        {pill}
        <p className="font-heading text-[22px] leading-tight font-semibold">{title}</p>
        {subtitle && <p className="text-[11px] font-medium text-ink-inverse/85">{subtitle}</p>}
      </div>
    </div>
  );
}

function MockSheet({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "relative -mt-5 flex flex-1 flex-col gap-3 rounded-t-[22px] bg-surface px-4 pt-4 pb-5",
        className,
      )}
    >
      {children}
    </div>
  );
}

function MockPrimary({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "mt-auto flex h-10 items-center justify-center gap-1.5 rounded-full bg-brand text-[12px] font-semibold text-ink-inverse shadow-glow [&_svg]:size-3.5",
        className,
      )}
    >
      {children}
    </span>
  );
}

function SceneImg({ index, className }: { index: number; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element -- inline SVG illustration
  return <img src={scene(index).src} alt="" className={cn("size-full object-cover", className)} />;
}

/** Guest 01 · Join (open). */
export function JoinScreen() {
  return (
    <PhoneFrame label="The guest join screen: the event name, “You’ve got 5 shots”, a first-name field and a Join button, with no app and no account needed.">
      <MockHeader
        pill={
          <StatusPill tone="frosted" icon="live" size="sm">
            Capture is live
          </StatusPill>
        }
        title={SAMPLE_EVENT.name}
        subtitle={SAMPLE_EVENT.date}
      />
      <MockSheet>
        <div className="flex flex-col gap-1">
          <p className="font-heading text-[18px] font-semibold text-ink">
            You’ve got {SHOTS_PER_GUEST} shots.
          </p>
          <p className="text-[11px] leading-snug font-medium text-ink-muted">
            Catch the moments that matter to you. Every shot you keep goes into this event’s
            gallery.
          </p>
        </div>
        <FiveShotTeaser size="sm" />
        <ul className="flex flex-col gap-1.5 rounded-md bg-surface-subtle p-2.5 text-[10px] font-medium text-ink-muted [&_svg]:size-3 [&_svg]:text-brand">
          <li className="flex items-center gap-2">
            <Smartphone />
            No app to download
          </li>
          <li className="flex items-center gap-2">
            <UserX />
            No account — just your first name
          </li>
          <li className="flex items-center gap-2">
            <ShieldCheck />
            Your photos follow this event’s own access settings
          </li>
        </ul>
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold text-ink">What should we call you?</span>
          <span className="flex h-9 items-center rounded-[10px] border border-brand bg-surface px-3 text-[11px] font-medium text-ink shadow-[0_0_0_3px_color-mix(in_srgb,var(--brand-primary)_12%,transparent)]">
            {SAMPLE_EVENT.guest}
            <span aria-hidden className="ml-px h-3.5 w-px bg-brand" />
          </span>
        </div>
        <MockPrimary>Join &amp; start shooting</MockPrimary>
      </MockSheet>
    </PhoneFrame>
  );
}

/** Guest 02 · Your Five, with `taken` shots kept. Only the next slot is violet. */
export function YourFiveScreen({ taken, justKept }: { taken: number; justKept?: boolean }) {
  const left = SHOTS_PER_GUEST - taken;
  return (
    <PhoneFrame
      label={`The guest’s five frames: ${taken} kept, ${left} still open. The next frame is highlighted and the button reads “Take shot ${taken + 1}”.`}
    >
      <MockHeader
        className="h-[176px]"
        topRight={
          <StatusPill tone="frosted" icon="live" size="sm">
            Capture is live
          </StatusPill>
        }
        title={`Hi, ${SAMPLE_EVENT.guest}!`}
        subtitle={`Welcome to the ${SAMPLE_EVENT.name}`}
      />
      <MockSheet>
        <div className="flex items-baseline justify-between">
          <p className="text-[11px] font-semibold text-ink">
            <span className="tabular mr-1 text-[20px] font-extrabold text-brand">
              {left} of {SHOTS_PER_GUEST}
            </span>
            shots left
          </p>
          <span className="tabular text-[10px] font-medium text-ink-muted">{taken} taken</span>
        </div>
        <div className="grid grid-cols-5 gap-1">
          {Array.from({ length: SHOTS_PER_GUEST }, (_, i) => (
            <span key={i} className={cn("h-1 rounded-full", i < taken ? "bg-brand" : "bg-line")} />
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: SHOTS_PER_GUEST }, (_, i) => {
            if (i < taken) {
              return (
                <span
                  key={i}
                  className={cn(
                    "relative h-[104px] overflow-hidden rounded-[12px] bg-surface-subtle",
                    justKept && i === taken - 1 && "ring-2 ring-brand ring-offset-2",
                  )}
                >
                  <SceneImg index={i} />
                  <ShotNumber n={i + 1} />
                </span>
              );
            }
            const next = i === taken;
            return (
              <span
                key={i}
                className={cn(
                  "flex h-[104px] flex-col items-center justify-center gap-1 rounded-[12px]",
                  next
                    ? "border-[1.5px] border-dashed border-brand bg-brand-tint text-brand"
                    : "ff-dashed bg-surface-subtle text-ink-placeholder",
                )}
              >
                <span className="tabular text-[17px] font-semibold">{i + 1}</span>
                {next && <Camera className="size-3.5" />}
              </span>
            );
          })}
        </div>
        {justKept ? (
          <p className="flex items-center gap-2 rounded-md bg-success-tint px-3 py-2 text-[10px] font-semibold text-success">
            <Check className="size-3.5" strokeWidth={2.5} />
            Shot {taken} kept. It’s in the event’s collection.
          </p>
        ) : null}
        <MockPrimary>
          <Camera />
          Take shot {taken + 1}
        </MockPrimary>
      </MockSheet>
    </PhoneFrame>
  );
}

/** Guest 03 · Preview + Message. Retake is free; Keep is final. */
export function PreviewScreen({ shot = 3 }: { shot?: number }) {
  return (
    <PhoneFrame label="Previewing a photo before keeping it: an optional message, a note that kept photos are final and retakes are free, and Retake and Keep photo buttons.">
      <div className="relative h-[300px] shrink-0 overflow-hidden">
        <SceneImg index={shot - 1 + 3} />
        <span className="ff-frosted absolute top-9 left-1/2 flex h-8 -translate-x-1/2 items-center gap-2 rounded-full px-3 text-[10px] font-semibold whitespace-nowrap text-ink-inverse">
          <span className="flex items-center gap-1" aria-hidden>
            {Array.from({ length: SHOTS_PER_GUEST }, (_, i) => (
              <span
                key={i}
                className={cn(
                  "h-1 rounded-full",
                  i === shot - 1 ? "w-3 bg-brand-highlight" : i < shot - 1 ? "w-1 bg-ink-inverse" : "w-1 bg-ink-inverse/40",
                )}
              />
            ))}
          </span>
          Shot {shot} of {SHOTS_PER_GUEST}
        </span>
      </div>
      <MockSheet className="gap-2.5">
        <div className="flex items-baseline justify-between">
          <span className="text-[11px] font-semibold text-ink">
            Add a message <span className="font-medium text-ink-muted">optional</span>
          </span>
          <span className="tabular text-[10px] font-medium text-ink-muted">31/100</span>
        </div>
        <span className="flex h-14 items-start rounded-[10px] border border-line bg-surface-subtle p-2.5 text-[11px] font-medium text-ink">
          Lola’s famous leche flan, as promised
        </span>
        <p className="flex items-start gap-1.5 text-[10px] leading-snug font-medium text-ink-muted">
          <Lock className="mt-px size-3 shrink-0" />
          Once kept, this photo is final. Retakes are free and don’t use a shot.
        </p>
        <div className="mt-auto grid grid-cols-[auto_1fr] gap-2">
          <span className="flex h-10 items-center gap-1.5 rounded-full border border-line bg-surface-subtle px-4 text-[12px] font-semibold text-ink">
            <RotateCcw className="size-3.5" />
            Retake
          </span>
          <MockPrimary className="mt-0">
            <Check />
            Keep photo
          </MockPrimary>
        </div>
      </MockSheet>
    </PhoneFrame>
  );
}

/** Guest 05 · revealed gallery — the shared collection. */
export function CollectionScreen() {
  return (
    <PhoneFrame label="The revealed event gallery: a grid of everyone’s kept photos, opened when the host chose to reveal it.">
      <MockHeader
        className="h-[176px]"
        topRight={
          <StatusPill tone="frosted" icon="revealed-dot" size="sm">
            Gallery is open
          </StatusPill>
        }
        title="Relive the moments"
        subtitle={`${SAMPLE_EVENT.name} · ${SAMPLE_EVENT.date}`}
      />
      <MockSheet className="gap-2.5">
        <div className="flex gap-1.5">
          <span className="flex h-7 items-center rounded-full bg-brand px-3 text-[10px] font-semibold text-ink-inverse">
            All photos
          </span>
          <span className="flex h-7 items-center rounded-full border border-line px-3 text-[10px] font-semibold text-ink">
            Favorites
          </span>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {Array.from({ length: 12 }, (_, i) => (
            <span key={i} className="relative aspect-square overflow-hidden rounded-[8px] bg-surface-subtle">
              <SceneImg index={(i * 3 + 1) % 8} />
            </span>
          ))}
        </div>
        <p className="mt-auto text-center text-[10px] font-medium text-ink-muted">
          Tap a photo to see its message
        </p>
      </MockSheet>
    </PhoneFrame>
  );
}

/**
 * The table-card signage (product.md §11.3) held up at the venue. The QR is supplied by the
 * page — on the marketing site it opens the public demo, never an event.
 */
export function TableCardVisual({ qrSrc }: { qrSrc: string }) {
  return (
    <div
      role="img"
      aria-label="A FiveFrames table card at the venue: the event name, “Scan. You have five frames.”, a QR code and “No app. No account.”"
      className="flex h-[600px] w-[300px] shrink-0 items-center justify-center"
    >
      <div className="flex w-[264px] -rotate-2 flex-col items-center gap-4 rounded-[22px] border border-line bg-surface px-6 pt-7 pb-6 text-center shadow-[0_40px_80px_-24px_rgb(21_20_26/0.35)] motion-reduce:rotate-0">
        <span className="text-[13px] font-extrabold tracking-[-0.01em] text-ink">FiveFrames</span>
        <p className="font-heading text-[22px] leading-tight font-semibold text-ink">
          {SAMPLE_EVENT.name}
        </p>
        <div className="relative rounded-[14px] p-3">
          <span aria-hidden className="absolute top-0 left-0 size-5 rounded-tl-[10px] border-t-[3px] border-l-[3px] border-brand" />
          <span aria-hidden className="absolute top-0 right-0 size-5 rounded-tr-[10px] border-t-[3px] border-r-[3px] border-brand" />
          <span aria-hidden className="absolute bottom-0 left-0 size-5 rounded-bl-[10px] border-b-[3px] border-l-[3px] border-brand" />
          <span aria-hidden className="absolute right-0 bottom-0 size-5 rounded-br-[10px] border-r-[3px] border-b-[3px] border-brand" />
          {/* eslint-disable-next-line @next/next/no-img-element -- server-rendered QR data URI */}
          <img src={qrSrc} alt="" className="size-[150px]" />
        </div>
        <p className="text-[15px] font-bold text-ink">Scan. You have five frames.</p>
        <p className="text-[12px] font-semibold text-ink-muted">No app. No account.</p>
      </div>
    </div>
  );
}

/**
 * Host 06–07 · the event dashboard in a browser window: cover header, stat tiles, the capture
 * switch, and the Photos grid with a hidden and a favorited photo. Sample numbers.
 */
export function HostDashboardVisual({ className, wide }: { className?: string; wide?: boolean }) {
  return (
    <div
      role="img"
      aria-label="The host’s event dashboard: guests joined and photos taken, a switch to open or close capture, and a photo grid where a photo can be hidden or favorited."
      className={cn(
        "w-full overflow-hidden rounded-[20px] border border-line bg-surface-subtle shadow-[0_40px_80px_-32px_rgb(21_20_26/0.35)] select-none lg:rounded-[28px]",
        className,
      )}
    >
      <div className="flex h-9 items-center gap-1.5 border-b border-line bg-surface px-4">
        <span className="size-2.5 rounded-full bg-line" />
        <span className="size-2.5 rounded-full bg-line" />
        <span className="size-2.5 rounded-full bg-line" />
      </div>
      <div className="flex h-12 items-center justify-between border-b border-line bg-surface px-4 sm:px-6">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="text-[13px] font-extrabold tracking-[-0.01em] text-ink">FiveFrames</span>
            <span className="rounded-[5px] bg-brand px-1 text-[9px] font-bold text-ink-inverse">HOST</span>
          </span>
          <span className="hidden h-7 items-center rounded-full bg-brand-tint px-3 text-[11px] font-semibold text-brand sm:flex">
            Events
          </span>
        </div>
        <span className="flex h-7 items-center gap-1 rounded-full bg-brand px-3 text-[11px] font-semibold text-ink-inverse [&_svg]:size-3">
          <Plus />
          <span className="hidden sm:inline">Create new event</span>
          <span className="sm:hidden">New</span>
        </span>
      </div>
      <div className="ff-photo-header-desktop flex h-[132px] flex-col justify-end gap-1.5 px-4 pb-4 text-ink-inverse sm:h-[150px] sm:px-6">
        <StatusPill tone="frosted" icon="live" size="sm">
          Open · Capture is live
        </StatusPill>
        <p className="font-heading text-[24px] leading-tight font-semibold sm:text-[30px]">
          {SAMPLE_EVENT.name}
        </p>
        <p className="text-[11px] font-medium text-ink-inverse/80">{SAMPLE_EVENT.date} · Sample event</p>
      </div>
      <div className="flex gap-5 border-b border-line bg-surface px-4 text-[11px] font-semibold sm:px-6">
        <span className="border-b-2 border-brand py-2.5 text-ink">Dashboard</span>
        <span className="py-2.5 text-ink-muted">Photos</span>
        <span className="py-2.5 text-ink-muted">Settings</span>
      </div>
      <div className="grid gap-3 p-3 sm:grid-cols-[1fr_220px] sm:p-5">
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <MiniStat label="Guests joined" value="42" tint />
            <MiniStat label="Photos taken" value="131" />
          </div>
          <div className="rounded-[14px] border border-line bg-surface p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] font-bold text-ink">Photos</span>
              <span className="flex items-center gap-1 rounded-full bg-ink px-2.5 py-1 text-[9px] font-semibold text-ink-inverse [&_svg]:size-2.5">
                <Download />
                Download all
              </span>
            </div>
            <div className={cn("grid grid-cols-4 gap-1.5", wide && "lg:grid-cols-6")}>
              {Array.from({ length: wide ? 12 : 8 }, (_, i) =>
                i >= 8 ? (
                  <span key={i} className="relative hidden aspect-square overflow-hidden rounded-[8px] lg:block">
                    <SceneImg index={(i * 3 + 1) % 8} />
                  </span>
                ) : i === 5 ? (
                  <span
                    key={i}
                    className="ff-dashed flex aspect-square flex-col items-center justify-center gap-0.5 rounded-[8px] bg-surface-subtle text-[8px] font-bold tracking-[0.04em] text-ink-muted [&_svg]:size-3"
                  >
                    <EyeOff />
                    HIDDEN
                  </span>
                ) : (
                  <span key={i} className="relative aspect-square overflow-hidden rounded-[8px]">
                    <SceneImg index={(i * 5 + 2) % 8} />
                    {i === 1 && (
                      <span className="absolute top-1 right-1 flex size-4 items-center justify-center rounded-full bg-surface text-danger [&_svg]:size-2.5">
                        <Heart fill="currentColor" />
                      </span>
                    )}
                  </span>
                ),
              )}
            </div>
          </div>
        </div>
        <div className="hidden flex-col gap-3 sm:flex">
          <div className="flex flex-col gap-2 rounded-[14px] border border-line bg-surface p-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-ink">Capture</span>
              <span className="flex h-4 w-7 items-center justify-end rounded-full bg-brand p-0.5">
                <span className="size-3 rounded-full bg-surface" />
              </span>
            </div>
            <span className="text-[10px] font-medium text-ink-muted">Guests can take photos</span>
          </div>
          <div className="flex flex-col gap-2 rounded-[14px] border border-line bg-surface p-3">
            <span className="text-[11px] font-bold text-ink">Share with guests</span>
            <span className="flex h-7 items-center rounded-[8px] bg-surface-subtle px-2 text-[9px] font-medium text-ink-muted">
              fiveframes…/e/••••••
            </span>
            <div className="grid grid-cols-2 gap-1.5">
              <span className="flex h-6 items-center justify-center rounded-full bg-surface-subtle text-[9px] font-semibold text-ink">
                QR code
              </span>
              <span className="flex h-6 items-center justify-center rounded-full bg-surface-subtle text-[9px] font-semibold text-ink">
                Signage
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-2 rounded-[14px] bg-brand-tint p-3">
            <span className="text-[11px] font-bold text-ink">Gallery</span>
            <span className="text-[10px] font-medium text-ink-on-tint">Opens after the event</span>
            <span className="flex h-6 items-center justify-center rounded-full bg-surface text-[9px] font-semibold text-brand">
              Reveal gallery
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value, tint }: { label: string; value: string; tint?: boolean }) {
  return (
    <div className={cn("flex flex-col gap-1 rounded-[14px] p-3", tint ? "bg-brand-tint" : "border border-line bg-surface")}>
      <span className="text-[10px] font-medium text-ink-muted">{label}</span>
      <span className={cn("tabular text-[24px] leading-none font-extrabold", tint ? "text-brand" : "text-ink")}>
        {value}
      </span>
    </div>
  );
}

/**
 * Five kept frames as printed photos, tilted like the Join teaser — the "one guest's five" motif,
 * using the same five scenes as the hero prints. `entrance` adds the prints' drop-in: on page
 * load, or when an enclosing `<Reveal>` scrolls into view (docs/design-direction.md → "Marketing
 * motion"). The resting arrangement is the same either way.
 */
export function FiveKeptFrames({
  className,
  offset = 0,
  entrance,
}: {
  className?: string;
  offset?: number;
  entrance?: "load" | "reveal";
}) {
  return (
    <div aria-hidden className={cn("flex items-center justify-center gap-2 sm:gap-3", className)}>
      {KEPT_ARRANGEMENT.map((print, i) => (
        <span
          key={i}
          style={
            {
              "--i": i,
              "--ex": `${print.enterX}px`,
              "--ey": "28px",
              "--er": `${print.enterRotate}deg`,
            } as CSSProperties
          }
          className={cn(
            "block w-full max-w-[112px]",
            entrance === "load" && "ff-print-drop",
            entrance === "reveal" && "ff-print-drop-reveal",
          )}
        >
          <PhotoPrint
            src={scene(i + offset).src}
            shot={i + 1}
            style={{ transform: `translateY(${print.y}px) rotate(${print.rotate}deg)` }}
            className="aspect-[4/5] w-full rounded-[12px] border-[3px] border-surface sm:rounded-[16px] sm:border-4"
          />
        </span>
      ))}
    </div>
  );
}

/** Resting tilt and small vertical offsets, plus where each print drops in from. */
const KEPT_ARRANGEMENT = [
  { rotate: -6, y: 2, enterX: -18, enterRotate: -8 },
  { rotate: 3, y: -3, enterX: -8, enterRotate: 6 },
  { rotate: -2, y: 3, enterX: 0, enterRotate: -5 },
  { rotate: 6, y: -2, enterX: 8, enterRotate: 7 },
  { rotate: -3, y: 1, enterX: 18, enterRotate: -6 },
] as const;
