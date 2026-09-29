import type { CSSProperties } from "react";
import { HERO_PRINTS, HERO_STAGE, printHeight, printMotion } from "@/lib/marketing/hero-prints";
import { scene } from "@/lib/marketing/sample-scenes";
import { cn } from "@/lib/utils";
import { ParallaxStage } from "./parallax-stage";
import { PhotoPrint } from "./photo-print";

/**
 * The homepage hero's signature visual (docs/design-direction.md → "Marketing motion"): one
 * guest's five kept frames as printed photos on a shallow surface. Three layers per print —
 *
 * 1. `.ff-hero-print` — resting placement plus the parallax/scroll transform, computed in CSS
 *    from the stage's `--px`/`--py`/`--sp` (written by `ParallaxStage`, the only client part);
 * 2. `.ff-print-drop` — the one-time entrance (CSS keyframes; plays without JavaScript);
 * 3. `.ff-print-lift` — the hover lift on a real mouse.
 *
 * A server component: the prints and their images ship as HTML only, not as client JS. The
 * server renders the finished composition, so it's complete before hydration and nothing
 * shifts when the motion layer starts. Purely decorative: hidden from assistive tech, never
 * focusable, and it sits in its own column so it can't overlap the CTAs.
 */
export function FiveFramesHeroVisual({ className }: { className?: string }) {
  // Back prints drop first, the front print last — like laying photos down on a table.
  const order = [...HERO_PRINTS].sort((a, b) => a.depth - b.depth).map((p) => p.shot);

  return (
    <div
      aria-hidden
      className={cn("ff-hero-perspective relative", className)}
      style={{ width: HERO_STAGE.width, height: HERO_STAGE.height }}
    >
      <ParallaxStage className="ff-hero-stage absolute inset-0">
        {HERO_PRINTS.map((print) => {
          const { enter, gather } = printMotion(print);
          const style = {
            left: print.x,
            top: print.y,
            width: print.width,
            height: printHeight(print),
            zIndex: Math.round(print.depth * 10),
            "--rot": `${print.rotate}deg`,
            "--depth": print.depth,
            "--gx": `${gather.x}px`,
            "--gy": `${gather.y}px`,
          } as CSSProperties;
          const dropStyle = {
            "--i": order.indexOf(print.shot),
            "--ex": `${enter.x}px`,
            "--ey": `${enter.y}px`,
            "--er": `${enter.rotate}deg`,
          } as CSSProperties;
          return (
            <div key={print.shot} className="ff-hero-print absolute" style={style}>
              <div className="ff-print-drop size-full" style={dropStyle}>
                <PhotoPrint
                  src={scene(print.scene).src}
                  shot={print.shot}
                  focus={print.focus}
                  className="ff-print-lift size-full rounded-[14px] border-[6px] border-surface"
                  chipClassName="top-2 left-2 size-6 text-[11px]"
                />
              </div>
            </div>
          );
        })}
      </ParallaxStage>
    </div>
  );
}
