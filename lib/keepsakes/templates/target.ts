import type { CSSProperties } from "react";

/**
 * The two places one template renders (architecture §7b): `export` is the server's Satori
 * composition for the downloaded/shared JPEG; `preview` is React DOM in the guest picker and host
 * Look. The design logic is shared; only these few serializations differ, because Satori and the
 * browser spell the same result differently:
 *
 * - Fonts: Satori matches the family names of the fonts it was handed; the browser gets the same
 *   bundled TTFs through `next/font/local` CSS variables (components/ff/keepsakes/fonts.ts).
 * - Line clamping: Satori clamps `display: block` + `lineClamp`; the browser clamps only
 *   `display: -webkit-box` + `-webkit-line-clamp` (Satori ignores the latter — measured in Slice
 *   16). Both end the last line with an ellipsis.
 * - Single-line ellipsis: the browser needs a block box for `text-overflow`, which Satori also
 *   honors.
 */
export type KeepsakeTarget = "export" | "preview";

export const FONT_VARIABLES = {
  heading: "--ff-keepsake-heading",
  body: "--ff-keepsake-body",
} as const;

export function headingFont(target: KeepsakeTarget): string {
  return target === "export" ? "Fraunces" : `var(${FONT_VARIABLES.heading}), Fraunces, Georgia, serif`;
}

export function bodyFont(target: KeepsakeTarget): string {
  return target === "export"
    ? "Plus Jakarta Sans"
    : `var(${FONT_VARIABLES.body}), "Plus Jakarta Sans", system-ui, sans-serif`;
}

/** At most `lines` lines, ending in an ellipsis if cut. */
export function clamp(target: KeepsakeTarget, lines: number): CSSProperties {
  return target === "export"
    ? ({ display: "block", lineClamp: lines, overflow: "hidden" } as CSSProperties)
    : {
        display: "-webkit-box",
        WebkitBoxOrient: "vertical",
        WebkitLineClamp: lines,
        overflow: "hidden",
      };
}

/** One line, ellipsized; shrinks inside a flex row. */
export function ellipsis(): CSSProperties {
  return {
    display: "block",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    minWidth: 0,
    flexShrink: 1,
  };
}
