import { describe, expect, it } from "vitest";
import { isDuplicatePayment } from "@/lib/dal/payments";
import type { EventRow, PaymentRow } from "@/lib/db/types";

/** Pure-logic unit coverage for isDuplicatePayment — no database needed. */
describe("isDuplicatePayment", () => {
  const baseEvent: EventRow = {
    id: "event-1",
    host_id: "host-1",
    name: "Test event",
    event_date: null,
    timezone: "Asia/Manila",
    host_message: null,
    reveal_mode: "after_event",
    reveal_at: null,
    visibility: "anyone_with_link",
    sharing_enabled: true,
    hashtag: null,
    accent_color: "violet",
    theme_image_path: null,
    event_token: "tok",
    gallery_token: "gal",
    activated_at: new Date().toISOString(),
    activating_payment_id: "payment-winner",
    capture_opened_at: null,
    capture_closed_at: null,
    safety_net_closes_at: null,
    hosted_until: null,
    grace_until: null,
    media_deleted_at: null,
    guest_session_cap: 250,
    guest_session_count: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const basePayment: PaymentRow = {
    id: "payment-winner",
    event_id: "event-1",
    source: "provider",
    provider_checkout_session_id: null,
    checkout_url: null,
    provider_status: null,
    amount: null,
    currency: null,
    fee_amount: null,
    provider_webhook_event_id: null,
    manual_method: null,
    manual_amount: null,
    manual_currency: null,
    paid_at: null,
    confirmed_at: null,
    confirmed_by: null,
    reference_note: null,
    refunded_at: null,
    refunded_by: null,
    refund_note: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  it("is false for the provider payment that actually activated the event", () => {
    const payment: PaymentRow = { ...basePayment, id: "payment-winner", provider_status: "paid" };
    expect(isDuplicatePayment(payment, baseEvent)).toBe(false);
  });

  it("is true for a provider payment flagged paid_duplicate that isn't the activating payment", () => {
    const payment: PaymentRow = {
      ...basePayment,
      id: "payment-loser",
      provider_status: "paid_duplicate",
    };
    expect(isDuplicatePayment(payment, baseEvent)).toBe(true);
  });

  it("is false for a still-pending provider payment that never reached paid", () => {
    const payment: PaymentRow = {
      ...basePayment,
      id: "payment-loser",
      provider_status: "pending",
    };
    expect(isDuplicatePayment(payment, baseEvent)).toBe(false);
  });

  it("is false for the manual payment that actually activated the event", () => {
    const payment: PaymentRow = {
      ...basePayment,
      id: "payment-winner",
      source: "manual",
      confirmed_at: new Date().toISOString(),
    };
    expect(isDuplicatePayment(payment, baseEvent)).toBe(false);
  });

  it("is true for a confirmed manual payment that lost the activation race", () => {
    const payment: PaymentRow = {
      ...basePayment,
      id: "payment-loser",
      source: "manual",
      confirmed_at: new Date().toISOString(),
    };
    expect(isDuplicatePayment(payment, baseEvent)).toBe(true);
  });

  it("is false for the sole activating manual payment after recordManualRefund clears activating_payment_id", () => {
    // recordManualRefund (lib/dal/payments.ts) intentionally clears
    // event.activating_payment_id as part of returning the event to draft, and stamps
    // refunded_at on the payment it just refunded. Without also checking refunded_at,
    // that state read as "succeeded, but isn't the activating payment" — i.e. a false
    // duplicate — even though nothing else was ever paid.
    const refundedEvent: EventRow = { ...baseEvent, activated_at: null, activating_payment_id: null };
    const payment: PaymentRow = {
      ...basePayment,
      id: "payment-winner",
      source: "manual",
      confirmed_at: new Date().toISOString(),
      refunded_at: new Date().toISOString(),
      refunded_by: "operator-1",
    };
    expect(isDuplicatePayment(payment, refundedEvent)).toBe(false);
  });

  it("is still true for a genuine second successful payment after another payment activated the event, even once the event is later refunded", () => {
    // A real duplicate (never refunded itself) must keep surfacing for operator
    // follow-up regardless of what happens to the activating payment.
    const refundedEvent: EventRow = { ...baseEvent, activated_at: null, activating_payment_id: null };
    const genuineDuplicate: PaymentRow = {
      ...basePayment,
      id: "payment-loser",
      source: "manual",
      confirmed_at: new Date().toISOString(),
      refunded_at: null,
    };
    expect(isDuplicatePayment(genuineDuplicate, refundedEvent)).toBe(true);
    expect(isDuplicatePayment(genuineDuplicate, baseEvent)).toBe(true);
  });
});
