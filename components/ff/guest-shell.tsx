import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { FrameMotif } from "./frame-motif";
import { Wordmark } from "./wordmark";

/**
 * The guest shell (DS06 "Layout & developer handoff"): a 271px photo header under a night
 * gradient, a safe-area-aware top bar, the title block pinned to the header's bottom, and a
 * white sheet (radius/sheet top corners) sliding up 24px over it. The page behind is
 * surface/dark so the sheet's rounded corners blend. The one primary action sits at the bottom
 * of the sheet (margin-top: auto) inside thumb reach.
 *
 * Guests are mobile-first — designed at 390, works 360–480 — but laptops and tablets are
 * first-class too (docs/design-direction.md → "Desktop and browser"), so the same markup
 * recomposes instead of centering a phone:
 *
 * - `split` (default; every status/action screen): 481–767 keeps the 430px column centered on
 *   the blurred glow, 768–1023 widens it to 600px, and ≥1024 becomes a two-region page — the
 *   header grows into a sticky, full-height event story panel (5/12, Fraunces 48, the five-frame
 *   motif filled with `motifPhotos`, optional desktop-only `panel` content) and the sheet
 *   becomes a white action region with the content vertically centered in a readable column.
 * - `wide` (the revealed gallery): from 768 the header becomes a full-width band and the sheet a
 *   1200px content column, so a photo grid can use the whole browser.
 *
 * FiveFrames has no event cover image (see docs/design-direction.md "Known discrepancies"), so
 * the header uses the handoff's no-cover treatment: night surface with a violet glow.
 */
export function GuestShell({
  topLeft,
  topRight,
  pill,
  eyebrow,
  title,
  subtitle,
  meta,
  children,
  panel,
  motifPhotos,
  variant = "split",
  width = "default",
}: {
  topLeft?: ReactNode;
  topRight?: ReactNode;
  /** Status pill directly above the title (Join screens). */
  pill?: ReactNode;
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  meta?: ReactNode;
  children: ReactNode;
  /** Desktop-only (≥1024) supporting content under the title in the story panel. */
  panel?: ReactNode;
  /** Photos that fill the story panel's five-frame motif (≥1024), e.g. the guest's own shots. */
  motifPhotos?: string[];
  variant?: "split" | "wide";
  /** Width of the desktop action column: `default` 480 (forms, status), `wide` 760 (shot grids). */
  width?: "default" | "wide";
}) {
  const topBar = (
    <div className="relative flex h-11 items-center justify-between gap-3">
      {topLeft ?? <Wordmark tone="light" />}
      {topRight}
    </div>
  );

  if (variant === "wide") {
    return (
      <div className="relative min-h-dvh bg-surface-dark md:bg-surface">
        <div
          aria-hidden
          className="ff-photo-header pointer-events-none fixed inset-0 hidden opacity-70 blur-3xl min-[481px]:block md:hidden"
        />
        <div className="relative mx-auto flex min-h-dvh w-full max-w-[430px] flex-col min-[481px]:shadow-[0_0_80px_rgb(0_0_0/0.45)] md:max-w-none md:shadow-none">
          <header className="ff-photo-header ff-safe-top relative flex min-h-[271px] flex-col px-5 pb-10 text-ink-inverse md:min-h-[300px] md:px-10 md:pb-16">
            <div className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col">
              {topBar}
              <TitleBlock pill={pill} eyebrow={eyebrow} title={title} subtitle={subtitle} meta={meta} wide />
            </div>
          </header>
          <main className="ff-safe-bottom relative -mt-6 flex flex-1 flex-col rounded-t-sheet bg-surface px-5 pt-6 md:px-10 md:pt-10 md:pb-16">
            <div className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col gap-5 md:gap-6">
              {children}
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-dvh bg-surface-dark lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:bg-surface">
      {/* 481–1023: the header glow, blurred, fills the space around the centered column. */}
      <div
        aria-hidden
        className="ff-photo-header pointer-events-none fixed inset-0 hidden opacity-70 blur-3xl min-[481px]:block lg:hidden"
      />
      <div className="relative mx-auto flex min-h-dvh w-full max-w-[430px] flex-col min-[481px]:shadow-[0_0_80px_rgb(0_0_0/0.45)] md:max-w-[600px] lg:contents">
        <header className="ff-photo-header ff-safe-top relative flex min-h-[271px] flex-col px-5 pb-10 text-ink-inverse md:min-h-[300px] md:px-8 lg:sticky lg:top-0 lg:h-dvh lg:overflow-y-auto lg:px-12 lg:py-10 xl:px-16 xl:py-12">
          <FrameMotif photos={motifPhotos} extent={panel ? 0.42 : 0.55} className="hidden lg:block" />
          {topBar}
          <TitleBlock pill={pill} eyebrow={eyebrow} title={title} subtitle={subtitle} meta={meta} />
          {panel && <div className="relative mt-8 hidden lg:block">{panel}</div>}
        </header>
        <main className="ff-safe-bottom relative -mt-6 flex flex-1 flex-col rounded-t-sheet bg-surface px-5 pt-6 md:px-8 md:pt-8 lg:mt-0 lg:min-h-dvh lg:justify-center lg:rounded-none lg:px-12 lg:py-16 xl:px-16">
          <div
            data-width={width}
            className={cn(
              "group/sheet flex flex-1 flex-col gap-5 lg:mx-auto lg:w-full lg:flex-none lg:gap-6",
              width === "wide" ? "lg:max-w-[760px]" : "lg:max-w-[480px]",
            )}
          >
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

function TitleBlock({
  pill,
  eyebrow,
  title,
  subtitle,
  meta,
  wide,
}: {
  pill?: ReactNode;
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  meta?: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={cn("relative mt-auto flex flex-col gap-2 pt-6", wide ? "md:gap-3" : "lg:gap-3")}>
      {pill}
      {eyebrow && (
        <p className={cn("text-caption font-medium text-ink-inverse/85", wide ? "md:text-label" : "lg:text-label")}>
          {eyebrow}
        </p>
      )}
      <h1
        className={cn(
          "font-heading text-display font-semibold break-words text-ink-inverse",
          wide ? "md:text-display-desktop" : "lg:text-display-desktop",
        )}
      >
        {title}
      </h1>
      {subtitle && (
        <p
          className={cn(
            "text-body font-medium text-ink-inverse/90",
            wide ? "md:text-[17px] md:leading-relaxed" : "lg:max-w-[440px] lg:text-[17px] lg:leading-relaxed",
          )}
        >
          {subtitle}
        </p>
      )}
      {meta && <p className="text-caption font-medium text-ink-inverse/80 lg:text-label">{meta}</p>}
    </div>
  );
}

/** A bottom-of-sheet action zone (DS06 ③): margin-top auto keeps the primary action low. */
export function SheetActions({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        // Desktop has no thumb zone: the action stays with the content instead of pinning low,
        // and in a wide column it keeps a button-sized width rather than spanning 760px.
        "mt-auto flex flex-col gap-3 pt-2 lg:mt-2 lg:group-data-[width=wide]/sheet:max-w-[420px]",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Quiet caption line under a primary action ("Closes when your host ends capture · No app needed"). */
export function ActionFootnote({ icon, children }: { icon?: ReactNode; children: ReactNode }) {
  return (
    <p className="flex items-center justify-center gap-1.5 text-center text-caption font-medium text-ink-muted [&_svg]:size-3.5 [&_svg]:shrink-0">
      {icon}
      {children}
    </p>
  );
}
