import type { CSSProperties, ReactNode } from "react";
import { Check } from "lucide-react";
import { HERO_PRINTS, HERO_STAGE, printMotion } from "@/lib/marketing/hero-prints";
import { GUEST_FIVE, photoSrc, photoSrcSet } from "@/lib/marketing/photos";
import { cn } from "@/lib/utils";
import { Eyebrow } from "./section";
import { PhotoPrint } from "./photo-print";

/**
 * The desktop (≥1024) brand rail beside a task: the auth split's left panel and the demo's story
 * panel (docs/design-direction.md → "Marketing rail"). It is the homepage hero adapted to a side
 * column — the same night + violet glow, light eyebrow, Fraunces headline and the five printed
 * frames — so a visitor moving from `/` to `/demo` or `/signup` stays on one page family.
 *
 * Server-safe (no hooks), so a server shell and a client page can both render it. Callers hide
 * it below 1024, where the task's own header carries identity instead of a tall brand block.
 */
export function MarketingRail({
  as: Root = "aside",
  brand,
  badge,
  eyebrow,
  title,
  titleAs: Title = "p",
  lead,
  photos,
  children,
  className,
}: {
  /** `header` when the rail carries the page's h1 (demo), `aside` beside a task that has its own. */
  as?: "aside" | "header";
  brand: ReactNode;
  badge?: ReactNode;
  eyebrow?: ReactNode;
  title: ReactNode;
  titleAs?: "h1" | "p";
  lead?: ReactNode;
  /** Fill the prints in order, e.g. the visitor's kept demo shots; the rest keep sample scenes. */
  photos?: string[];
  children?: ReactNode;
  className?: string;
}) {
  return (
    <Root
      className={cn(
        "ff-photo-header-desktop relative flex h-dvh flex-col overflow-x-hidden overflow-y-auto px-12 py-10 text-ink-inverse xl:px-16 xl:py-12",
        className,
      )}
    >
      <div className="relative flex h-11 shrink-0 items-center justify-between gap-4">
        {brand}
        {badge}
      </div>

      <PrintStack photos={photos} className="my-6 min-h-0 flex-1 [@media(max-height:700px)]:hidden" />

      <div className="relative mt-auto flex flex-col gap-5">
        {eyebrow && <Eyebrow tone="light">{eyebrow}</Eyebrow>}
        <Title className="font-heading text-display-desktop font-semibold text-balance">{title}</Title>
        {lead && (
          <p className="max-w-[480px] text-[17px] leading-relaxed font-medium text-ink-inverse/85">{lead}</p>
        )}
        {children && <div className="mt-1 flex flex-col gap-6">{children}</div>}
      </div>
    </Root>
  );
}

/** Short reassurance lines with violet-highlight checks (the hero pill's check, on dark). */
export function RailChecks({ items }: { items: string[] }) {
  return (
    <ul className="flex flex-wrap gap-x-6 gap-y-2.5 text-label font-semibold">
      {items.map((item) => (
        <li key={item} className="flex items-center gap-2">
          <Check className="size-4 text-brand-highlight" strokeWidth={2.5} aria-hidden />
          {item}
        </li>
      ))}
    </ul>
  );
}

/** A short numbered list; the numerals use the homepage's white-on-night icon chip. */
export function RailSteps({ steps }: { steps: ReactNode[] }) {
  return (
    <ol className="flex max-w-[480px] flex-col gap-3 text-label font-medium text-ink-inverse/85">
      {steps.map((step, i) => (
        <li key={i} className="flex items-start gap-3">
          <span className="tabular flex size-6 shrink-0 items-center justify-center rounded-full bg-surface text-micro font-bold text-brand">
            {i + 1}
          </span>
          <span className="pt-0.5">{step}</span>
        </li>
      ))}
    </ol>
  );
}

/**
 * The hero's five prints (lib/marketing/hero-prints.ts), static and scaled to whatever space the
 * rail leaves: the stage is as large as fits its box (container units), and every print is placed
 * in stage percentages, so the composition is identical at any size. It keeps the one-time
 * settle-in entrance but none of the hero's pointer parallax — a side panel stays still.
 * Decorative only: hidden from assistive tech, never focusable.
 */
function PrintStack({ photos = [], className }: { photos?: string[]; className?: string }) {
  const order = [...HERO_PRINTS].sort((a, b) => a.depth - b.depth).map((p) => p.shot);
  const { width: W, height: H } = HERO_STAGE;

  return (
    <div aria-hidden className={cn("pointer-events-none relative @container-[size]", className)}>
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
        style={{ width: `min(100cqw, ${((W / H) * 100).toFixed(2)}cqh)`, aspectRatio: `${W} / ${H}` }}
      >
        {HERO_PRINTS.map((print) => {
          const own = photos[print.shot - 1];
          const photo = GUEST_FIVE[print.shot - 1];
          const { enter } = printMotion(print);
          const place = {
            left: `${(print.x / W) * 100}%`,
            top: `${(print.y / H) * 100}%`,
            width: `${(print.width / W) * 100}%`,
            aspectRatio: print.aspect,
            zIndex: Math.round(print.depth * 10),
            transform: `rotate(${print.rotate}deg)`,
          } as CSSProperties;
          const drop = {
            "--i": order.indexOf(print.shot),
            "--ex": `${enter.x}px`,
            "--ey": `${enter.y}px`,
            "--er": `${enter.rotate}deg`,
          } as CSSProperties;
          return (
            <div key={print.shot} className="absolute" style={place}>
              <div className="ff-print-drop size-full" style={drop}>
                <PhotoPrint
                  src={own ?? photoSrc(photo)}
                  srcSet={own ? undefined : photoSrcSet(photo)}
                  sizes={own ? undefined : "200px"}
                  shot={print.shot}
                  focus={own ? undefined : photo.focus}
                  className="size-full rounded-[10px] border-[5px] border-surface"
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
