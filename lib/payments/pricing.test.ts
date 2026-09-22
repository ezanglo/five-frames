import { describe, expect, it } from "vitest";
import { getPendingPaymentState, PENDING_PAYMENT_GRACE_MINUTES } from "./pricing";

describe("getPendingPaymentState", () => {
  const now = new Date("2026-09-22T12:00:00.000Z");

  it("is not pending when there is no payment", () => {
    expect(getPendingPaymentState(null, now)).toEqual({
      isPending: false,
      isLikelyStillConfirming: false,
    });
  });

  it("is not pending for a non-pending payment", () => {
    const state = getPendingPaymentState(
      { provider_status: "paid", created_at: now.toISOString() },
      now,
    );
    expect(state.isPending).toBe(false);
  });

  it("is likely still confirming just under the grace window", () => {
    const createdAt = new Date(
      now.getTime() - (PENDING_PAYMENT_GRACE_MINUTES - 1) * 60_000,
    ).toISOString();
    const state = getPendingPaymentState({ provider_status: "pending", created_at: createdAt }, now);
    expect(state).toEqual({ isPending: true, isLikelyStillConfirming: true });
  });

  it("is no longer likely still confirming past the grace window", () => {
    const createdAt = new Date(
      now.getTime() - (PENDING_PAYMENT_GRACE_MINUTES + 1) * 60_000,
    ).toISOString();
    const state = getPendingPaymentState({ provider_status: "pending", created_at: createdAt }, now);
    expect(state).toEqual({ isPending: true, isLikelyStillConfirming: false });
  });
});
