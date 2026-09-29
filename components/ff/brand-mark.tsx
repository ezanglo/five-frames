import { cn } from "@/lib/utils";
import {
  FAVICON_FRAMES,
  FAVICON_SIZE,
  LOCKUP,
  LOGO_TONES,
  SYMBOL_FRAMES,
  SYMBOL_RADIUS,
  SYMBOL_SIZE,
  WORDMARK_LETTERS_PATH,
  WORDMARK_TITTLE_PATH,
  type LogoTone,
  type SymbolFrame,
} from "@/lib/brand/logo";

function Frames({ frames, radius, tone }: { frames: readonly SymbolFrame[]; radius: number; tone: LogoTone }) {
  const colors = LOGO_TONES[tone];
  return frames.map((f, i) => (
    <rect
      key={i}
      x={f.x}
      y={f.y}
      width={f.width}
      height={f.height}
      rx={radius}
      fill={f.centre ? colors.centre : colors.body}
    />
  ));
}

type A11y = { label?: string };

function a11y(label?: string) {
  return label ? { role: "img" as const, "aria-label": label } : { "aria-hidden": true as const };
}

/**
 * The FiveFrames symbol (lib/brand/logo.ts). Size it with a `size-*` class. Decorative unless a
 * `label` is passed. `pixel` swaps to the hand-snapped 16px drawing — use it at 16–32px.
 */
export function BrandMark({
  tone = "onLight",
  pixel,
  label,
  className,
}: A11y & { tone?: LogoTone; pixel?: boolean; className?: string }) {
  const size = pixel ? FAVICON_SIZE : SYMBOL_SIZE;
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className={cn("shrink-0", className)} {...a11y(label)}>
      <Frames frames={pixel ? FAVICON_FRAMES : SYMBOL_FRAMES} radius={pixel ? 0.6 : SYMBOL_RADIUS} tone={tone} />
    </svg>
  );
}

/**
 * Symbol + wordmark, horizontal. Size it by height (`h-*`); the width follows the lockup's
 * aspect ratio. Carries the accessible name "FiveFrames" by default.
 */
export function BrandLockup({
  tone = "onLight",
  label = "FiveFrames",
  className,
}: A11y & { tone?: LogoTone; className?: string }) {
  const colors = LOGO_TONES[tone];
  const scale = LOCKUP.symbol / SYMBOL_SIZE;
  return (
    <svg
      viewBox={`0 0 ${LOCKUP.width} ${LOCKUP.height}`}
      style={{ aspectRatio: `${LOCKUP.width} / ${LOCKUP.height}` }}
      className={cn("block w-auto shrink-0", className)}
      {...a11y(label)}
    >
      <g transform={`scale(${scale})`}>
        <Frames frames={SYMBOL_FRAMES} radius={SYMBOL_RADIUS} tone={tone} />
      </g>
      <g transform={`translate(${LOCKUP.wordmarkX} ${LOCKUP.wordmarkY})`}>
        <path d={WORDMARK_LETTERS_PATH} fill={colors.body} />
        <path d={WORDMARK_TITTLE_PATH} fill={colors.centre} />
      </g>
    </svg>
  );
}
