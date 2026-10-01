import { SHOTS_PER_GUEST } from "@/components/ff/shots";

/**
 * Layout of the homepage hero's five printed photos (docs/design-direction.md → "Marketing
 * motion"): one guest's five kept frames, laid on a shallow surface. Pure data — the component
 * renders it, the motion layer reads `depth`. Only shapes and places: which photo fills a print,
 * and how it is cropped, come from lib/marketing/photos.ts, so photos can change freely. Coordinates are px inside a fixed stage so the
 * composition is identical on the server, before hydration and after.
 */

export const HERO_STAGE = { width: 520, height: 600 } as const;

export type HeroPrint = {
  /** Shot number shown on the print (1–5); it shows GUEST_FIVE[shot − 1] (lib/marketing/photos.ts). */
  shot: number;
  /** Top-left corner in stage px, before rotation. */
  x: number;
  y: number;
  width: number;
  /** width / height — prints are portrait, square and landscape, like real camera rolls. */
  aspect: number;
  /** Resting rotation in degrees. */
  rotate: number;
  /** Relative distance from the surface (0.5 back … 1.5 front): parallax gain and stacking. */
  depth: number;
};

export const HERO_PRINTS: readonly HeroPrint[] = [
  {
    shot: 1,
    x: 24,
    y: 64,
    width: 176,
    aspect: 4 / 5,
    rotate: -8,
    depth: 0.6,
  },
  {
    shot: 2,
    x: 300,
    y: 30,
    width: 168,
    aspect: 1,
    rotate: 6,
    depth: 0.9,
  },
  {
    shot: 3,
    x: 128,
    y: 200,
    width: 256,
    aspect: 5 / 4,
    rotate: -2,
    depth: 1.2,
  },
  {
    // Laid on top of shot 3's corner, the last print dropped onto the pile.
    shot: 4,
    x: 334,
    y: 322,
    width: 160,
    aspect: 4 / 5,
    rotate: 6,
    depth: 1.4,
  },
  {
    shot: 5,
    x: 40,
    y: 352,
    width: 150,
    aspect: 4 / 5,
    rotate: -5,
    depth: 0.8,
  },
];

// Exactly five, always — the composition is the product mechanic (product.md §12, invariant 12).
if (HERO_PRINTS.length !== SHOTS_PER_GUEST) {
  throw new Error("The hero composition must show exactly one guest's five frames.");
}

export function printHeight(print: HeroPrint): number {
  return print.width / print.aspect;
}

/**
 * Derived motion offsets for one print, in px/deg:
 * - `enter`: where it drops in from — pushed out from the stage center and a little more
 *   rotated, so the entrance reads as scattered prints settling onto a table;
 * - `gather`: how far it drifts toward the center as the hero scrolls away.
 */
export function printMotion(print: HeroPrint) {
  const cx = print.x + print.width / 2 - HERO_STAGE.width / 2;
  const cy = print.y + printHeight(print) / 2 - HERO_STAGE.height / 2;
  const length = Math.hypot(cx, cy) || 1;
  return {
    enter: {
      x: Math.round((cx / length) * 36),
      y: Math.round((cy / length) * 36),
      rotate: Math.sign(print.rotate || 1) * 5,
    },
    gather: { x: Math.round(-cx * 0.18), y: Math.round(-cy * 0.18) },
  };
}
