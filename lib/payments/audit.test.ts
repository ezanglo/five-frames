import { describe, expect, it } from "vitest";
import { paymentAuditRows, type OperatorPaymentView } from "./audit";

const base: OperatorPaymentView = {
  id: "p1",
  event_id: "e1",
  source: "provider",
  provider_checkout_session_id: "cs_1",
  checkout_url: null,
  provider_status: "paid",
  amount: 99900,
  currency: "PHP",
  fee_amount: null,
  provider_webhook_event_id: "evt_1",
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
  created_at: "2026-10-01T00:00:00.000Z",
  updated_at: "2026-10-01T00:00:00.000Z",
  confirmedByEmail: null,
  refundedByEmail: null,
};

function rows(payment: OperatorPaymentView, duplicate = false) {
  return paymentAuditRows(payment, { duplicate, timezone: "Asia/Manila" });
}

describe("payment audit rows (OPS-03)", () => {
  it("a provider payment shows source, status, amount and currency, and no manual fields", () => {
    expect(rows(base).map((r) => r.label)).toEqual(["Source", "Status", "Amount", "Currency"]);
  });

  it("a manual payment shows method, paid-at, confirmed-at and confirmed-by in the event's timezone", () => {
    const manual: OperatorPaymentView = {
      ...base,
      source: "manual",
      provider_status: null,
      amount: null,
      currency: null,
      manual_method: "cash",
      manual_amount: 99900,
      manual_currency: "PHP",
      paid_at: "2026-10-01T16:30:00.000Z",
      confirmed_at: "2026-10-01T17:00:00.000Z",
      confirmed_by: "op-1",
      confirmedByEmail: "op@example.test",
      reference_note: "ref 1",
    };
    expect(Object.fromEntries(rows(manual).map((r) => [r.label, r.value]))).toEqual({
      Source: "Manual",
      Method: "Cash",
      Status: "Confirmed",
      Amount: "₱999",
      Currency: "PHP",
      "Paid at": "Fri, Oct 2, 2026 · 12:30 AM",
      "Confirmed at": "Fri, Oct 2, 2026 · 1:00 AM",
      "Confirmed by": "op@example.test",
      Note: "ref 1",
    });
  });

  it("a refund adds refunded-at, refunded-by and the refund note", () => {
    const refunded = rows({
      ...base,
      refunded_at: "2026-10-03T02:00:00.000Z",
      refunded_by: "op-2",
      refundedByEmail: "op2@example.test",
      refund_note: "returned",
    });
    expect(refunded).toEqual(
      expect.arrayContaining([
        { label: "Status", value: "Refunded", danger: false },
        { label: "Refunded at", value: "Sat, Oct 3, 2026 · 10:00 AM" },
        { label: "Refunded by", value: "op2@example.test" },
        { label: "Refund note", value: "returned" },
      ]),
    );
  });

  it("an unrefunded duplicate is flagged", () => {
    expect(rows(base, true).find((r) => r.label === "Status")).toEqual({
      label: "Status",
      value: "Duplicate — needs manual refund",
      danger: true,
    });
  });
});
