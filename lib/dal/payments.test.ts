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
});
