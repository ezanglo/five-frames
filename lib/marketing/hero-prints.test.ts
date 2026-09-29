import { describe, expect, it } from "vitest";
import { SHOTS_PER_GUEST } from "@/components/ff/shots";
import { HERO_PRINTS, HERO_STAGE, printHeight, printMotion } from "./hero-prints";
import { SAMPLE_SCENES } from "./sample-scenes";

describe("hero print composition", () => {
  it("shows exactly one guest's five frames, numbered 1–5", () => {
    expect(HERO_PRINTS).toHaveLength(SHOTS_PER_GUEST);
    expect(HERO_PRINTS.map((p) => p.shot).sort()).toEqual([1, 2, 3, 4, 5]);
    expect(new Set(HERO_PRINTS.map((p) => p.scene)).size).toBe(SHOTS_PER_GUEST);
  });

  it("uses only the existing illustrated scenes, never outside imagery", () => {
    for (const print of HERO_PRINTS) {
      expect(print.scene).toBeGreaterThanOrEqual(0);
      expect(print.scene).toBeLessThan(SAMPLE_SCENES.length);
    }
  });

  it("keeps every print inside the stage so nothing overflows the hero", () => {
    for (const print of HERO_PRINTS) {
      expect(print.x).toBeGreaterThanOrEqual(0);
      expect(print.y).toBeGreaterThanOrEqual(0);
      expect(print.x + print.width).toBeLessThanOrEqual(HERO_STAGE.width);
      expect(print.y + printHeight(print)).toBeLessThanOrEqual(HERO_STAGE.height);
    }
  });

  it("keeps motion shallow", () => {
    for (const print of HERO_PRINTS) {
      const { enter, gather } = printMotion(print);
      expect(Math.hypot(enter.x, enter.y)).toBeLessThanOrEqual(37);
      expect(Math.abs(gather.x)).toBeLessThanOrEqual(40);
      expect(Math.abs(gather.y)).toBeLessThanOrEqual(40);
      expect(Math.abs(print.rotate)).toBeLessThanOrEqual(9);
    }
  });
});
