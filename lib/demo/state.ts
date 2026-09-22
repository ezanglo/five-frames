/**
 * Pure, DOM-free local state for the public pre-purchase demo (product.md §7.1, decision D14).
 * Nothing here reads or writes a network call, storage, or a server — the demo's five-frame
 * state lives entirely in a React component's memory, and this module is just the shape and the
 * transitions, kept separate so the five-frame mechanic itself is testable without a browser.
 */

export type DemoFrameSlot =
  | { kind: "empty" }
  | { kind: "filled"; source: "own" | "sample"; previewUrl: string; message: string };

export type DemoFrames = readonly [
  DemoFrameSlot,
  DemoFrameSlot,
  DemoFrameSlot,
  DemoFrameSlot,
  DemoFrameSlot,
];

export function createEmptyDemoFrames(): DemoFrames {
  return [
    { kind: "empty" },
    { kind: "empty" },
    { kind: "empty" },
    { kind: "empty" },
    { kind: "empty" },
  ];
}

function assertValidIndex(index: number): void {
  if (!Number.isInteger(index) || index < 0 || index > 4) {
    throw new Error(`demo slot index out of range: ${index}`);
  }
}

/** The one slot the visitor can act on next, or -1 once all five are filled. */
export function nextEmptySlotIndex(frames: DemoFrames): number {
  return frames.findIndex((slot) => slot.kind === "empty");
}

export function filledSlotCount(frames: DemoFrames): number {
  return frames.filter((slot) => slot.kind === "filled").length;
}

export function isDemoComplete(frames: DemoFrames): boolean {
  return nextEmptySlotIndex(frames) === -1;
}

/** Returns a new frames array with one slot committed — never mutates the input. */
export function withSlotFilled(
  frames: DemoFrames,
  index: number,
  slot: Extract<DemoFrameSlot, { kind: "filled" }>,
): DemoFrames {
  assertValidIndex(index);
  const next = [...frames] as DemoFrameSlot[];
  next[index] = slot;
  return next as unknown as DemoFrames;
}

/** Returns a new frames array with one slot reset to empty — never mutates the input. */
export function withSlotCleared(frames: DemoFrames, index: number): DemoFrames {
  assertValidIndex(index);
  const next = [...frames] as DemoFrameSlot[];
  next[index] = { kind: "empty" };
  return next as unknown as DemoFrames;
}
