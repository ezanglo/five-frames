/**
 * The FiveFrames logo (identity v1.0, 2026-09-30) — the single source of its geometry. Every
 * surface that shows the brand draws from here: the UI (`components/ff/brand-mark.tsx`), the
 * server-rendered images (keepsakes, Open Graph image) and the printed signage.
 *
 * The symbol: four frames — two landscape, two portrait — turn around a fifth, square frame and
 * together tile one square. No four corners ever meet. The centre frame carries the colour; the
 * wordmark repeats it as the square dot on the i.
 *
 * The wordmark is Plus Jakarta Sans ExtraBold converted to outlines (kerned, tracked -14/1000),
 * with the i's round dot replaced by a square tittle. It is outlined so it never depends on a
 * font being loaded — signage and generated images render it identically everywhere.
 *
 * This module is plain data + string builders (no React, no `server-only`) so both client
 * components and server renderers can import it.
 */

export const BRAND_COLORS = {
  ink: "#15141A", // color/text/primary
  violet: "#6B2BD9", // brand/primary
  highlight: "#B58CFF", // brand/highlight
  white: "#FFFFFF",
} as const;

/** How the logo is coloured on a given background. `body` = four frames + letters, `centre` = the fifth frame + the i's tittle. */
export const LOGO_TONES = {
  /** On white or light surfaces: ink with a violet centre. */
  onLight: { body: BRAND_COLORS.ink, centre: BRAND_COLORS.violet },
  /** On ink, night surfaces and photographs: white with a highlight-violet centre. */
  onDark: { body: BRAND_COLORS.white, centre: BRAND_COLORS.highlight },
  /** On the violet brand colour: solid white. */
  onViolet: { body: BRAND_COLORS.white, centre: BRAND_COLORS.white },
} as const;

export type LogoTone = keyof typeof LOGO_TONES;
export type LogoColors = { body: string; centre: string };

// ---------------------------------------------------------------- symbol

/** The symbol is drawn on a 120-unit square: a 3×3 grid of 40-unit cells, 8-unit gutters. */
export const SYMBOL_SIZE = 120;
export const SYMBOL_RADIUS = 7;

export type SymbolFrame = { x: number; y: number; width: number; height: number; centre: boolean };

/** Clockwise from the top: landscape, portrait, landscape, portrait, then the square centre. */
export const SYMBOL_FRAMES: readonly SymbolFrame[] = [
  { x: 0, y: 0, width: 76, height: 36, centre: false },
  { x: 84, y: 0, width: 36, height: 76, centre: false },
  { x: 44, y: 84, width: 76, height: 36, centre: false },
  { x: 0, y: 44, width: 36, height: 76, centre: false },
  { x: 44, y: 44, width: 32, height: 32, centre: true },
];

/**
 * The same symbol hand-snapped to a 16px pixel grid (4px frames, 1px gutters, 1px margin). Use
 * this — never a scaled-down `SYMBOL_FRAMES` — at 16px and 32px (2×), where sub-pixel edges blur.
 */
export const FAVICON_SIZE = 16;
export const FAVICON_FRAMES: readonly SymbolFrame[] = [
  { x: 1, y: 1, width: 9, height: 4, centre: false },
  { x: 11, y: 1, width: 4, height: 9, centre: false },
  { x: 6, y: 11, width: 9, height: 4, centre: false },
  { x: 1, y: 6, width: 4, height: 9, centre: false },
  { x: 6, y: 6, width: 4, height: 4, centre: true },
];

// ---------------------------------------------------------------- wordmark

