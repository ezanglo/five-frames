import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Marketing section frame (docs/design-direction.md → "Marketing site"). Same 1200 content
 * column and 20/40 side padding as the host desktop template; the page alternates white and
 * surface/subtle bands the way host pages put white cards on the grey page.
 */
export function Section({
  id,
  tone = "base",
  children,
  className,
  innerClassName,
  labelledBy,
}: {
  id?: string;
  tone?: "base" | "subtle" | "dark";
  children: ReactNode;
  className?: string;
  innerClassName?: string;
  labelledBy?: string;
}) {
  return (
    <section
      id={id}
      aria-labelledby={labelledBy}
      className={cn(
        "scroll-mt-20 px-5 py-16 sm:py-20 lg:px-10 lg:py-28",
        tone === "subtle" && "bg-surface-subtle",
        tone === "base" && "bg-surface",
        tone === "dark" && "bg-surface-dark text-ink-inverse",
        className,
      )}
    >
      <div className={cn("mx-auto w-full max-w-[1200px]", innerClassName)}>{children}</div>
    </section>
  );
}

/** Small violet label above a section title (the handoff's board labels, e.g. "PHASE 3"). */
export function Eyebrow({
  children,
  tone = "brand",
  className,
}: {
  children: ReactNode;
  tone?: "brand" | "light";
  className?: string;
}) {
  return (
    <p
      className={cn(
        "text-[12px] font-bold tracking-[0.08em] uppercase",
        tone === "brand" ? "text-brand" : "text-brand-highlight",
        className,
      )}
    >
      {children}
    </p>
  );
}

/** Eyebrow + Fraunces title + lead paragraph. Titles are h2 unless the page says otherwise. */
export function SectionHeader({
  id,
  eyebrow,
  title,
  lead,
  align = "left",
  tone = "light",
  as: Heading = "h2",
  className,
}: {
  id?: string;
  eyebrow?: ReactNode;
  title: ReactNode;
  lead?: ReactNode;
  align?: "left" | "center";
  tone?: "light" | "dark";
  as?: "h1" | "h2";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex max-w-[720px] flex-col gap-4",
        align === "center" && "mx-auto items-center text-center",
        className,
      )}
    >
      {eyebrow && <Eyebrow tone={tone === "dark" ? "light" : "brand"}>{eyebrow}</Eyebrow>}
      <Heading
        id={id}
        className={cn(
          "font-heading font-semibold text-balance",
          Heading === "h1"
            ? "text-hero lg:text-hero-desktop"
            : "text-display-create sm:text-display lg:text-page-desktop",
          tone === "dark" ? "text-ink-inverse" : "text-ink",
        )}
      >
        {title}
      </Heading>
      {lead && (
        <div
          className={cn(
            "text-body font-medium text-pretty sm:text-[17px] sm:leading-relaxed",
            tone === "dark" ? "text-ink-on-dark" : "text-ink-muted",
          )}
        >
          {lead}
        </div>
      )}
    </div>
  );
}

/** Icon + title + body block used in feature grids (white card on subtle, or plain on white). */
export function FeatureCard({
  icon,
  title,
  children,
  className,
  plain,
}: {
  icon?: ReactNode;
  title: ReactNode;
  children: ReactNode;
  className?: string;
  plain?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3",
        !plain && "rounded-xl border border-line bg-surface p-5 lg:rounded-3xl lg:p-6",
        className,
      )}
    >
      {icon && (
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-tint text-brand [&_svg]:size-5">
          {icon}
        </span>
      )}
      <h3 className="text-[17px] leading-snug font-bold text-ink">{title}</h3>
      <div className="text-label font-medium text-ink-muted">{children}</div>
    </div>
  );
}

/**
 * Sub-page hero: the photo-header treatment as a page band, with the page's h1. The first
 * section after it overlaps by 24px with sheet corners (pass `className="-mt-6 rounded-t-sheet
 * relative"`), the same header → sheet relationship every app screen uses.
 */
export function PageHero({
  eyebrow,
  title,
  lead,
  children,
}: {
  eyebrow: ReactNode;
  title: ReactNode;
  lead?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section aria-labelledby="page-title" className="relative overflow-hidden bg-surface-dark text-ink-inverse">
      <div aria-hidden className="ff-photo-header absolute inset-0 lg:hidden" />
      <div aria-hidden className="ff-photo-header-desktop absolute inset-0 hidden lg:block" />
      <div className="relative mx-auto flex w-full max-w-[1200px] flex-col gap-5 px-5 pt-12 pb-16 lg:px-10 lg:pt-20 lg:pb-24">
        <Eyebrow tone="light">{eyebrow}</Eyebrow>
        <h1 id="page-title" className="max-w-[860px] font-heading text-hero font-semibold text-balance lg:text-hero-desktop">
          {title}
        </h1>
        {lead && (
          <p className="max-w-[640px] text-body font-medium text-ink-inverse/85 sm:text-[18px] sm:leading-relaxed">
            {lead}
          </p>
        )}
        {children}
      </div>
    </section>
  );
}
