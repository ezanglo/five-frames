import { readFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { beforeAll, describe, expect, it } from "vitest";
import { WORDMARK_TITTLE_PATH } from "@/lib/brand/logo";
import { decodeSvgQr } from "@/test/qr-decode";
import { ACCENTS, deriveAccentRoles } from "@/lib/theme/accents";
import {
  PREVIEW_QR,
  liveSignageQr,
  renderEventSignage,
  type SignageInput,
  type SignageQr,
} from "./signage";
import { SIGNAGE_FORMATS, signageFormatSpec, type SignageFormat } from "./signage-formats";
import {
  GUEST_INSTRUCTION,
  INK,
  NO_APP_REASSURANCE,
  QUIET_ZONE_MODULES,
  WHITE,
  contains,
  intersects,
  type Rect,
  type SignageLayout,
} from "./signage-layout";

/**
 * Themed signage (roadmap Slice 17; product.md §11.3, criteria 35, 49–53; architecture §7c).
 * Scannability is checked two ways: as geometry (plate, quiet zone, nothing touching it) and by
 * decoding the rasterized output with a real QR decoder. Neither replaces the human print-and-
 * scan check; they stop the class of defect the Slice 8 renderer had (brackets inside the plate
 * padding, a quiet zone under four modules) from coming back.
 */

const ORIGIN = "https://five-frames.vercel.app";
const TOKEN = "M762o_Rv0ng2yesJu1VpAA";
const CAPTURE_URL = `${ORIGIN}/e/${TOKEN}`;
const LIVE = liveSignageQr({ activated_at: "2026-10-01T00:00:00Z", event_token: TOKEN }, ORIGIN)!;
const LONG_NAME =
  "The Reyes–Villanueva Family Homecoming Weekend and Grand Reunion Dinner at the Old Lighthouse Pavilion";

let busyImage: Buffer;
/** A real photo (the Slice 15 fixture), for whole-sign decoding. */
const photo = readFileSync(path.resolve(import.meta.dirname, "../../test/fixtures/theme-sample-transcoded.jpg"));

beforeAll(async () => {
  // Deliberately busy and deterministic: seeded full-range noise, the worst case for anything
  // that could leak near the code.
  const width = 1800;
  const height = 1200;
  const pixels = Buffer.alloc(width * height * 3);
  let seed = 17;
  for (let i = 0; i < pixels.length; i++) {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    pixels[i] = seed >> 23;
  }
  busyImage = await sharp(pixels, { raw: { width, height, channels: 3 } }).jpeg().toBuffer();
});

function input(overrides: Partial<SignageInput> = {}): SignageInput {
  return {
    eventName: "Dani’s 40th",
    eventDate: "2026-10-18",
    hashtag: "DaniTurns40",
    accent: deriveAccentRoles("marigold"),
    themeImage: null,
    qr: LIVE,
    ...overrides,
  };
}

async function raster(svg: string): Promise<{ data: Uint8ClampedArray; width: number; height: number }> {
  const { data, info } = await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data: new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength), width: info.width, height: info.height };
}

const decode = decodeSvgQr;

/**
 * What a phone pointed at the code sees: the plate plus 20% of the sign around it, kept on the
 * white scan side (clipped to the canvas and away from the identity field).
 */
function cameraFrame(layout: SignageLayout): Rect {
  const m = layout.plate.width * 0.2;
  let left = layout.plate.x - m;
  let top = layout.plate.y - m;
  const right = Math.min(layout.width, layout.plate.x + layout.plate.width + m);
  const bottom = Math.min(layout.height, layout.plate.y + layout.plate.height + m);
  if (layout.field) {
    if (layout.field.height === layout.height) left = Math.max(left, layout.field.x + layout.field.width);
    else top = Math.max(top, layout.field.y + layout.field.height);
  }
  left = Math.max(0, left);
  top = Math.max(0, top);
  return { x: left, y: top, width: right - left, height: bottom - top };
}

