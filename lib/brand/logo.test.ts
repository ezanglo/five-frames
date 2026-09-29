import { describe, expect, it } from "vitest";
import { SHOTS_PER_GUEST } from "@/components/ff/shots";
import {
  FAVICON_FRAMES,
  FAVICON_SIZE,
  LOGO_TONES,
  lockupMarkup,
  SYMBOL_FRAMES,
  SYMBOL_SIZE,
  WORDMARK_TITTLE_PATH,
  type SymbolFrame,
} from "./logo";

function overlaps(a: SymbolFrame, b: SymbolFrame): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

describe.each([
  ["symbol", SYMBOL_FRAMES, SYMBOL_SIZE],
  ["favicon drawing", FAVICON_FRAMES, FAVICON_SIZE],
] as const)("%s", (_, frames, size) => {
  it("is exactly five frames, one of them the centre", () => {
    expect(frames).toHaveLength(SHOTS_PER_GUEST);
    expect(frames.filter((f) => f.centre)).toHaveLength(1);
  });

  it("keeps every frame inside the square, with no two frames touching", () => {
    for (const f of frames) {
      expect(f.x).toBeGreaterThanOrEqual(0);
      expect(f.y).toBeGreaterThanOrEqual(0);
      expect(f.x + f.width).toBeLessThanOrEqual(size);
      expect(f.y + f.height).toBeLessThanOrEqual(size);
    }
    for (const [i, a] of frames.entries())
      for (const b of frames.slice(i + 1)) expect(overlaps(a, b)).toBe(false);
  });

  it("has two landscape, two portrait and one square frame", () => {
    const kind = (f: SymbolFrame) => (f.width > f.height ? "landscape" : f.width < f.height ? "portrait" : "square");
    const counts = frames.map(kind).reduce<Record<string, number>>((c, k) => ({ ...c, [k]: (c[k] ?? 0) + 1 }), {});
    expect(counts).toEqual({ landscape: 2, portrait: 2, square: 1 });
  });
});

describe("favicon drawing", () => {
  it("sits on whole pixels, so it stays crisp at 16px", () => {
    for (const f of FAVICON_FRAMES) for (const v of [f.x, f.y, f.width, f.height]) expect(Number.isInteger(v)).toBe(true);
  });
});

describe("lockupMarkup", () => {
  it("colours the centre frame and the i's tittle with the tone's centre colour", () => {
    const markup = lockupMarkup(LOGO_TONES.onLight);
    expect(markup).toContain(`<path d="${WORDMARK_TITTLE_PATH}" fill="${LOGO_TONES.onLight.centre}"/>`);
    expect(markup.match(new RegExp(`fill="${LOGO_TONES.onLight.centre}"`, "g"))).toHaveLength(2);
  });
});
