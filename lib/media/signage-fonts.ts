import "server-only";

import { readFileSync } from "node:fs";
import { join } from "node:path";
import opentype from "opentype.js";
import { escapeXml } from "./svg";

/**
 * Signage text, drawn as outlines from the bundled brand TTFs (the same files the keepsakes use,
 * `lib/media/fonts/`). Outlining is what makes signage identical everywhere: the host's preview
 * `<img>`, a browser print, a print shop's software and a TV all get the same letters, and
 * measuring the same outlines is what the long-name step-down and wrapping rules run on
 * (`signage-layout.ts`). The FiveFrames lockup is outlined for the same reason (lib/brand/logo.ts).
 *
 * A character the brand fonts don't cover (an emoji, CJK) is written as a `<text>` run in a
 * system font stack instead, escaped like every other interpolated string, so no name renders as
 * empty boxes.
 */

export type SignageFontId = "display600" | "body500" | "body600" | "body700" | "body800";

export type TextStyle = {
  font: SignageFontId;
  size: number;
  /** Extra space between characters, in canvas units (SVG/CSS `letter-spacing`). */
  letterSpacing?: number;
};

/** Width and ink extents; `top` is negative (above the baseline), `bottom` below it. */
export type TextMetrics = { width: number; top: number; bottom: number };

export type TextMeasurer = (text: string, style: TextStyle) => TextMetrics;

const FONT_DIR = join(process.cwd(), "lib/media/fonts");
const FILES: Record<SignageFontId, string> = {
  display600: "fraunces-600.ttf",
  body500: "plus-jakarta-sans-500.ttf",
  body600: "plus-jakarta-sans-600.ttf",
  body700: "plus-jakarta-sans-700.ttf",
  body800: "plus-jakarta-sans-800.ttf",
};

const FALLBACK_FAMILY: Record<SignageFontId, string> = {
  display600: "Georgia, 'Times New Roman', serif",
  body500: "'Segoe UI', Helvetica, Arial, sans-serif",
  body600: "'Segoe UI', Helvetica, Arial, sans-serif",
  body700: "'Segoe UI', Helvetica, Arial, sans-serif",
  body800: "'Segoe UI', Helvetica, Arial, sans-serif",
};

const WEIGHT: Record<SignageFontId, number> = {
  display600: 600,
  body500: 500,
  body600: 600,
  body700: 700,
  body800: 800,
};

let loaded: Record<SignageFontId, opentype.Font> | null = null;

function font(id: SignageFontId): opentype.Font {
  loaded ??= Object.fromEntries(
    (Object.keys(FILES) as SignageFontId[]).map((key) => {
      const bytes = readFileSync(join(FONT_DIR, FILES[key]));
      const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
      return [key, opentype.parse(buffer as ArrayBuffer)];
    }),
  ) as Record<SignageFontId, opentype.Font>;
  return loaded[id];
}

type Piece =
  | { kind: "glyph"; glyph: opentype.Glyph; x: number }
  | { kind: "fallback"; text: string; x: number; width: number };

const ZERO_WIDTH = /[‍︎️⃣]|[\u{1f3fb}-\u{1f3ff}]/u;

/** Characters the brand fonts don't have: a rough advance, so wrapping still behaves. */
function fallbackAdvance(char: string, size: number): number {
  if (ZERO_WIDTH.test(char)) return 0;
  return (char.codePointAt(0) ?? 0) >= 0x1100 ? size : size * 0.6;
}

function shape(text: string, style: TextStyle): { pieces: Piece[]; width: number } {
  const f = font(style.font);
  const scale = style.size / f.unitsPerEm;
  const spacing = style.letterSpacing ?? 0;
  const pieces: Piece[] = [];
  let x = 0;
  let previous: opentype.Glyph | null = null;

  for (const char of Array.from(text.normalize("NFC"))) {
    const glyph = f.charToGlyph(char);
    const missing = glyph.index === 0 && !/\s/.test(char);
    if (pieces.length) x += spacing;
    if (missing) {
      const advance = fallbackAdvance(char, style.size);
      const last = pieces[pieces.length - 1];
      if (last?.kind === "fallback") {
        last.text += char;
        last.width += advance;
        x -= spacing;
      } else {
        pieces.push({ kind: "fallback", text: char, x, width: advance });
      }
      x += advance;
      previous = null;
      continue;
    }
    if (previous) x += f.getKerningValue(previous, glyph) * scale;
    pieces.push({ kind: "glyph", glyph, x });
    x += (glyph.advanceWidth ?? 0) * scale;
    previous = glyph;
  }
  return { pieces, width: x };
}

/** Width plus the actual ink extents of the outlines (not the font's nominal line box). */
export const measureText: TextMeasurer = (text, style) => {
  const { pieces, width } = shape(text, style);
  let top = 0;
  let bottom = 0;
  for (const piece of pieces) {
    if (piece.kind === "fallback") {
      top = Math.min(top, -0.92 * style.size);
      bottom = Math.max(bottom, 0.26 * style.size);
      continue;
    }
    const path = piece.glyph.getPath(piece.x, 0, style.size);
    if (!path.commands.length) continue;
    const box = path.getBoundingBox();
    top = Math.min(top, box.y1);
    bottom = Math.max(bottom, box.y2);
  }
  return { width, top, bottom };
};

/**
 * SVG markup for one line of text starting at `x` on `baseline`: one path for the outlined
 * glyphs, plus an escaped `<text>` for any run the brand fonts can't draw.
 */
export function outlineText(
  text: string,
  style: TextStyle,
  x: number,
  baseline: number,
  fill: string,
  opacity?: number,
): string {
  const { pieces } = shape(text, style);
  const data: string[] = [];
  const fallbacks: string[] = [];
  const alpha = opacity === undefined ? "" : ` fill-opacity="${opacity}"`;
  for (const piece of pieces) {
    if (piece.kind === "glyph") {
      const d = piece.glyph.getPath(x + piece.x, baseline, style.size).toPathData(2);
      if (d) data.push(d);
    } else {
      fallbacks.push(
        `<text x="${round(x + piece.x)}" y="${round(baseline)}" font-family="${FALLBACK_FAMILY[style.font]}" font-weight="${WEIGHT[style.font]}" font-size="${round(style.size)}" fill="${fill}"${alpha}>${escapeXml(piece.text)}</text>`,
      );
    }
  }
  const path = data.length ? `<path d="${data.join("")}" fill="${fill}"${alpha}/>` : "";
  return path + fallbacks.join("");
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
