/**
 * The keepsake style registry's identity: two families, five styles each (product.md §10.2,
 * architecture §7b, decisions D19/D20; names and lines from docs/design-direction.md). Client-safe
 * data only: the host Look studio and the guest picker list a family from here, and the routes
 * validate a style id against its family here. Geometry lives in `slots.ts` / `layout.ts`, and
 * the JSX templates in `templates/`.
 *
 * Ids are stable and unique across both families, so an id identifies its family. Product-facing
 * code never lists the ten together.
 */

export type KeepsakeFamily = "single" | "fullSet";

export type KeepsakeStyleMeta = {
  family: KeepsakeFamily;
  id: string;
  label: string;
  /** One line a guest (or host) understands in a list of five. */
  line: string;
  /** Which theme parts the style draws on (host Look shows these for the Full Set family). */
  uses: { image: boolean; color: true; hashtag: boolean };
};

export const SINGLE_STYLES = [
  { family: "single", id: "print", label: "Print", line: "A clean white-bordered print", uses: { image: false, color: true, hashtag: true } },
  { family: "single", id: "booth", label: "Booth", line: "Bold event color and a date stamp", uses: { image: false, color: true, hashtag: true } },
  { family: "single", id: "poster", label: "Poster", line: "Your event up top, photo below", uses: { image: true, color: true, hashtag: true } },
  { family: "single", id: "journal", label: "Journal", line: "Editorial, with room for your message", uses: { image: true, color: true, hashtag: true } },
  { family: "single", id: "album", label: "Album", line: "A print laid on your event’s color", uses: { image: true, color: true, hashtag: true } },
] as const satisfies readonly KeepsakeStyleMeta[];

export const FULL_SET_STYLES = [
  { family: "fullSet", id: "signature", label: "Signature", line: "The FiveFrames shape, made of your five", uses: { image: true, color: true, hashtag: true } },
  { family: "fullSet", id: "strip", label: "Strip", line: "A photobooth strip on your event", uses: { image: true, color: true, hashtag: true } },
  { family: "fullSet", id: "grid", label: "Grid", line: "All five, side by side", uses: { image: false, color: true, hashtag: true } },
  { family: "fullSet", id: "spotlight", label: "Spotlight", line: "Your first photo leads, four follow", uses: { image: true, color: true, hashtag: true } },
  { family: "fullSet", id: "prints", label: "Prints", line: "Five prints on your event’s colour", uses: { image: true, color: true, hashtag: true } },
] as const satisfies readonly KeepsakeStyleMeta[];

export type SingleStyleId = (typeof SINGLE_STYLES)[number]["id"];
export type FullSetStyleId = (typeof FULL_SET_STYLES)[number]["id"];
export type KeepsakeStyleId = SingleStyleId | FullSetStyleId;

export const PRESELECTED_SINGLE_STYLE = "print" satisfies SingleStyleId;
export const PRESELECTED_FULL_SET_STYLE = "signature" satisfies FullSetStyleId;

export function stylesForFamily(family: KeepsakeFamily): readonly KeepsakeStyleMeta[] {
  return family === "single" ? SINGLE_STYLES : FULL_SET_STYLES;
}

export function preselectedStyle(family: KeepsakeFamily): KeepsakeStyleId {
  return family === "single" ? PRESELECTED_SINGLE_STYLE : PRESELECTED_FULL_SET_STYLE;
}

/** True only for an id in the Single-photo family; a Full Set id (or anything else) is refused. */
export function isSingleStyleId(value: unknown): value is SingleStyleId {
  return typeof value === "string" && SINGLE_STYLES.some((s) => s.id === value);
}

/** True only for an id in the Full Set family; a Single-photo id (or anything else) is refused. */
export function isFullSetStyleId(value: unknown): value is FullSetStyleId {
  return typeof value === "string" && FULL_SET_STYLES.some((s) => s.id === value);
}

export function styleMeta(id: KeepsakeStyleId): KeepsakeStyleMeta {
  return [...SINGLE_STYLES, ...FULL_SET_STYLES].find((s) => s.id === id)!;
}
