import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Wordmark } from "./wordmark";

/**
 * The guest shell (DS06 "Layout & developer handoff"): a 271px photo header under a night
 * gradient, a safe-area-aware top bar, the title block pinned to the header's bottom, and a
 * white sheet (radius/sheet top corners) sliding up 24px over it. The page behind is
 * surface/dark so the sheet's rounded corners blend. The one primary action sits at the bottom
 * of the sheet (margin-top: auto) inside thumb reach.
 *
 * Designed at 390, works 360–480. Above 480 the same column stays centered at 430px on
 * surface/dark with the header's glow blurred behind it — no separate desktop guest app.
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
  sheetClassName,
  headerClassName,
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
  sheetClassName?: string;
  headerClassName?: string;
}) {
  return (
    <div className="relative min-h-dvh bg-surface-dark">
      {/* Wide viewports: the header glow, blurred, fills the space around the 430px column. */}
      <div
        aria-hidden
        className="ff-photo-header pointer-events-none fixed inset-0 hidden opacity-70 blur-3xl min-[481px]:block"
      />
      <div className="relative mx-auto flex min-h-dvh w-full max-w-[430px] flex-col min-[481px]:shadow-[0_0_80px_rgb(0_0_0/0.45)]">
        <header
          className={cn(
            "ff-photo-header ff-safe-top relative flex min-h-[271px] flex-col px-5 pb-10 text-ink-inverse",
            headerClassName,
          )}
        >
          <div className="flex h-11 items-center justify-between gap-3">
            {topLeft ?? <Wordmark tone="light" />}
            {topRight}
          </div>
          <div className="mt-auto flex flex-col gap-2 pt-6">
            {pill}
            {eyebrow && <p className="text-caption font-medium text-ink-inverse/85">{eyebrow}</p>}
            <h1 className="font-heading text-display font-semibold break-words text-ink-inverse">
              {title}
            </h1>
            {subtitle && <p className="text-body font-medium text-ink-inverse/90">{subtitle}</p>}
            {meta && <p className="text-caption font-medium text-ink-inverse/80">{meta}</p>}
          </div>
        </header>
        <main
          className={cn(
            "ff-safe-bottom relative -mt-6 flex flex-1 flex-col gap-5 rounded-t-sheet bg-surface px-5 pt-6",
            sheetClassName,
          )}
        >
          {children}
        </main>
      </div>
    </div>
  );
}

/** A bottom-of-sheet action zone (DS06 ③): margin-top auto keeps the primary action low. */
export function SheetActions({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mt-auto flex flex-col gap-3 pt-2", className)}>{children}</div>;
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
