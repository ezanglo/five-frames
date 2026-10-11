/**
 * The signage formats (product.md §11.3; docs/design-direction.md → "Signage"). One closed
 * list, shared by the server renderer (`lib/media/signage.ts`) and the host Look page, so the
 * canvas a preview is laid out on is the canvas the download is drawn on. Client-safe: no
 * rendering, no event data.
 */

import type { PlanFeatures } from "@/lib/plans/registry";

export type SignageFormat = "qr" | "table-card" | "poster" | "digital" | "table-number";

export type SignageFormatSpec = {
  id: SignageFormat;
  /** The format's name. */
  label: string;
  /** Format switcher label, when the name is too long for the chip. */
  chip?: string;
  /** The SVG canvas, in design units. */
  width: number;
  height: number;
  /** Print or display size, as the host reads it. */
  size: string;
  /** What the format is for. */
  use: string;
};

export const SIGNAGE_FORMAT_SPECS: readonly SignageFormatSpec[] = [
  {
    id: "qr",
    label: "QR",
    width: 600,
    height: 720,
    size: "5 × 6 in, or any size",
    use: "Where the code should do the talking: desks, doors and stickers.",
  },
  {
    id: "table-card",
    label: "Table card",
    width: 700,
    height: 500,
    size: "7 × 5 in landscape",
    use: "Close-range scanning at a table or desk.",
  },
  {
    id: "poster",
    label: "Poster",
    width: 1200,
    height: 1800,
    size: "24 × 36 in (2:3)",
    use: "Entrances and standing signs, readable from across a room.",
  },
  {
    id: "digital",
    label: "Digital",
    width: 1920,
    height: 1080,
    size: "16:9 screen",
    use: "TVs, projectors and tablets, or a group chat.",
  },
  {
    id: "table-number",
    label: "Table numbers",
    chip: "Numbers",
    width: 500,
    height: 700,
    size: "5 × 7 in portrait, one per table",
    use: "For a table-number stand or holder. The number reads from across the room.",
  },
];

export const SIGNAGE_FORMATS: readonly SignageFormat[] = SIGNAGE_FORMAT_SPECS.map((f) => f.id);

export function isSignageFormat(value: unknown): value is SignageFormat {
  return typeof value === "string" && (SIGNAGE_FORMATS as readonly string[]).includes(value);
}

export function signageFormatSpec(format: SignageFormat): SignageFormatSpec {
  return SIGNAGE_FORMAT_SPECS.find((f) => f.id === format)!;
}

/**
 * The formats a plan's event gets (product.md §15.3.1). Without print signage (Free) that is
 * the phone-screen format only: the link and on-screen QR need no signage file. Table-number
 * cards need their own feature (Standard and Premium, §11.3). The download and preview routes
 * refuse the rest; the host screens list only these.
 */
export function signageFormatsFor(features: PlanFeatures): readonly SignageFormatSpec[] {
  return SIGNAGE_FORMAT_SPECS.filter((f) => {
    if (f.id === "digital") return true;
    if (f.id === "table-number") return features.printSignage && features.tableNumberCards;
    return features.printSignage;
  });
}

export function isSignageFormatAllowed(format: SignageFormat, features: PlanFeatures): boolean {
  return signageFormatsFor(features).some((f) => f.id === format);
}

/**
 * Table-number cards (product.md §11.3, architecture §7c): the host's only input is how many
 * tables there are. The count is never stored; each card differs only in its number.
 */
export const TABLE_COUNT_MIN = 1;
export const TABLE_COUNT_MAX = 100;
/** The number the Look preview draws: a sample, so the preview never implies a count. */
export const TABLE_NUMBER_PREVIEW = 12;

export function isTableNumber(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= TABLE_COUNT_MIN && (value as number) <= TABLE_COUNT_MAX;
}

/** A `count` query value, strictly: digits only, 1–100. Anything else is null. */
export function parseTableCount(value: string | null): number | null {
  if (!value || !/^\d{1,3}$/.test(value)) return null;
  const count = Number(value);
  return isTableNumber(count) ? count : null;
}
