import { describe, expect, it } from "vitest";
import { SHOTS_PER_GUEST } from "@/components/ff/shots";
import { HERO_PRINTS, HERO_STAGE, printHeight, printMotion } from "./hero-prints";
import { GUEST_FIVE } from "./photos";

describe("hero print composition", () => {
  it("shows exactly one guest's five frames, numbered 1–5", () => {
    expect(HERO_PRINTS).toHaveLength(SHOTS_PER_GUEST);
    expect(HERO_PRINTS.map((p) => p.shot).sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it("fills each print with a different one of the guest's five photos", () => {
    expect(GUEST_FIVE).toHaveLength(SHOTS_PER_GUEST);
    expect(new Set(GUEST_FIVE.map((photo) => photo.file)).size).toBe(SHOTS_PER_GUEST);
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