/** Wordmark box in font units: cap height 745 (no descenders in "FiveFrames"). */
export const WORDMARK_WIDTH = 5474;
export const WORDMARK_HEIGHT = 745;
/** Outlined letters, origin at the top-left of the cap-height box. */
export const WORDMARK_LETTERS_PATH =
  "M66 745V0H576V135H221V324H526V459H221V745Z M628 745V199H778V745Z M1045 745 830 199H992L1141 612H1079L1228 199H1390L1175 745Z M1695 757Q1608 757 1544 718.5Q1480 680 1445 615Q1410 550 1410 471Q1410 389 1446.5 325Q1483 261 1545 224Q1607 187 1685 187Q1750 187 1800 207.5Q1850 228 1884.5 265Q1919 302 1937 350.5Q1955 399 1955 456Q1955 472 1953.5 487.5Q1952 503 1948 514H1539V404H1863L1792 456Q1802 413 1791 379.5Q1780 346 1752.5 326.5Q1725 307 1685 307Q1646 307 1618 326Q1590 345 1576 382Q1562 419 1565 472Q1561 518 1576 553Q1591 588 1622 607.5Q1653 627 1697 627Q1737 627 1765.5 611Q1794 595 1810 567L1930 624Q1914 664 1879.5 694Q1845 724 1798 740.5Q1751 757 1695 757Z M2040 745V0H2550V135H2195V324H2500V459H2195V745Z M2572 745V199H2712V330L2702 311Q2720 242 2761.5 217.5Q2803 193 2860 193H2892V323H2845Q2790 323 2756 356.5Q2722 390 2722 451V745Z M3113 757Q3054 757 3011 738Q2968 719 2945 683.5Q2922 648 2922 599Q2922 553 2943 517.5Q2964 482 3007.5 458Q3051 434 3116 424L3283 397V507L3143 532Q3111 538 3094 552.5Q3077 567 3077 594Q3077 619 3096 633Q3115 647 3143 647Q3180 647 3208 631Q3236 615 3251.5 587.5Q3267 560 3267 527V385Q3267 354 3242.5 333Q3218 312 3176 312Q3136 312 3105.5 334Q3075 356 3061 392L2941 335Q2957 289 2992 256Q3027 223 3076 205Q3125 187 3183 187Q3252 187 3305 212Q3358 237 3387.5 281.5Q3417 326 3417 385V745H3277V657L3311 651Q3287 687 3258 710.5Q3229 734 3193 745.5Q3157 757 3113 757Z M3513 745V199H3653V332L3638 310Q3650 247 3696 217Q3742 187 3806 187Q3874 187 3925.5 221.5Q3977 256 3990 314L3947 318Q3974 251 4024 219Q4074 187 4141 187Q4200 187 4245.5 213Q4291 239 4317 285.5Q4343 332 4343 394V745H4193V426Q4193 394 4181.5 371Q4170 348 4149 335Q4128 322 4098 322Q4069 322 4047.5 335Q4026 348 4014.5 371Q4003 394 4003 426V745H3853V426Q3853 394 3841.5 371Q3830 348 3809 335Q3788 322 3758 322Q3729 322 3707.5 335Q3686 348 3674.5 371Q3663 394 3663 426V745Z M4691 757Q4604 757 4540 718.5Q4476 680 4441 615Q4406 550 4406 471Q4406 389 4442.5 325Q4479 261 4541 224Q4603 187 4681 187Q4746 187 4796 207.5Q4846 228 4880.5 265Q4915 302 4933 350.5Q4951 399 4951 456Q4951 472 4949.5 487.5Q4948 503 4944 514H4535V404H4859L4788 456Q4798 413 4787 379.5Q4776 346 4748.5 326.5Q4721 307 4681 307Q4642 307 4614 326Q4586 345 4572 382Q4558 419 4561 472Q4557 518 4572 553Q4587 588 4618 607.5Q4649 627 4693 627Q4733 627 4761.5 611Q4790 595 4806 567L4926 624Q4910 664 4875.5 694Q4841 724 4794 740.5Q4747 757 4691 757Z M5239 757Q5149 757 5082.5 714.5Q5016 672 4992 600L5102 548Q5123 592 5159 617Q5195 642 5239 642Q5271 642 5288 629Q5305 616 5305 593Q5305 581 5299 572.5Q5293 564 5281 557Q5269 550 5251 545L5158 519Q5091 500 5055 457.5Q5019 415 5019 357Q5019 306 5045 268Q5071 230 5118 208.5Q5165 187 5226 187Q5306 187 5366.5 224.5Q5427 262 5452 330L5341 382Q5329 348 5297.5 327.5Q5266 307 5226 307Q5197 307 5180.5 319Q5164 331 5164 352Q5164 363 5170 372Q5176 381 5189.5 388Q5203 395 5223 401L5310 427Q5378 447 5414 487.5Q5450 528 5450 587Q5450 638 5423.5 676Q5397 714 5350 735.5Q5303 757 5239 757Z";
/** The i's square tittle — one stem wide, sitting on the cap line. */
export const WORDMARK_TITTLE_PATH = "M628 0h150v150h-150Z";

// ---------------------------------------------------------------- horizontal lockup

/** Symbol = 1.26 × cap height, centred on the cap band; gap = 0.4 × symbol. */
const LOCKUP_SYMBOL = WORDMARK_HEIGHT * 1.26;
const LOCKUP_GAP = LOCKUP_SYMBOL * 0.4;
export const LOCKUP = {
  width: LOCKUP_SYMBOL + LOCKUP_GAP + WORDMARK_WIDTH,
  height: LOCKUP_SYMBOL,
  symbol: LOCKUP_SYMBOL,
  wordmarkX: LOCKUP_SYMBOL + LOCKUP_GAP,
  wordmarkY: (LOCKUP_SYMBOL - WORDMARK_HEIGHT) / 2,
} as const;

/** Width of the lockup when drawn at `height`. */
export function lockupWidth(height: number): number {
  return (height * LOCKUP.width) / LOCKUP.height;
}

// ---------------------------------------------------------------- SVG string builders

function framesMarkup(frames: readonly SymbolFrame[], colors: LogoColors, radius: number): string {
  return frames
    .map(
      (f) =>
        `<rect x="${f.x}" y="${f.y}" width="${f.width}" height="${f.height}" rx="${radius}" fill="${f.centre ? colors.centre : colors.body}"/>`,
    )
    .join("");
}

/** The symbol's elements in its own 120-unit space. */
export function symbolMarkup(colors: LogoColors): string {
  return framesMarkup(SYMBOL_FRAMES, colors, SYMBOL_RADIUS);
}

/** The horizontal lockup's elements in its own coordinate space (`LOCKUP.width` × `LOCKUP.height`). */
export function lockupMarkup(colors: LogoColors): string {
  const s = LOCKUP.symbol / SYMBOL_SIZE;
  return (
    `<g transform="scale(${s})">${symbolMarkup(colors)}</g>` +
    `<g transform="translate(${LOCKUP.wordmarkX} ${LOCKUP.wordmarkY})">` +
    `<path d="${WORDMARK_LETTERS_PATH}" fill="${colors.body}"/>` +
    `<path d="${WORDMARK_TITTLE_PATH}" fill="${colors.centre}"/></g>`
  );
}

/** A standalone horizontal-lockup SVG document. */
export function lockupSvg(colors: LogoColors): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${LOCKUP.width} ${LOCKUP.height}">${lockupMarkup(colors)}</svg>`;
}

/** A standalone symbol SVG document. */
export function symbolSvg(colors: LogoColors): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SYMBOL_SIZE} ${SYMBOL_SIZE}">${symbolMarkup(colors)}</svg>`;
}

/** An SVG document as a data URI, e.g. for `<img>` inside `next/og`'s `ImageResponse`. */
export function svgDataUri(svg: string): string {
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}
