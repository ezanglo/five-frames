import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Plain white card. Desktop host cards sit white on the grey page with a 1px border (DS05). */
export function Card({
  children,
  className,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "section" | "article";
}) {
  return (
    <Tag className={cn("rounded-xl border border-line bg-surface lg:rounded-3xl", className)}>
      {children}
    </Tag>
  );
}

/** Outlined section card (DS05): host dashboard sections — 16 Bold title + caption, radius/xl. */
export function SectionCard({
  title,
  caption,
  action,
  children,
  className,
  titleFont = "brand",
}: {
  title: ReactNode;
  caption?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
  /** Desktop Settings card titles use Fraunces 22–24 (DS02 desktop headings). */
  titleFont?: "brand" | "heading";
}) {
  return (
    <section
      className={cn(
        "flex flex-col gap-4 rounded-xl border border-line bg-surface p-5 lg:rounded-3xl lg:p-6",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <h2
            className={cn(
              titleFont === "heading"
                ? "font-heading text-heading font-semibold lg:text-[24px] lg:leading-tight"
                : "text-[16px] leading-snug font-bold",
              "text-ink",
            )}
          >
            {title}
          </h2>
          {caption && <p className="text-caption font-medium text-ink-muted">{caption}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Info card (DS05): surface/subtle · 40px white icon circle · bold line + muted line. */
export function InfoCard({
  icon,
  title,
  body,
  className,
  live,
}: {
  icon: ReactNode;
  title: ReactNode;
  body?: ReactNode;
  className?: string;
  /** Countdown-like content announces politely (DS06 accessibility). */
  live?: boolean;
}) {
  return (
    <div
      className={cn("flex items-center gap-3 rounded-lg bg-surface-subtle p-4", className)}
      aria-live={live ? "polite" : undefined}
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface text-brand [&_svg]:size-5">
        {icon}
      </span>
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="text-label font-bold text-ink">{title}</p>
        {body && <p className="text-caption font-medium text-ink-muted">{body}</p>}
      </div>
    </div>
  );
}

/** Highlight card (DS05): brand/tint; secondary text uses text/on-tint. */
export function HighlightCard({
  icon,
  title,
  body,
  children,
  className,
}: {
  icon?: ReactNode;
  title: ReactNode;
  body?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-4 rounded-lg bg-brand-tint p-4", className)}>
      <div className="flex items-start gap-3">
        {icon && (
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface text-brand [&_svg]:size-5">
            {icon}
          </span>
        )}
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="text-label font-bold text-ink">{title}</p>
          {body && <div className="text-caption font-medium text-ink-on-tint">{body}</div>}
        </div>
      </div>
      {children}
    </div>
  );
}

/** Stat tile (DS05): 30 ExtraBold value. Lead stat on tint, secondary on subtle. */
export function StatTile({
  value,
  label,
  caption,
  tone = "subtle",
  children,
  className,
  labelFirst,
}: {
  value: ReactNode;
  label: ReactNode;
  caption?: ReactNode;
  tone?: "tint" | "subtle" | "white";
  children?: ReactNode;
  className?: string;
  /** Desktop dashboard tiles put the label above the value. */
  labelFirst?: boolean;
}) {
  const labelEl = <p className="text-caption font-medium text-ink-muted">{label}</p>;
  return (
    <div
      className={cn(
        "flex flex-col gap-1 rounded-lg p-4",
        tone === "tint" && "bg-brand-tint",
        tone === "subtle" && "bg-surface-subtle",
        tone === "white" && "border border-line bg-surface lg:rounded-3xl lg:p-5",
        className,
      )}
    >
      {labelFirst && labelEl}
      <p
        className={cn(
          "tabular text-[30px] leading-none font-extrabold tracking-[-0.01em]",
          tone === "tint" ? "text-brand" : "text-ink",
        )}
      >
        {value}
      </p>
      {!labelFirst && labelEl}
      {children}
      {caption && <p className="text-micro font-medium text-ink-muted">{caption}</p>}
    </div>
  );
}

/** Small uppercase group label used on mobile host screens ("LIVE NOW", "SHARE WITH GUESTS"). */
export function GroupLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <h2
      className={cn(
        "text-[11px] font-bold tracking-[0.08em] text-ink-muted uppercase",
        className,
      )}
    >
      {children}
    </h2>
  );
}
