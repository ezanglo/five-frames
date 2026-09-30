import type { CSSProperties } from "react";
import {
  LOCKUP,
  LOGO_TONES,
  SYMBOL_FRAMES,
  SYMBOL_RADIUS,
  SYMBOL_SIZE,
  WORDMARK_HEIGHT,
  WORDMARK_LETTERS_PATH,
  WORDMARK_TITTLE_PATH,
  WORDMARK_WIDTH,
  lockupWidth,
  type LogoColors,
} from "@/lib/brand/logo";

/**
 * The FiveFrames brandmark on a keepsake, drawn as inline SVG from lib/brand/logo.ts. Inline SVG
 * renders identically in Satori (serialized for resvg) and in the DOM, and needs no data-URI
 * encoding, so the same element works on both targets. Tones follow the identity: `onLight` on
 * white/tint, one colour on accent or night fields. The event accent never recolours it.
 */

export const ON_LIGHT: LogoColors = LOGO_TONES.onLight;

export function oneColour(color: string): LogoColors {
  return { body: color, centre: color };
}

export function Lockup({
  height,
  colors,
  style,
}: {
  height: number;
  colors: LogoColors;
  style?: CSSProperties;
}) {
  const width = Math.round(lockupWidth(height) * 10) / 10;
  const s = LOCKUP.symbol / SYMBOL_SIZE;
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${LOCKUP.width} ${LOCKUP.height}`}
      style={{ display: "flex", flexShrink: 0, ...style }}
      aria-label="FiveFrames"
      role="img"
    >
      <g transform={`scale(${s})`}>
        {SYMBOL_FRAMES.map((f, i) => (
          <rect
            key={i}
            x={f.x}
            y={f.y}
            width={f.width}
            height={f.height}
            rx={SYMBOL_RADIUS}
            fill={f.centre ? colors.centre : colors.body}
          />
        ))}
      </g>
      <g transform={`translate(${LOCKUP.wordmarkX} ${LOCKUP.wordmarkY})`}>
        <path d={WORDMARK_LETTERS_PATH} fill={colors.body} />
        <path d={WORDMARK_TITTLE_PATH} fill={colors.centre} />
      </g>
    </svg>
  );
}

/** The wordmark alone: the Signature Full Set's photos already draw the symbol. */
export function Wordmark({ height, style }: { height: number; style?: CSSProperties }) {
  const width = Math.round(((height * WORDMARK_WIDTH) / WORDMARK_HEIGHT) * 10) / 10;
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${WORDMARK_WIDTH} ${WORDMARK_HEIGHT}`}
      style={{ display: "flex", flexShrink: 0, ...style }}
      aria-label="FiveFrames"
      role="img"
    >
      <path d={WORDMARK_LETTERS_PATH} fill={ON_LIGHT.body} />
      <path d={WORDMARK_TITTLE_PATH} fill={ON_LIGHT.centre} />
    </svg>
  );
}
