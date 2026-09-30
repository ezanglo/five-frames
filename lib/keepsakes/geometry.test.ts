import { describe, expect, it } from "vitest";
import { FULL_SET_CANVAS, nameSize, SINGLE_CANVAS, singlePhotoWindow, THEME_IMAGE_BOXES } from "./geometry";
import { SINGLE_STYLES } from "./styles";

describe("family canvases", () => {
  it("are one per family: 1080 × 1350 (4:5) and 1200 × 1800 (2:3, ≤ 2.5 MP)", () => {
    expect(SINGLE_CANVAS).toEqual({ width: 1080, height: 1350 });
    expect(FULL_SET_CANVAS).toEqual({ width: 1200, height: 1800 });
    expect(FULL_SET_CANVAS.width * FULL_SET_CANVAS.height).toBeLessThanOrEqual(2_500_000);
  });
});

describe("Single-photo photo windows (board §06)", () => {
  it.each([
    ["print", 4, 5, 688, 860],
    ["print", 3, 2, 952, 635],
    ["print", 3, 4, 645, 860],
    ["print", 16, 9, 952, 536],
    ["print", 1, 1, 880, 880],
    ["booth", 4, 5, 640, 800],
    ["booth", 3, 2, 904, 603],
    ["booth", 1, 1, 780, 780],
    ["poster", 4, 5, 592, 740],
    ["poster", 3, 2, 936, 624],
    ["poster", 1, 1, 700, 700],
    ["journal", 4, 5, 640, 800],
    ["journal", 3, 4, 615, 820],
    ["journal", 3, 2, 930, 620],
    ["journal", 1, 1, 640, 640],
    ["album", 4, 5, 640, 800],
    ["album", 3, 2, 860, 573],
    ["album", 1, 1, 700, 700],
  ] as const)("%s %i:%i → %i × %i", (style, w, h, ew, eh) => {
    expect(singlePhotoWindow(style, w * 400, h * 400)).toEqual({ width: ew, height: eh });
  });

  it("keeps every photo whole: the window has the photo's own ratio and fits the canvas", () => {
    for (const { id } of SINGLE_STYLES) {
      for (const [w, h] of [[1200, 1600], [1600, 900], [900, 1600], [3000, 800], [1000, 1000]]) {
        const win = singlePhotoWindow(id, w, h);
        expect(Math.abs(win.width / win.height - w / h)).toBeLessThan(0.02 * (w / h));
        expect(win.width).toBeLessThanOrEqual(SINGLE_CANVAS.width);
        expect(win.height).toBeLessThanOrEqual(SINGLE_CANVAS.height);
      }
    }
  });
});

describe("theme image boxes", () => {
  it("are never used by Print, Booth or Grid, and never capture-sized inside a photo area", () => {
    expect(THEME_IMAGE_BOXES.print).toBeUndefined();
    expect(THEME_IMAGE_BOXES.booth).toBeUndefined();
    expect(THEME_IMAGE_BOXES.grid).toBeUndefined();
  });
});

describe("name sizes step down by length", () => {
  it("uses the four steps", () => {
    const steps = [80, 66, 56, 48] as const;
    expect(nameSize("Dani’s 40th", steps)).toBe(80);
    expect(nameSize("Leo’s Graduation Party", steps)).toBe(66);
    expect(nameSize("Santos Family Reunion Weekend 2026", steps)).toBe(56);
    expect(nameSize("The Reyes–Villanueva Family Homecoming Weekend", steps)).toBe(48);
  });
});

// ------------------------------------------------------------------------- Full Set slots

import { FULL_SET_SLOTS, type SlotRect } from "./geometry";
import { FULL_SET_STYLES } from "./styles";
import { SYMBOL_FRAMES } from "@/lib/brand/logo";

const overlaps = (a: SlotRect, b: SlotRect) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

