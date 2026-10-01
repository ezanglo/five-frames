/**
 * The guest's five slots as Your Five shows them. Pure, so the frame accounting is testable
 * without a browser.
 *
 * - `committed`: a kept photo the guest can see.
 * - `pending`: a reservation still in progress (finish it, or it lapses).
 * - `moderated`: a kept photo the host has hidden or deleted. It is out of the guest's view
 *   (product.md §8.3) but its frame stays consumed (§9.3, invariant 4).
 */
export type GuestSlotStatus = "committed" | "pending" | "moderated";

export type GuestSlot = {
  id: string;
  status: GuestSlotStatus;
  message: string | null;
  capturedAt: string | null;
  thumbnailUrl: string | null;
  displayUrl: string | null;
  downloadUrl: string | null;
} | null;

export type GuestSlotCapture = {
  id: string;
  slotIndex: number;
  status: "committed" | "pending";
  message: string | null;
  capturedAt: string | null;
  thumbnailUrl: string | null;
  displayUrl: string | null;
  downloadUrl: string | null;
};

const SLOT_COUNT = 5;

export function buildGuestSlots(
  captures: GuestSlotCapture[],
  moderatedSlotIndexes: number[],
): GuestSlot[] {
  const slots: GuestSlot[] = Array.from({ length: SLOT_COUNT }, () => null);
  for (const index of moderatedSlotIndexes) {
    slots[index] = {
      id: `moderated-${index}`,
      status: "moderated",
      message: null,
      capturedAt: null,
      thumbnailUrl: null,
      displayUrl: null,
      downloadUrl: null,
    };
  }
  for (const c of captures) {
    slots[c.slotIndex] = {
      id: c.id,
      status: c.status,
      message: c.message,
      capturedAt: c.capturedAt,
      thumbnailUrl: c.thumbnailUrl,
      displayUrl: c.displayUrl,
      downloadUrl: c.downloadUrl,
    };
  }
  return slots;
}

/** Frames this session has used: every committed capture, visible or moderated. */
export function takenFrameCount(slots: GuestSlot[]): number {
  return slots.filter((s) => s?.status === "committed" || s?.status === "moderated").length;
}

/**
 * The "N of 5 kept" a guest sees once capture has closed, from their visible kept photos and
 * their moderated slots. The same count as `takenFrameCount` while capture is open: a hidden or
 * deleted photo was still kept.
 */
export function keptFrameCount(
  visible: Omit<GuestSlotCapture, "status">[],
  moderatedSlotIndexes: number[],
): number {
  return takenFrameCount(
    buildGuestSlots(
      visible.map((photo) => ({ ...photo, status: "committed" as const })),
      moderatedSlotIndexes,
    ),
  );
}
