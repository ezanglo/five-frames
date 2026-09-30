import type { AccentRoles } from "@/lib/theme/accents";
import { lockupWidth } from "@/lib/brand/logo";
import type { SignageFormat } from "./signage-formats";
import type { TextMeasurer, TextStyle } from "./signage-fonts";

/**
 * Signage geometry (docs/design-direction.md → "Signage"; board section 09). Pure: it turns the
 * event's presentation data into positioned rectangles and text lines, and the writer in
 * `signage.ts` only draws what this returns. That split is what lets the unit tests check
 * scannability as geometry — the plate, its quiet zone, and that nothing else touches it —
 * instead of comparing pixels.
 *
 * Every format is one system: an identity field (theme image or night + accent glow) carrying
 * the lockup, name, date and hashtag; a white scan side with the QR plate and the fixed copy; and
 * a thin accent band. The QR format is the all-white exception, with no field and no image.
 *
 * The QR plate is never themed: it is white, it always rests on white, its padding is at least
 * four modules at every size, and nothing — image, tint, bracket, text — is drawn inside it.
 */

export type Rect = { x: number; y: number; width: number; height: number };

export const INK = "#15141A";
export const INK_MUTED = "#6B6A75";
export const NIGHT = "#141414";
export const WHITE = "#FFFFFF";

export const GUEST_INSTRUCTION = "Scan. You have five frames.";
export const NO_APP_REASSURANCE = "No app. No account.";
export const PREVIEW_LABEL = "PREVIEW";
export const PREVIEW_NOTE = "Not a working code";

/** A QR's quiet zone, in modules (ISO/IEC 18004). */
export const QUIET_ZONE_MODULES = 4;
/**
 * The plate is sized for a 29-module symbol (version 3), the smallest a capture URL can produce
 * (a 22-character token plus `/e/` and an origin is already 34+ bytes). Larger symbols keep the
 * format's QR size and get a wider quiet zone; a smaller one would shrink to keep four modules.
 */
const REFERENCE_MODULES = 29;

export type SignageCode = { kind: "live"; modules: number } | { kind: "preview" };

export type SignageContent = {
  name: string;
  /** "Sat, 18 Oct 2026", or null when the event has no date. */
  dateLabel: string | null;
  /** Without "#". */
  hashtag: string | null;
  accent: AccentRoles;
  /** Whether a theme image is available; only the field formats draw it. */
  hasImage: boolean;
  code: SignageCode;
};

export type TextRole =
  | "name"
  | "date"
  | "hashtag"
  | "instruction"
  | "reassurance"
  | "previewLabel"
  | "previewNote";

export type PlacedText = {
  role: TextRole;
  text: string;
  style: TextStyle;
  /** Left edge of the line (anchoring is resolved here, not in SVG). */
  x: number;
  baseline: number;
  fill: string;
  opacity?: number;
  /** Ink bounds. */
  box: Rect;
};

export type BracketSegment = Rect;

export type SignageLayout = {
  format: SignageFormat;
  width: number;
  height: number;
  /** The identity field, or null (QR format). */
  field: (Rect & { scrim: readonly [number, number, number] }) | null;
  /** Where the theme image is drawn: the whole field, or nowhere. */
  image: Rect | null;
  /** Night + two accent glows when there is a field but no image. */
  glow: { color: string } | null;
  lockup: Rect & { tone: "onLight" | "onDark" };
  /** The white QR plate; its padding is the quiet zone. */
  plate: Rect & { rx: number };
  code:
    | { kind: "live"; rect: Rect; modules: number; moduleSize: number }
    | { kind: "preview"; rect: Rect };
  /** Four L-shaped marks outside the plate, as their stroke rectangles (for intersection tests). */
  brackets: {
    color: string;
    stroke: number;
    arm: number;
    corners: { x: number; y: number; dx: 1 | -1; dy: 1 | -1 }[];
    segments: BracketSegment[];
  };
  band: Rect & { fill: string };
  texts: PlacedText[];
  /** Where content (everything but the field, image and band) must stay: trim/overscan safety. */
  safe: Rect;
};

export type LayoutTools = { measure: TextMeasurer };

