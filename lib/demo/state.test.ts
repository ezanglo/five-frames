import { describe, expect, it } from "vitest";
import {
  createEmptyDemoFrames,
  filledSlotCount,
  isDemoComplete,
  nextEmptySlotIndex,
  withSlotCleared,
  withSlotFilled,
} from "./state";

function filled(previewUrl = "blob:x") {
  return { kind: "filled" as const, source: "own" as const, previewUrl, message: "" };
}

describe("demo frame state", () => {
  it("starts as five empty slots", () => {
    const frames = createEmptyDemoFrames();
    expect(frames).toHaveLength(5);
    expect(frames.every((s) => s.kind === "empty")).toBe(true);
    expect(nextEmptySlotIndex(frames)).toBe(0);
    expect(filledSlotCount(frames)).toBe(0);
    expect(isDemoComplete(frames)).toBe(false);
  });

  it("fills slots in order without mutating the previous array", () => {
    const start = createEmptyDemoFrames();
    const afterFirst = withSlotFilled(start, 0, filled());

    expect(start[0].kind).toBe("empty"); // original untouched
    expect(afterFirst[0]).toEqual(filled());
    expect(nextEmptySlotIndex(afterFirst)).toBe(1);
    expect(filledSlotCount(afterFirst)).toBe(1);
  });

  it("is complete only once all five slots are filled", () => {
    let frames = createEmptyDemoFrames();
    for (let i = 0; i < 4; i++) {
      frames = withSlotFilled(frames, i, filled());
      expect(isDemoComplete(frames)).toBe(false);
    }
    frames = withSlotFilled(frames, 4, filled());
    expect(isDemoComplete(frames)).toBe(true);
    expect(filledSlotCount(frames)).toBe(5);
    expect(nextEmptySlotIndex(frames)).toBe(-1);
  });

  it("clearing a filled slot returns it to empty and makes it reachable again", () => {
    let frames = createEmptyDemoFrames();
    frames = withSlotFilled(frames, 0, filled());
    frames = withSlotFilled(frames, 1, filled());
    frames = withSlotCleared(frames, 0);

    expect(frames[0]).toEqual({ kind: "empty" });
    expect(filledSlotCount(frames)).toBe(1);
    expect(nextEmptySlotIndex(frames)).toBe(0);
  });

  it("distinguishes own-photo from sample-photo sources and preserves the local message", () => {
    const frames = withSlotFilled(createEmptyDemoFrames(), 2, {
      kind: "filled",
      source: "sample",
      previewUrl: "data:image/svg+xml,fake",
      message: "so happy you're here",
    });
    const slot = frames[2];
    expect(slot).toEqual({
      kind: "filled",
      source: "sample",
      previewUrl: "data:image/svg+xml,fake",
      message: "so happy you're here",
    });
  });

  it("rejects an out-of-range slot index", () => {
    const frames = createEmptyDemoFrames();
    expect(() => withSlotFilled(frames, 5, filled())).toThrow();
    expect(() => withSlotFilled(frames, -1, filled())).toThrow();
    expect(() => withSlotCleared(frames, 5)).toThrow();
  });
});
