import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

/** Round shot-number chip on a photo (DS05), shared by the phone mockups and printed photos. */
export function ShotNumber({ n, className }: { n: number; className?: string }) {
  return (
    <span
      className={cn(
        "tabular absolute top-1.5 left-1.5 z-10 flex size-5 items-center justify-center rounded-full bg-surface text-[10px] font-bold text-ink shadow-[0_1px_3px_rgb(0_0_0/0.18)]",
        className,
      )}
    >
      {n}
    </span>
  );
}

/**
 * A photo treated as a physical print (docs/design-direction.md → "Marketing motion"): white
 * border, layered paper shadow, a faint light falloff across the surface (`.ff-print` in
 * globals.css). Always decorative — the image has no alt text and callers hide the group from
 * assistive tech. The crop is set by `focus`, so any orientation is cropped, never stretched.
 */
export function PhotoPrint({
  src,
  shot,
  focus,
  className,
  chipClassName,
  style,
}: {
  src: string;
  shot?: number;
  focus?: string;
  className?: string;
  chipClassName?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      style={style}
      className={cn("ff-print relative block overflow-hidden bg-surface", className)}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- inline SVG illustration */}
      <img
        src={src}
        alt=""
        draggable={false}
        style={focus ? { objectPosition: focus } : undefined}
        className="size-full object-cover select-none"
      />
      {shot ? <ShotNumber n={shot} className={chipClassName} /> : null}
    </span>
  );
}
