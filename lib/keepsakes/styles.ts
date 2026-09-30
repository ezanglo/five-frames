/**
 * The keepsake style registry's identity: two families, five styles each (product.md §10.2,
 * architecture §7b, decisions D19/D20; names and lines from docs/design-direction.md). Slice 15
 * needs only this much — the host Look studio lists both families and marks each family's
 * preselected style. Slice 16 adds each entry's Template (and a Full Set entry's slot
 * rectangles) to this same registry; nothing here renders a keepsake.
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
  { family: "single", id: "album", label: "Album", line: "A print laid on your event’s color", uses: { image: true, color: true, hashtag: false } },
] as const satisfies readonly KeepsakeStyleMeta[];

export const FULL_SET_STYLES = [
  { family: "fullSet", id: "signature", label: "Signature", line: "The FiveFrames shape, made of your five", uses: { image: true, color: true, hashtag: true } },
  { family: "fullSet", id: "strip", label: "Strip", line: "A photobooth strip on your event", uses: { image: true, color: true, hashtag: true } },
  { family: "fullSet", id: "grid", label: "Grid", line: "All five, side by side", uses: { image: false, color: true, hashtag: true } },
  { family: "fullSet", id: "spotlight", label: "Spotlight", line: "Your first photo leads, four follow", uses: { image: true, color: true, hashtag: true } },
  { family: "fullSet", id: "prints", label: "Prints", line: "Five prints on your event’s colour", uses: { image: true, color: true, hashtag: true } },
] as const satisfies readonly KeepsakeStyleMeta[];

export const PRESELECTED_SINGLE_STYLE = "print" satisfies (typeof SINGLE_STYLES)[number]["id"];
export const PRESELECTED_FULL_SET_STYLE = "signature" satisfies (typeof FULL_SET_STYLES)[number]["id"];

export function stylesForFamily(family: KeepsakeFamily): readonly KeepsakeStyleMeta[] {
  return family === "single" ? SINGLE_STYLES : FULL_SET_STYLES;
}
