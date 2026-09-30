import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** The frame count is a product constant (product.md §12.12) — never configurable. */
export const SHOTS_PER_GUEST = 5;

/** Shot progress (DS03): 5 segments · 6h · filled = shots taken. */
export function ShotProgress({ taken, className }: { taken: number; className?: string }) {
  return (
    <div
      className={cn("grid grid-cols-5 gap-1.5", className)}
      role="img"
      aria-label={`${taken} of ${SHOTS_PER_GUEST} shots taken`}
    >
      {Array.from({ length: SHOTS_PER_GUEST }, (_, i) => (
        <span
          key={i}
          className={cn("h-1.5 rounded-full", i < taken ? "bg-brand" : "bg-line")}
        />
      ))}
    </div>
  );
}

/** Number badge on a filled shot (DS05 shot frame). */
export function ShotNumber({ n, className }: { n: number; className?: string }) {
  return (
    <span
      className={cn(
        "tabular flex size-7 items-center justify-center rounded-full bg-surface text-micro font-bold text-ink shadow-[0_1px_3px_rgb(0_0_0/0.18)]",
        className,
      )}
    >
      {n}
    </span>
  );
}

/**
 * Empty/next shot slot face (DS05): empty = surface/subtle + dashed border + placeholder
 * number; next = brand/tint + dashed brand border + brand number. Only the next slot is violet.
 */
export function EmptySlotFace({
  n,
  next,
  children,
  className,
}: {
  n: number;
  next?: boolean;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "flex h-full w-full flex-col items-center justify-center gap-1 rounded-lg",
        next
          ? "border-[1.5px] border-dashed border-brand bg-brand-tint text-brand-ink"
          : "ff-dashed bg-surface-subtle text-ink-placeholder",
        className,
      )}
    >
      <span className="tabular text-[22px] font-semibold">{n}</span>
      {children}
    </span>
  );
}

const TEASER_ROTATIONS = ["-6deg", "3deg", "-2deg", "6deg", "-3deg"] as const;

/** Five-shot teaser (DS05, Join): decorative, not interactive. */
export function FiveShotTeaser({
  className,
  size = "md",
}: {
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <div aria-hidden className={cn("flex items-center justify-between gap-2", className)}>
      {TEASER_ROTATIONS.map((rotation, i) => (
        <span
          key={i}
          style={{ transform: `rotate(${rotation})` }}
          className={cn(
            "ff-dashed flex flex-1 items-center justify-center rounded-md bg-surface-subtle font-semibold text-ink-placeholder motion-reduce:transform-none",
            size === "md" ? "aspect-[4/5] max-w-[68px] text-[17px]" : "aspect-[4/5] text-micro",
          )}
        >
          {i + 1}
        </span>
      ))}
    </div>
  );
}
