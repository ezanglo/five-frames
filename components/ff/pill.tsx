import type { ComponentProps, ReactNode } from "react";
import { Check, Clock, EyeOff, Lock, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";

export type PillIcon = "live" | "revealed-dot" | "clock" | "check" | "lock" | "draft" | "none";

/**
 * Status pills (DS03). "light" = white pill on light surfaces and cards; "frosted" = on photos
 * and dark headers. The icon/dot carries the meaning — color is never the only signal.
 */
export function StatusPill({
  tone = "light",
  icon = "none",
  children,
  className,
  size = "md",
}: {
  tone?: "light" | "frosted" | "tint" | "success";
  icon?: PillIcon;
  children: ReactNode;
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1.5 rounded-full font-semibold whitespace-nowrap",
        size === "md" ? "h-8 px-3 text-micro" : "h-6 px-2.5 text-[11px]",
        tone === "light" && "border border-line bg-surface text-ink",
        tone === "frosted" && "ff-frosted text-ink-inverse",
        tone === "tint" && "bg-brand-tint text-brand",
        tone === "success" && "bg-success-tint text-success",
        className,
      )}
    >
      <PillGlyph icon={icon} tone={tone} />
      {children}
    </span>
  );
}

function PillGlyph({ icon, tone }: { icon: PillIcon; tone: string }) {
  switch (icon) {
    case "live":
      return <span aria-hidden className="size-2 rounded-full bg-live" />;
    case "revealed-dot":
      return <span aria-hidden className="size-2 rounded-full bg-brand-highlight" />;
    case "clock":
      return <Clock aria-hidden className="size-3.5" />;
    case "check":
      return (
        <Check
          aria-hidden
          className={cn("size-3.5", tone === "frosted" ? "text-live" : "")}
          strokeWidth={2.5}
        />
      );
    case "lock":
      return <Lock aria-hidden className="size-3.5" />;
    case "draft":
      return <Pencil aria-hidden className="size-3.5" />;
    default:
      return null;
  }
}

/** Filter chip (DS03): a pill; the active one fills violet. */
export function Chip({
  active,
  count,
  children,
  className,
  ...props
}: ComponentProps<"button"> & { active?: boolean; count?: number }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        "ff-focus inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full px-4 text-label font-semibold transition-colors",
        active
          ? "bg-brand text-ink-inverse"
          : "border border-line bg-surface text-ink hover:bg-surface-subtle",
        className,
      )}
      {...props}
    >
      {children}
      {count !== undefined && (
        <span className={cn("tabular text-micro", active ? "text-ink-inverse/80" : "text-brand")}>
          {count}
        </span>
      )}
    </button>
  );
}

/** HOST tag next to the wordmark (DS04 host bar). */
export function HostTag({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded-[6px] bg-brand px-1.5 text-[11px] font-bold tracking-[0.04em] text-ink-inverse",
        className,
      )}
    >
      HOST
    </span>
  );
}

/** "You" badge (DS03/DS05) — marks the viewer's own shots. */
export function YouBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded-full bg-brand px-2 text-[11px] font-bold text-ink-inverse",
        className,
      )}
    >
      You
    </span>
  );
}

export function HiddenBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1 rounded-full border border-line bg-surface px-2.5 text-[11px] font-bold tracking-[0.04em] text-ink",
        className,
      )}
    >
      <EyeOff aria-hidden className="size-3" />
      HIDDEN
    </span>
  );
}

/** LIVE pill beside live-updating section titles (DS03). */
export function LivePill() {
  return (
    <span className="inline-flex h-6 items-center gap-1.5 rounded-full bg-success-tint px-2.5 text-[11px] font-bold tracking-[0.04em] text-success">
      <span aria-hidden className="size-1.5 rounded-full bg-live" />
      LIVE
    </span>
  );
}