// ------------------------------------------------------------------------------------ helpers

export function intersects(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

export function contains(outer: Rect, inner: Rect): boolean {
  return (
    inner.x >= outer.x - 1e-6 &&
    inner.y >= outer.y - 1e-6 &&
    inner.x + inner.width <= outer.x + outer.width + 1e-6 &&
    inner.y + inner.height <= outer.y + outer.height + 1e-6
  );
}

function inset(width: number, height: number, x: number, y = x): Rect {
  return { x, y, width: width - 2 * x, height: height - 2 * y };
}

function plateSlot(qrSize: number): number {
  return (qrSize * (REFERENCE_MODULES + 2 * QUIET_ZONE_MODULES)) / REFERENCE_MODULES;
}

/** The plate, and the code centred in it with at least four modules of white on every side. */
function placePlate(
  x: number,
  y: number,
  qrSize: number,
  code: SignageCode,
): Pick<SignageLayout, "plate" | "code"> {
  const size = plateSlot(qrSize);
  const plate = { x, y, width: size, height: size, rx: size * 0.0432 };
  const centred = (s: number): Rect => ({ x: x + (size - s) / 2, y: y + (size - s) / 2, width: s, height: s });
  if (code.kind === "preview") return { plate, code: { kind: "preview", rect: centred(qrSize) } };
  const n = code.modules;
  const area = Math.min(qrSize, (size * n) / (n + 2 * QUIET_ZONE_MODULES));
  return { plate, code: { kind: "live", rect: centred(area), modules: n, moduleSize: area / n } };
}

function placeBrackets(plate: Rect, offset: number, arm: number, stroke: number, color: string): SignageLayout["brackets"] {
  const left = plate.x - offset;
  const top = plate.y - offset;
  const right = plate.x + plate.width + offset;
  const bottom = plate.y + plate.height + offset;
  const corners: SignageLayout["brackets"]["corners"] = [
    { x: left, y: top, dx: 1, dy: 1 },
    { x: right, y: top, dx: -1, dy: 1 },
    { x: left, y: bottom, dx: 1, dy: -1 },
    { x: right, y: bottom, dx: -1, dy: -1 },
  ];
  const h = stroke / 2;
  const segments = corners.flatMap(({ x, y, dx, dy }) => [
    // horizontal arm, round caps included
    { x: Math.min(x, x + dx * arm) - h, y: y - h, width: arm + stroke, height: stroke },
    // vertical arm
    { x: x - h, y: Math.min(y, y + dy * arm) - h, width: stroke, height: arm + stroke },
  ]);
  return { color, stroke, arm, corners, segments };
}

function place(
  tools: LayoutTools,
  role: TextRole,
  text: string,
  style: TextStyle,
  anchorX: number,
  anchor: "start" | "middle" | "end",
  baseline: number,
  fill: string,
  opacity?: number,
): PlacedText {
  const m = tools.measure(text, style);
  const x = anchor === "start" ? anchorX : anchor === "middle" ? anchorX - m.width / 2 : anchorX - m.width;
  return {
    role,
    text,
    style,
    x,
    baseline,
    fill,
    ...(opacity === undefined ? {} : { opacity }),
    box: { x, y: baseline + m.top, width: m.width, height: m.bottom - m.top },
  };
}

function words(text: string): string[] {
  return text.normalize("NFC").trim().split(/\s+/).filter(Boolean);
}

/** Greedy word wrap; a word wider than the line is broken between characters. */
export function wrapText(text: string, style: TextStyle, maxWidth: number, tools: LayoutTools): string[] {
  const width = (s: string) => tools.measure(s, style).width;
  const lines: string[] = [];
  let line = "";
  for (const word of words(text)) {
    const candidate = line ? `${line} ${word}` : word;
    if (width(candidate) <= maxWidth) {
      line = candidate;
      continue;
    }
    if (line) lines.push(line);
    line = "";
    if (width(word) <= maxWidth) {
      line = word;
      continue;
    }
    let chunk = "";
    for (const char of Array.from(word)) {
      if (chunk && width(chunk + char) > maxWidth) {
        lines.push(chunk);
        chunk = "";
      }
      chunk += char;
    }
    line = chunk;
  }
  if (line) lines.push(line);
  return lines;
}

/** The text, or as much of it as fits followed by "…" (the last-resort fallback only). */
export function ellipsize(text: string, style: TextStyle, maxWidth: number, tools: LayoutTools): string {
  if (tools.measure(text, style).width <= maxWidth) return text;
  const chars = Array.from(text);
  while (chars.length && tools.measure(`${chars.join("").trimEnd()}…`, style).width > maxWidth) chars.pop();
  return `${chars.join("").trimEnd()}…`;
}

type NameRule = {
  font: TextStyle["font"];
  steps: readonly number[];
  maxLines: number;
  lineHeight: number;
  letterSpacing?: number;
  maxWidth: number;
};

/**
 * The long-name rule: the largest step at which the name wraps into `maxLines` and its block
 * fits the region; otherwise the smallest step with an ellipsis on the last line.
 */
function fitName(
  name: string,
  rule: NameRule,
  tools: LayoutTools,
  fits: (lines: string[], style: TextStyle) => boolean,
): { lines: string[]; style: TextStyle } {
  for (const size of rule.steps) {
    const style: TextStyle = { font: rule.font, size, letterSpacing: rule.letterSpacing };
    const lines = wrapText(name, style, rule.maxWidth, tools);
    if (lines.length <= rule.maxLines && fits(lines, style)) return { lines, style };
  }
  const size = rule.steps[rule.steps.length - 1];
  const style: TextStyle = { font: rule.font, size, letterSpacing: rule.letterSpacing };
  const lines = wrapText(name, style, rule.maxWidth, tools);
  if (lines.length <= rule.maxLines) return { lines, style };
  const kept = lines.slice(0, rule.maxLines - 1);
  const rest = lines.slice(rule.maxLines - 1).join(" ");
  return { lines: [...kept, ellipsize(rest, style, rule.maxWidth, tools)], style };
}

/** A single line (a hashtag) at the largest step that fits, ellipsized only at the smallest. */
function fitLine(
  text: string,
  font: TextStyle["font"],
  steps: readonly number[],
  maxWidth: number,
  tools: LayoutTools,
): { text: string; style: TextStyle } {
  for (const size of steps) {
    const style: TextStyle = { font, size };
    if (tools.measure(text, style).width <= maxWidth) return { text, style };
  }
  const style: TextStyle = { font, size: steps[steps.length - 1] };
  return { text: ellipsize(text, style, maxWidth, tools), style };
}

function blockInk(lines: string[], style: TextStyle, lastBaseline: number, lineHeight: number, tools: LayoutTools) {
  const lh = style.size * lineHeight;
  const first = lastBaseline - (lines.length - 1) * lh;
  return {
    top: first + tools.measure(lines[0], style).top,
    bottom: lastBaseline + tools.measure(lines[lines.length - 1], style).bottom,
  };
}

function placePreviewLabels(tools: LayoutTools, rect: Rect): PlacedText[] {
  const s = rect.width;
  const cx = rect.x + s / 2;
  const cy = rect.y + s / 2;
  return [
    place(tools, "previewLabel", PREVIEW_LABEL, { font: "body800", size: s * 0.085, letterSpacing: s * 0.008 }, cx, "middle", cy - s * 0.012, INK),
    place(tools, "previewNote", PREVIEW_NOTE, { font: "body600", size: s * 0.05 }, cx, "middle", cy + s * 0.078, INK_MUTED),
  ];
}

function scanCopy(
  tools: LayoutTools,
  cx: number,
  baseline: number,
  instruction: TextStyle,
  reassurance: TextStyle,
  gap: number,
): PlacedText[] {
  return [
    place(tools, "instruction", GUEST_INSTRUCTION, instruction, cx, "middle", baseline, INK),
    place(tools, "reassurance", NO_APP_REASSURANCE, reassurance, cx, "middle", baseline + gap, INK_MUTED),
  ];
}

type FieldMetaRule = {
  x: number;
  maxWidth: number;
  /** Date size; the hashtag uses `hashtagSteps`. */
  size: number;
  /** Space between the date and a hashtag beside it; null = the hashtag always has its own line. */
  inlineGap: number | null;
  hashtagSteps: readonly number[];
  /** Baseline of the meta when it is one line. */
  singleBaseline: number;
  /** Baselines of date and hashtag when the hashtag drops to its own line. */
  stacked: readonly [number, number];
  /** Distance from the first meta baseline up to the name's last baseline. */
  nameGap: number;
};

/**
 * Date and hashtag under the name, bottom-anchored in the field. A hashtag that doesn't fit
 * beside the date drops to its own line; an absent one takes no space.
 */
function fieldMeta(
  tools: LayoutTools,
  content: SignageContent,
  rule: FieldMetaRule,
): { texts: PlacedText[]; nameBaseline: number } {
  const dateStyle: TextStyle = { font: "body600", size: rule.size };
  const hashtag = content.hashtag ? `#${content.hashtag}` : null;
  const date = content.dateLabel;
  const onDark = content.accent.onDark;

  if (!date && !hashtag) return { texts: [], nameBaseline: rule.singleBaseline };

  if (date && hashtag && rule.inlineGap !== null) {
    const dateWidth = tools.measure(date, dateStyle).width;
    const hashStyle: TextStyle = { font: "body700", size: rule.hashtagSteps[0] };
    if (dateWidth + rule.inlineGap + tools.measure(hashtag, hashStyle).width <= rule.maxWidth) {
      return {
        texts: [
          place(tools, "date", date, dateStyle, rule.x, "start", rule.singleBaseline, WHITE, 0.82),
          place(tools, "hashtag", hashtag, hashStyle, rule.x + dateWidth + rule.inlineGap, "start", rule.singleBaseline, onDark),
        ],
        nameBaseline: rule.singleBaseline - rule.nameGap,
      };
    }
  }

  if (date && hashtag) {
    const [dateBaseline, hashBaseline] = rule.stacked;
    const fitted = fitLine(hashtag, "body700", rule.hashtagSteps, rule.maxWidth, tools);
    return {
      texts: [
        place(tools, "date", date, dateStyle, rule.x, "start", dateBaseline, WHITE, 0.82),
        place(tools, "hashtag", fitted.text, fitted.style, rule.x, "start", hashBaseline, onDark),
      ],
      nameBaseline: dateBaseline - rule.nameGap,
    };
  }

  const only = date
    ? place(tools, "date", date, dateStyle, rule.x, "start", rule.singleBaseline, WHITE, 0.82)
    : (() => {
        const fitted = fitLine(hashtag!, "body700", rule.hashtagSteps, rule.maxWidth, tools);
        return place(tools, "hashtag", fitted.text, fitted.style, rule.x, "start", rule.singleBaseline, onDark);
      })();
  return { texts: [only], nameBaseline: rule.singleBaseline - rule.nameGap };
}

/** Name lines bottom-anchored on `lastBaseline`, as large as the rule and the region allow. */
function fieldName(
  tools: LayoutTools,
  name: string,
  rule: NameRule & { x: number },
  lastBaseline: number,
  regionTop: number,
): PlacedText[] {
  const { lines, style } = fitName(name, rule, tools, (l, s) =>
    blockInk(l, s, lastBaseline, rule.lineHeight, tools).top >= regionTop,
  );
  const lh = style.size * rule.lineHeight;
  return lines.map((line, i) =>
    place(tools, "name", line, style, rule.x, "start", lastBaseline - (lines.length - 1 - i) * lh, WHITE),
  );
}

function field(width: number, height: number, content: SignageContent, scrim: readonly [number, number, number]) {
  const rect = { x: 0, y: 0, width, height };
  return {
    field: { ...rect, scrim },
    image: content.hasImage ? rect : null,
    glow: content.hasImage ? null : { color: content.accent.base },
  };
}

// ------------------------------------------------------------------------------------ formats

function qrFormat(content: SignageContent, tools: LayoutTools): SignageLayout {
  const width = 600;
  const height = 720;
  const lockup = { x: 48, y: 44, width: lockupWidth(22), height: 22, tone: "onLight" as const };
  const { plate, code } = placePlate((width - plateSlot(336)) / 2, 176, 336, content.code);
  const brackets = placeBrackets(plate, 12, 30, 5, content.accent.base);
  const texts: PlacedText[] = [];

  if (content.hashtag) {
    const maxWidth = width - 48 - (lockup.x + lockup.width + 16);
    const fitted = fitLine(`#${content.hashtag}`, "body700", [17, 15, 13], maxWidth, tools);
    texts.push(place(tools, "hashtag", fitted.text, fitted.style, width - 48, "end", 61, content.accent.ink));
  }

  const regionTop = lockup.y + lockup.height + 10;
  const regionBottom = plate.y - 12 - brackets.stroke / 2;
  const centre = 132;
  const lineHeight = 1.12;
  const { lines, style } = fitName(
    content.name,
    { font: "display600", steps: [36, 32, 28], maxLines: 2, lineHeight, maxWidth: width - 68 },
    tools,
    (l, s) => {
      const last = centre + ((l.length - 1) / 2) * s.size * lineHeight;
      const ink = blockInk(l, s, last, lineHeight, tools);
      return ink.top >= regionTop && ink.bottom <= regionBottom;
    },
  );
  lines.forEach((line, i) => {
    const baseline = centre + (i - (lines.length - 1) / 2) * style.size * lineHeight;
    texts.push(place(tools, "name", line, style, width / 2, "middle", baseline, INK));
  });

  texts.push(
    ...scanCopy(tools, width / 2, plate.y + plate.height + 58, { font: "body700", size: 26 }, { font: "body500", size: 17 }, 30),
  );
  if (code.kind === "preview") texts.push(...placePreviewLabels(tools, code.rect));

  return {
    format: "qr",
    width,
    height,
    field: null,
    image: null,
    glow: null,
    lockup,
    plate,
    code,
    brackets,
    band: { x: 0, y: 704, width, height: 16, fill: content.accent.fill },
    texts,
    // Above the band, 32 in from the other edges.
    safe: { x: 32, y: 32, width: width - 64, height: 704 - 32 - 2 },
  };
}

function tableCard(content: SignageContent, tools: LayoutTools): SignageLayout {
  const width = 700;
  const height = 500;
  const fieldWidth = 280;
  const scanCentre = fieldWidth + (width - fieldWidth) / 2;
  const lockup = { x: 28, y: 30, width: lockupWidth(16), height: 16, tone: "onDark" as const };
  const { plate, code } = placePlate(scanCentre - plateSlot(212) / 2, 50, 212, content.code);
  // 11 units out with a 4-unit stroke keeps the design's ≥ 9-unit clear gap to the plate.
  const brackets = placeBrackets(plate, 11, 22, 4, content.accent.base);

  const meta = fieldMeta(tools, content, {
    x: 28,
    maxWidth: fieldWidth - 44,
    size: 14,
    inlineGap: null,
    hashtagSteps: [15, 13, 12],
    singleBaseline: 456,
    stacked: [430, 456],
    nameGap: 22,
  });
  const texts = [...meta.texts];
  texts.push(
    ...fieldName(
      tools,
      content.name,
      { font: "display600", steps: [30, 26, 22], maxLines: 3, lineHeight: 1.1, maxWidth: fieldWidth - 44, x: 28 },
      meta.nameBaseline,
      lockup.y + lockup.height + 24,
    ),
    ...scanCopy(tools, scanCentre, plate.y + plate.height + 50, { font: "body700", size: 20 }, { font: "body500", size: 14 }, 24),
  );
  if (code.kind === "preview") texts.push(...placePreviewLabels(tools, code.rect));

  return {
    format: "table-card",
    width,
    height,
    ...field(fieldWidth, height, content, [0.15, 0.45, 0.9]),
    lockup,
    plate,
    code,
    brackets,
    band: { x: fieldWidth, y: 488, width: width - fieldWidth, height: 12, fill: content.accent.fill },
    texts,
    // 0.25 in at 100 units per inch.
    safe: inset(width, height, 25),
  };
}

function poster(content: SignageContent, tools: LayoutTools): SignageLayout {
  const width = 1200;
  const height = 1800;
  const fieldHeight = 780;
  const lockup = { x: 80, y: 76, width: lockupWidth(40), height: 40, tone: "onDark" as const };
  const { plate, code } = placePlate((width - plateSlot(540)) / 2, 856, 540, content.code);
  const brackets = placeBrackets(plate, 20, 60, 9, content.accent.base);

  const meta = fieldMeta(tools, content, {
    x: 80,
    maxWidth: width * 0.94 - 80,
    size: 34,
    inlineGap: 26,
    hashtagSteps: [34, 30, 26],
    singleBaseline: 692,
    stacked: [650, 696],
    nameGap: 64,
  });
  const texts = [
    ...meta.texts,
    ...fieldName(
      tools,
      content.name,
      { font: "display600", steps: [108, 92, 76, 64], maxLines: 2, lineHeight: 1.04, letterSpacing: -1, maxWidth: width * 0.94 - 80, x: 80 },
      meta.nameBaseline,
      lockup.y + lockup.height + 40,
    ),
    ...scanCopy(
      tools,
      width / 2,
      plate.y + plate.height + 100,
      { font: "body800", size: 56, letterSpacing: -0.5 },
      { font: "body500", size: 32 },
      52,
    ),
  ];
  if (code.kind === "preview") texts.push(...placePreviewLabels(tools, code.rect));

  return {
    format: "poster",
    width,
    height,
    ...field(width, fieldHeight, content, [0.25, 0.4, 0.92]),
    lockup,
    plate,
    code,
    brackets,
    band: { x: 0, y: 1768, width, height: 32, fill: content.accent.fill },
    texts,
    // The 6% inset: an A-series print (1 : 1.414) scaled to width trims only field and band.
    safe: inset(width, height, width * 0.06),
  };
}

function digital(content: SignageContent, tools: LayoutTools): SignageLayout {
  const width = 1920;
  const height = 1080;
  const fieldWidth = 1040;
  // The scan column sits a little left of the white side's centre so the plate, its brackets
  // and the instruction all stay inside the 5% title-safe inset.
  const scanCentre = 1464;
  const lockup = { x: 96, y: 84, width: lockupWidth(40), height: 40, tone: "onDark" as const };
  const { plate, code } = placePlate(scanCentre - plateSlot(520) / 2, 120, 520, content.code);
  const brackets = placeBrackets(plate, 18, 54, 8, content.accent.base);

  const meta = fieldMeta(tools, content, {
    x: 96,
    maxWidth: fieldWidth - 160,
    size: 40,
    inlineGap: 30,
    hashtagSteps: [40, 34, 30],
    singleBaseline: 930,
    stacked: [884, 938],
    nameGap: 70,
  });
  const texts = [
    ...meta.texts,
    ...fieldName(
      tools,
      content.name,
      { font: "display600", steps: [120, 102, 84, 72], maxLines: 3, lineHeight: 1.04, letterSpacing: -1, maxWidth: fieldWidth - 160, x: 96 },
      meta.nameBaseline,
      lockup.y + lockup.height + 40,
    ),
    ...scanCopy(
      tools,
      scanCentre,
      plate.y + plate.height + 110,
      { font: "body800", size: 54, letterSpacing: -0.5 },
      { font: "body500", size: 34 },
      56,
    ),
  ];
  if (code.kind === "preview") texts.push(...placePreviewLabels(tools, code.rect));

  return {
    format: "digital",
    width,
    height,
    ...field(fieldWidth, height, content, [0.2, 0.4, 0.9]),
    lockup,
    plate,
    code,
    brackets,
    band: { x: fieldWidth, y: 1052, width: width - fieldWidth, height: 28, fill: content.accent.fill },
    texts,
    // 5% title-safe for TV overscan.
    safe: inset(width, height, width * 0.05, height * 0.05),
  };
}

export function layoutSignage(format: SignageFormat, content: SignageContent, tools: LayoutTools): SignageLayout {
  const clean = { ...content, name: words(content.name).join(" ") || "Your event" };
  switch (format) {
    case "qr":
      return qrFormat(clean, tools);
    case "table-card":
      return tableCard(clean, tools);
    case "poster":
      return poster(clean, tools);
    case "digital":
      return digital(clean, tools);
  }
}
