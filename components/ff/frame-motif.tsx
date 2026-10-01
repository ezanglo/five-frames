import { cn } from "@/lib/utils";

/** Frame placement inside the motif box: top/left in %, width in cqmin (so frames scale with the
 * box's smaller side and always stay inside it — top + 1.25·w ≤ 100). */
const FRAMES = [
  { rotate: "-8deg", top: 8, left: 42, w: 30 },
  { rotate: "6deg", top: 18, left: 66, w: 24 },
  { rotate: "-3deg", top: 44, left: 52, w: 34 },
  { rotate: "9deg", top: 2, left: 14, w: 22 },
  { rotate: "-5deg", top: 36, left: 6, w: 26 },
] as const;

/**
 * Five tilted glass frames floating over a dark panel (DS05 photo-object language) — the desktop
 * stand-in for the handoff's cover photograph, which FiveFrames doesn't have, in the guest shell's
 * desktop story panel for an event with no theme image. (Marketing-facing panels — auth and the
 * demo — use the printed-photo `MarketingRail` instead.) Pass `photos` (the guest's own kept
 * shots) and the frames fill in order — still purely decorative, so the
 * images carry no alt text and the whole motif is hidden from assistive tech.
 *
 * The frames live in a box under the panel's top bar whose height is `extent` of the panel, so
 * they never run into the title block at the bottom, whatever the viewport height.
 */
export function FrameMotif({
  photos = [],
  extent = 0.55,
  className,
}: {
  photos?: string[];
  /** Fraction of the panel's height the frames may occupy (below the top bar). */
  extent?: number;
  className?: string;
}) {
  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      <div
        className="absolute inset-x-8 top-20 @container-[size]"
        style={{ height: `calc(${extent * 100}% - 5rem)` }}
      >
        {FRAMES.map((f, i) => {
          const src = photos[i];
          return (
            <span
              key={i}
              style={{
                transform: `rotate(${f.rotate})`,
                top: `${f.top}%`,
                left: `${f.left}%`,
                width: `${f.w}cqmin`,
              }}
              className={cn(
                "absolute aspect-[4/5] overflow-hidden rounded-xl motion-reduce:transform-none",
                src
                  ? "border-[3px] border-white shadow-[0_18px_40px_-12px_rgb(0_0_0/0.6)]"
                  : "border border-white/25 bg-white/[0.06] backdrop-blur-[2px]",
              )}
            >
              {src && (
                // eslint-disable-next-line @next/next/no-img-element -- short-lived signed url / local preview
                <img src={src} alt="" className="size-full object-cover" />
              )}
            </span>
          );
        })}
      </div>
      <span className="absolute inset-x-0 bottom-0 h-2/3 bg-linear-to-t from-surface-dark via-surface-dark/80 to-transparent" />
    </div>
  );
}