const corners = (r: SlotRect) => [
  [r.x, r.y],
  [r.x + r.width, r.y],
  [r.x, r.y + r.height],
  [r.x + r.width, r.y + r.height],
];

describe("Full Set slots", () => {
  it("every Full Set style declares exactly five in-bounds, non-overlapping slots", () => {
    expect(Object.keys(FULL_SET_SLOTS).sort()).toEqual(FULL_SET_STYLES.map((s) => s.id).sort());
    for (const { id } of FULL_SET_STYLES) {
      const slots = FULL_SET_SLOTS[id];
      expect(slots).toHaveLength(5);
      for (const s of slots) {
        expect(s.x).toBeGreaterThanOrEqual(0);
        expect(s.y).toBeGreaterThanOrEqual(0);
        expect(s.x + s.width).toBeLessThanOrEqual(FULL_SET_CANVAS.width);
        expect(s.y + s.height).toBeLessThanOrEqual(FULL_SET_CANVAS.height);
        expect(s.width).toBeGreaterThan(0);
        expect(s.height).toBeGreaterThan(0);
      }
      for (let i = 0; i < 5; i++) for (let j = i + 1; j < 5; j++) expect(overlaps(slots[i], slots[j])).toBe(false);
    }
  });

  it("keeps slot ratios between 1 : 2.11 and 3 : 2 (no extreme crop windows)", () => {
    for (const { id } of FULL_SET_STYLES) {
      for (const s of FULL_SET_SLOTS[id]) {
        const ratio = s.width / s.height;
        expect(ratio).toBeGreaterThanOrEqual(360 / 760 - 1e-9);
        expect(ratio).toBeLessThanOrEqual(1.5 + 1e-9);
      }
    }
  });

  it("uses the design's slot rectangles for Strip, Grid, Spotlight and Prints", () => {
    expect(FULL_SET_SLOTS.strip.map((s) => s.y)).toEqual([126, 422, 718, 1014, 1310]);
    expect(FULL_SET_SLOTS.grid[4]).toEqual({ x: 64, y: 1192, width: 526, height: 544 });
    expect(FULL_SET_SLOTS.spotlight[0]).toEqual({ x: 64, y: 64, width: 1072, height: 1072 });
    expect(FULL_SET_SLOTS.prints.map((s) => [s.x, s.y])).toEqual([[116, 110], [674, 174], [142, 690], [652, 754], [128, 1260]]);
  });
});

/** The most slots sharing one corner once the 24 px gutters are closed. */
function cornerMultiplicity(slots: readonly SlotRect[]): number {
  const closed = new Map<string, number>();
  for (const s of slots) {
    for (const [x, y] of corners({ x: s.x - 12, y: s.y - 12, width: s.width + 24, height: s.height + 24 })) {
      closed.set(`${x},${y}`, (closed.get(`${x},${y}`) ?? 0) + 1);
    }
  }
  return Math.max(...closed.values());
}

