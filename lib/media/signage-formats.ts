/**
 * The four signage formats (product.md §11.3; docs/design-direction.md → "Signage"). One closed
 * list, shared by the server renderer (`lib/media/signage.ts`) and the host Look page, so the
 * canvas a preview is laid out on is the canvas the download is drawn on. Client-safe: no
 * rendering, no event data.
 */

export type SignageFormat = "qr" | "table-card" | "poster" | "digital";

export type SignageFormatSpec = {
  id: SignageFormat;
  /** Format switcher label. */
  label: string;
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
];

export const SIGNAGE_FORMATS: readonly SignageFormat[] = SIGNAGE_FORMAT_SPECS.map((f) => f.id);

export function isSignageFormat(value: unknown): value is SignageFormat {
  return typeof value === "string" && (SIGNAGE_FORMATS as readonly string[]).includes(value);
}

export function signageFormatSpec(format: SignageFormat): SignageFormatSpec {
  return SIGNAGE_FORMAT_SPECS.find((f) => f.id === format)!;
}