/** The SVG without the parts that legitimately contain URL-like text: its namespace and data URIs. */
function visibleText(svg: string): string {
  return svg.replace('xmlns="http://www.w3.org/2000/svg"', "").replace(/data:[^"]+/g, "");
}

function gap(a: Rect, b: Rect): number {
  const dx = Math.max(b.x - (a.x + a.width), a.x - (b.x + b.width), 0);
  const dy = Math.max(b.y - (a.y + a.height), a.y - (b.y + b.height), 0);
  return Math.hypot(dx, dy);
}

/** Everything drawn except the plate and its code, as rectangles. */
function decorations(layout: SignageLayout): { what: string; rect: Rect }[] {
  return [
    ...(layout.field ? [{ what: "field", rect: layout.field }] : []),
    ...(layout.image ? [{ what: "image", rect: layout.image }] : []),
    { what: "lockup", rect: layout.lockup },
    { what: "band", rect: layout.band },
    ...layout.brackets.segments.map((rect) => ({ what: "bracket", rect })),
    ...layout.texts
      .filter((t) => t.role !== "previewLabel" && t.role !== "previewNote")
      .map((t) => ({ what: `text:${t.role}`, rect: t.box })),
  ];
}

const VARIANTS = SIGNAGE_FORMATS.flatMap((format) =>
  (["live", "preview"] as const).flatMap((qr) =>
    ([true, false] as const).map((image) => ({ format, qr, image })),
  ),
);

describe("renderEventSignage — geometry per format", () => {
  it.each(VARIANTS)("$format · $qr · image $image: canvas, plate, quiet zone, clear of everything", async ({ format, qr, image }) => {
    const { svg, layout } = await renderEventSignage(
      format,
      input({ qr: qr === "live" ? LIVE : PREVIEW_QR, themeImage: image ? busyImage : null }),
    );
    const spec = signageFormatSpec(format);

    // exact canvas
    expect([layout.width, layout.height]).toEqual([spec.width, spec.height]);
    expect(svg).toContain(`width="${spec.width}" height="${spec.height}" viewBox="0 0 ${spec.width} ${spec.height}"`);

    // the plate is white, on white, and the code sits inside it
    const r3 = (v: number) => String(Math.round(v * 1000) / 1000);
    expect(svg).toContain(
      `<rect x="${r3(layout.plate.x)}" y="${r3(layout.plate.y)}" width="${r3(layout.plate.width)}" height="${r3(layout.plate.height)}" rx="${r3(layout.plate.rx)}" fill="${WHITE}"/>`,
    );
    expect(contains(layout.plate, layout.code.rect)).toBe(true);
    if (layout.field) expect(intersects(layout.field, layout.plate)).toBe(false);
    expect(contains({ x: 0, y: 0, width: layout.width, height: layout.height }, layout.plate)).toBe(true);

    if (layout.code.kind === "live") {
      const pad = (layout.plate.width - layout.code.rect.width) / 2;
      expect(pad).toBeGreaterThanOrEqual(QUIET_ZONE_MODULES * layout.code.moduleSize - 1e-9);
      expect(svg).toContain(`fill="${INK}" shape-rendering="crispEdges"`);
    }

    // nothing — image, field, band, bracket, lockup, text — touches the plate (quiet zone included)
    for (const { what, rect } of decorations(layout)) {
      expect(intersects(rect, layout.plate), `${what} intersects the plate`).toBe(false);
    }
    // brackets keep the design's ≥ 9-unit clear gap outside the plate
    for (const segment of layout.brackets.segments) {
      expect(gap(segment, layout.plate)).toBeGreaterThanOrEqual(9 - 1e-9);
    }
    // content stays inside the format's trim / overscan inset
    for (const { what, rect } of decorations(layout)) {
      if (what === "field" || what === "image" || what === "band") continue;
      expect(contains(layout.safe, rect), `${what} leaves the safe area`).toBe(true);
    }
    expect(contains(layout.safe, layout.plate)).toBe(true);
    // text never overlaps other text
    const texts = layout.texts.filter((t) => t.role !== "previewLabel" && t.role !== "previewNote");
    for (const [i, a] of texts.entries()) {
      for (const b of texts.slice(i + 1)) expect(intersects(a.box, b.box), `${a.text} / ${b.text}`).toBe(false);
    }
    // field text is on the field, scan copy on the white side
    for (const t of layout.texts) {
      const onField = layout.field ? contains(layout.field, t.box) : false;
      if (t.role === "instruction" || t.role === "reassurance") expect(onField).toBe(false);
      if (layout.field && (t.role === "name" || t.role === "date" || t.role === "hashtag")) expect(onField).toBe(true);
    }
  });

  it.each(SIGNAGE_FORMATS)("%s uses the theme image only where the design places it, cropped to the field", async (format) => {
    const { svg, layout } = await renderEventSignage(format, input({ themeImage: busyImage }));
    const images = svg.match(/<image /g) ?? [];
    if (format === "qr") {
      expect(layout.image).toBeNull();
      expect(images).toHaveLength(0);
    } else {
      expect(layout.image).toEqual({ x: 0, y: 0, width: layout.field!.width, height: layout.field!.height });
      expect(images).toHaveLength(1);
      expect(svg).toMatch(/<image href="data:image\/jpeg;base64,[A-Za-z0-9+/=]+"/);
      expect(svg).not.toMatch(/https?:\/\/[^"]*storage/);
    }
  });

  it.each(SIGNAGE_FORMATS)("%s without an image or hashtag draws the finished night + accent field", async (format) => {
    const { svg, layout } = await renderEventSignage(
      format,
      input({ hashtag: null, themeImage: null, accent: deriveAccentRoles("violet") }),
    );
    expect(svg).not.toContain("<image ");
    expect(layout.texts.some((t) => t.role === "hashtag" || t.text.includes("#"))).toBe(false);
    if (format !== "qr") {
      expect(layout.glow).toEqual({ color: "#6B2BD9" });
      expect(svg).toContain('id="ff-glow"');
    }
  });

  it.each(SIGNAGE_FORMATS)("%s carries the fixed copy and the outlined FiveFrames lockup", async (format) => {
    const { svg, layout } = await renderEventSignage(format, input());
    const text = layout.texts.map((t) => t.text);
    expect(text).toContain(GUEST_INSTRUCTION);
    expect(text).toContain(NO_APP_REASSURANCE);
    expect(text.join(" ")).toContain("Dani’s 40th");
    expect(text).toContain("#DaniTurns40");
    if (format !== "qr") expect(text).toContain("Sun, 18 Oct 2026");
    expect(svg).toContain(WORDMARK_TITTLE_PATH);
  });
});

describe("renderEventSignage — accent", () => {
  it.each(ACCENTS.map((a) => a.key))("%s colors the band and brackets; the plate stays white and the modules ink", async (key) => {
    const roles = deriveAccentRoles(key);
    for (const format of SIGNAGE_FORMATS) {
      const { svg, layout } = await renderEventSignage(format, input({ accent: roles }));
      expect(layout.brackets.color).toBe(roles.base);
      expect(layout.band.fill).toBe(roles.fill);
      // The markup right after the brackets is exactly: white plate, then one ink module path.
      const afterBrackets = svg.slice(svg.lastIndexOf('stroke-linejoin="round"/>') + 'stroke-linejoin="round"/>'.length);
      expect(afterBrackets).toMatch(
        new RegExp(`^\\n<rect [^>]*fill="${WHITE}"/>\\n<path d="[^"]+" fill="${INK}" shape-rendering="crispEdges"/>\\n<rect `),
      );
    }
  });
});

describe("renderEventSignage — text safety", () => {
  const hostile = `🎉 Ana & Miguel <script>alert("x")</script> 'wedding' <b>bold</b>`;

  it.each(SIGNAGE_FORMATS)("%s never lets host text become markup", async (format) => {
    const { svg } = await renderEventSignage(format, input({ eventName: hostile, hashtag: `x"<y>&z` }));
    expect(svg).not.toContain("<script");
    expect(svg).not.toContain("<b>");
    expect(svg).not.toContain('"x")');
    expect(svg).toContain("<title>🎉 Ana &amp; Miguel &lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &apos;wedding&apos;");
    // The emoji isn't in the brand fonts, so it is written as escaped text in a system font.
    expect(svg).toMatch(/<text [^>]*>🎉<\/text>/);
    // One SVG root, no stray elements from the input.
    expect(svg.match(/<svg /g)).toHaveLength(1);
    expect(svg.match(/<title>/g)).toHaveLength(1);
  });
});

describe("renderEventSignage — long names and hashtags", () => {
  const MAX_LINES: Record<SignageFormat, number> = { qr: 2, "table-card": 3, poster: 2, digital: 3 };

  it.each(SIGNAGE_FORMATS)("%s steps a long name down, wraps it, and ellipsizes only as a last resort", async (format) => {
    const short = await renderEventSignage(format, input({ eventName: "Dani’s 40th" }));
    const medium = await renderEventSignage(format, input({ eventName: "The Reyes–Villanueva Family Homecoming Weekend" }));
    const long = await renderEventSignage(format, input({ eventName: LONG_NAME, hashtag: "ReyesVillanuevaHomecoming2027" }));
    const names = (l: SignageLayout) => l.texts.filter((t) => t.role === "name");

    const size = (l: SignageLayout) => names(l)[0].style.size;
    expect(size(short.layout)).toBeGreaterThanOrEqual(size(medium.layout));
    expect(size(medium.layout)).toBeGreaterThanOrEqual(size(long.layout));
    if (format !== "qr") expect(size(short.layout)).toBeGreaterThan(size(medium.layout));
    expect(names(medium.layout).map((t) => t.text).join(" ")).toBe("The Reyes–Villanueva Family Homecoming Weekend");
    expect(names(long.layout).length).toBeLessThanOrEqual(MAX_LINES[format]);
    expect(names(long.layout).at(-1)!.text.endsWith("…")).toBe(true);
    for (const t of names(long.layout)) {
      expect(contains(long.layout.safe, t.box)).toBe(true);
      expect(intersects(t.box, long.layout.plate)).toBe(false);
      if (long.layout.field) expect(contains(long.layout.field, t.box)).toBe(true);
    }
    // The scan copy never moves: it's placed from the plate, not from the name.
    const copy = (l: SignageLayout) => l.texts.find((t) => t.role === "instruction")!.baseline;
    expect(copy(long.layout)).toBe(copy(short.layout));
  });

  it.each(SIGNAGE_FORMATS)("%s shows a 30-character hashtag whole, and no '#' at all without one", async (format) => {
    const tag = "ReyesVillanuevaHomecoming_2027";
    const { layout } = await renderEventSignage(format, input({ hashtag: tag }));
    expect(layout.texts.find((t) => t.role === "hashtag")!.text).toBe(`#${tag}`);
    const none = await renderEventSignage(format, input({ hashtag: null }));
    expect(none.layout.texts.some((t) => t.text.includes("#"))).toBe(false);
  });

  it("drops a hashtag that doesn't fit beside the date to its own line (poster, digital)", async () => {
    for (const format of ["poster", "digital"] as const) {
      const inline = await renderEventSignage(format, input({ hashtag: "Dani40" }));
      const dropped = await renderEventSignage(format, input({ hashtag: "ReyesVillanuevaHomecoming_2027", eventDate: "2027-09-15" }));
      const baselines = (l: SignageLayout) => ["date", "hashtag"].map((r) => l.texts.find((t) => t.role === r)!.baseline);
      const [d1, h1] = baselines(inline.layout);
      expect(d1).toBe(h1);
      const [d2, h2] = baselines(dropped.layout);
      // Only drops when the pair is too wide for the field; either way both stay in the field.
      if (d2 !== h2) expect(h2).toBeGreaterThan(d2);
    }
  });
});

describe("QR modes", () => {
  it("liveSignageQr exists only for an activated event with a current token", () => {
    expect(liveSignageQr({ activated_at: null, event_token: null }, ORIGIN)).toBeNull();
    expect(liveSignageQr({ activated_at: null, event_token: TOKEN }, ORIGIN)).toBeNull();
    expect(liveSignageQr({ activated_at: "2026-10-01T00:00:00Z", event_token: null }, ORIGIN)).toBeNull();
    expect(LIVE).toEqual({ kind: "live", captureUrl: CAPTURE_URL });
  });

  it.each(SIGNAGE_FORMATS)("%s live: the whole sign decodes to exactly {origin}/e/{event_token}", async (format) => {
    for (const themeImage of [null, photo]) {
      const { svg } = await renderEventSignage(format, input({ themeImage, accent: deriveAccentRoles("rose") }));
      expect(await decode(svg)).toBe(CAPTURE_URL);
    }
  });

  it.each(SIGNAGE_FORMATS)("%s live: a camera framing the code decodes it over a deliberately busy theme", async (format) => {
    // Full-range noise defeats jsQR's whole-frame finder search (a decoder limit, not the sign's;
    // a real photo decodes whole-sign above), so this frames the code the way a phone does. The
    // quiet-zone raster test below is what proves the noise never reaches the code.
    const { svg, layout } = await renderEventSignage(format, input({ themeImage: busyImage }));
    expect(await decode(svg, cameraFrame(layout))).toBe(CAPTURE_URL);
  });

  it.each(ACCENTS.map((a) => a.key))("table card in %s decodes: the accent never reaches the code", async (key) => {
    const { svg } = await renderEventSignage("table-card", input({ accent: deriveAccentRoles(key), themeImage: photo }));
    expect(await decode(svg)).toBe(CAPTURE_URL);
  });

  it.each(SIGNAGE_FORMATS)("%s live: the rasterized quiet zone is pure white", async (format) => {
    const { svg, layout } = await renderEventSignage(format, input({ themeImage: busyImage }));
    if (layout.code.kind !== "live") throw new Error("expected live");
    const { data, width } = await raster(svg);
    const q = layout.code.rect;
    const m = layout.code.moduleSize;
    // A ring 4 modules wide around the code, sampled on a 1-unit grid (inset by 1 unit from each
    // edge to stay clear of anti-aliasing on the modules and the plate corners).
    const ring = { x: q.x - QUIET_ZONE_MODULES * m + 1, y: q.y - QUIET_ZONE_MODULES * m + 1, size: q.width + 2 * QUIET_ZONE_MODULES * m - 2 };
    let darkest = 255;
    for (let y = Math.ceil(ring.y); y < ring.y + ring.size; y++) {
      for (let x = Math.ceil(ring.x); x < ring.x + ring.size; x++) {
        const insideCode = x >= q.x - 1 && x <= q.x + q.width + 1 && y >= q.y - 1 && y <= q.y + q.height + 1;
        if (insideCode) continue;
        const i = (y * width + x) * 4;
        darkest = Math.min(darkest, data[i], data[i + 1], data[i + 2]);
      }
    }
    expect(darkest).toBeGreaterThanOrEqual(250);
  });

  it.each(SIGNAGE_FORMATS)("%s preview contains no URL or token and does not decode", async (format) => {
    const { svg, layout } = await renderEventSignage(format, input({ qr: PREVIEW_QR, themeImage: busyImage }));
    expect(layout.code.kind).toBe("preview");
    expect(svg).not.toContain(TOKEN);
    expect(visibleText(svg)).not.toContain("/e/");
    expect(visibleText(svg)).not.toMatch(/https?:|www\.|five-frames/i);
    expect(layout.texts.map((t) => t.text)).toEqual(expect.arrayContaining(["PREVIEW", "Not a working code"]));
    for (const t of layout.texts.filter((t) => t.role === "previewLabel" || t.role === "previewNote")) {
      expect(contains(layout.code.rect, t.box)).toBe(true);
    }
    expect(await decode(svg)).toBeNull();
    expect(await decode(svg, cameraFrame(layout))).toBeNull();
  });

  it("a preview can't carry a URL even if one is smuggled in", async () => {
    const smuggled = { kind: "preview", captureUrl: CAPTURE_URL } as unknown as SignageQr;
    const { svg } = await renderEventSignage("qr", input({ qr: smuggled }));
    expect(svg).not.toContain(TOKEN);
    expect(await decode(svg)).toBeNull();
  });

  it("theme changes never change the code: same modules, same decoded destination", async () => {
    const code = (svg: string) => svg.match(/<path d="([^"]+)" fill="#15141A" shape-rendering="crispEdges"\/>/)![1];
    for (const format of SIGNAGE_FORMATS) {
      const plain = (await renderEventSignage(format, input({ hashtag: null, accent: deriveAccentRoles("violet") }))).svg;
      const { svg: themed, layout: themedLayout } = await renderEventSignage(
        format,
        input({ hashtag: "Changed", accent: deriveAccentRoles("teal"), themeImage: busyImage, eventName: LONG_NAME }),
      );
      expect(code(themed)).toBe(code(plain));
      expect(await decode(themed, cameraFrame(themedLayout))).toBe(CAPTURE_URL);
    }
  });

  it("the preview placeholder is the same fixed pattern for every event", async () => {
    const placeholder = (svg: string) => svg.slice(svg.indexOf('fill="#F5F4F8"'), svg.indexOf('stroke-dasharray'));
    const a = (await renderEventSignage("table-card", input({ qr: PREVIEW_QR }))).svg;
    const b = (await renderEventSignage("table-card", input({ qr: PREVIEW_QR, eventName: "Other", accent: deriveAccentRoles("teal") }))).svg;
    expect(placeholder(a)).toBe(placeholder(b));
  });
});