describe("Signature geometry (the brandmark made of photographs)", () => {
  const slots = FULL_SET_SLOTS.signature;
  const form = { x: 72, y: 72, width: 1056, height: 1232 };

  it("is landscape, portrait, landscape, portrait, then the closing square — like SYMBOL_FRAMES", () => {
    const kind = (w: number, h: number) => (w === h ? "square" : w > h ? "landscape" : "portrait");
    expect(slots.map((s) => kind(s.width, s.height))).toEqual(["landscape", "portrait", "landscape", "portrait", "square"]);
    expect(SYMBOL_FRAMES.map((f) => kind(f.width, f.height))).toEqual(["landscape", "portrait", "landscape", "portrait", "square"]);
  });

  it("turns clockwise like the mark: top, right, bottom, left, with the square in the middle", () => {
    const centre = (r: { x: number; y: number; width: number; height: number }) => [r.x + r.width / 2, r.y + r.height / 2];
    const [fx, fy] = centre(form);
    const markCentre = 60;
    for (let i = 0; i < 4; i++) {
      const [sx, sy] = centre(slots[i]);
      const f = SYMBOL_FRAMES[i];
      const [mx, my] = [f.x + f.width / 2, f.y + f.height / 2];
      expect(Math.sign(Math.round(sx - fx))).toBe(Math.sign(Math.round(mx - markCentre)));
      expect(Math.sign(Math.round(sy - fy))).toBe(Math.sign(Math.round(my - markCentre)));
    }
  });

  it("has 3:2 landscape arms, 36:76 portrait arms and a square fifth slot between them", () => {
    for (const i of [0, 2]) expect(slots[i].width / slots[i].height).toBeCloseTo(3 / 2, 6);
    for (const i of [1, 3]) expect(slots[i].width / slots[i].height).toBeCloseTo(36 / 76, 6);
    const square = slots[4];
    expect(square.width).toBe(square.height);
    // Bounded by the four arms on every side.
    expect(square.y).toBe(slots[0].y + slots[0].height + 24);
    expect(square.x + square.width + 24).toBe(slots[1].x);
    expect(square.y + square.height + 24).toBe(slots[2].y);
    expect(square.x).toBe(slots[3].x + slots[3].width + 24);
  });

  it("tiles the 1056 × 1232 form with 24 px gutters", () => {
    const xs = slots.map((s) => s.x);
    const ys = slots.map((s) => s.y);
    expect(Math.min(...xs)).toBe(form.x);
    expect(Math.min(...ys)).toBe(form.y);
    expect(Math.max(...slots.map((s) => s.x + s.width))).toBe(form.x + form.width);
    expect(Math.max(...slots.map((s) => s.y + s.height))).toBe(form.y + form.height);
    const area = slots.reduce((sum, s) => sum + s.width * s.height, 0);
    // Everything that isn't a slot is gutter: 24 px bands between neighbours.
    expect(form.width * form.height - area).toBeGreaterThan(0);
    expect(slots[1].x - (slots[0].x + slots[0].width)).toBe(24);
    expect(slots[3].y - (slots[0].y + slots[0].height)).toBe(24);
    expect(slots[2].y - (slots[1].y + slots[1].height)).toBe(24);
    expect(slots[2].x - (slots[3].x + slots[3].width)).toBe(24);
  });

  it("detects four meeting corners in a plain 2 × 2 grid (the check's control)", () => {
    const grid = [
      { x: 0, y: 0, width: 100, height: 100 },
      { x: 124, y: 0, width: 100, height: 100 },
      { x: 0, y: 124, width: 100, height: 100 },
      { x: 124, y: 124, width: 100, height: 100 },
    ];
    expect(cornerMultiplicity(grid)).toBe(4);
    expect(cornerMultiplicity(slots)).toBeLessThan(4);
  });

  it("never lets four corners meet", () => {
    const count = new Map<string, number>();
    for (const s of slots) for (const [x, y] of corners(s)) count.set(`${x},${y}`, (count.get(`${x},${y}`) ?? 0) + 1);
    // With gutters no two slots even share a corner point; check the gutter-closed version too.
    expect(Math.max(...count.values())).toBeLessThan(4);
    // Close the 24 px gutters (grow every slot by half a gutter) so neighbours touch, as the
    // mark's frames do; then no point may be a corner of four slots.
    const closed = new Map<string, number>();
    for (const s of slots) {
      const grown = { x: s.x - 12, y: s.y - 12, width: s.width + 24, height: s.height + 24 };
      for (const [x, y] of corners(grown)) closed.set(`${x},${y}`, (closed.get(`${x},${y}`) ?? 0) + 1);
    }
    // Sanity: closing the gutters really does make neighbours share corner points.
    expect(Math.max(...closed.values())).toBeGreaterThanOrEqual(2);
    expect(Math.max(...closed.values())).toBeLessThan(4);
  });
});
