import { describe, expect, it } from "vitest";
import { buildGuestSlots, takenFrameCount, type GuestSlotCapture } from "./guest-slots";

function kept(slotIndex: number): GuestSlotCapture {
  return {
    id: `capture-${slotIndex}`,
    slotIndex,
    status: "committed",
    message: null,
    capturedAt: "2026-10-01T00:00:00.000Z",
    thumbnailUrl: `https://storage.test/t${slotIndex}`,
    displayUrl: `https://storage.test/d${slotIndex}`,
    downloadUrl: `https://storage.test/o${slotIndex}`,
  };
}

/** Product.md §9.3 / invariant 4: host moderation never gives a guest a frame back (HOST-08). */
describe("guest slots after host moderation", () => {
  it("a hidden or deleted capture still counts as taken and is never offered as free", () => {
    // Four kept; the host hid or deleted slot 1, so the guest's own view lists only 0, 2, 3.
    const slots = buildGuestSlots([kept(0), kept(2), kept(3)], [1]);

    expect(takenFrameCount(slots)).toBe(4);
    expect(slots[1]?.status).toBe("moderated");
    expect(slots[1]?.thumbnailUrl).toBeNull();
    expect(slots[1]?.downloadUrl).toBeNull();
    // The next free slot is the one the server would actually reserve.
    expect(slots.findIndex((s) => s === null)).toBe(4);
  });

  it("unhide moves a slot from moderated back to visible without changing the count", () => {
    const hidden = buildGuestSlots([kept(0), kept(2)], [1]);
    const unhidden = buildGuestSlots([kept(0), kept(1), kept(2)], []);
    expect(takenFrameCount(hidden)).toBe(3);
    expect(takenFrameCount(unhidden)).toBe(3);
    expect(unhidden[1]?.status).toBe("committed");
  });

  it("five used frames leave nothing free, however many are moderated", () => {
    const slots = buildGuestSlots([kept(0), kept(3), kept(4)], [1, 2]);
    expect(takenFrameCount(slots)).toBe(5);
    expect(slots.some((s) => s === null)).toBe(false);
  });

  it("a pending reservation occupies its slot but is not counted as taken", () => {
    const slots = buildGuestSlots([kept(0), { ...kept(1), status: "pending" }], []);
    expect(takenFrameCount(slots)).toBe(1);
    expect(slots[1]?.status).toBe("pending");
  });
});
