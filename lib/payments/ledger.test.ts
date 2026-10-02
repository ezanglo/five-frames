import { describe, expect, it } from "vitest";
import {
  filterLedgerByMonth,
  formatPeso,
  isLedgerMonth,
  ledgerCsv,
  ledgerLines,
  ledgerMonth,
  ledgerMonths,
  ledgerTotals,
  type LedgerPayment,
} from "./ledger";

function payment(overrides: Partial<LedgerPayment>): LedgerPayment {
  return {
    id: "pay-1",
    event_id: "event-1",
    source: "manual",
    provider_checkout_session_id: null,
    checkout_url: null,
    provider_status: null,
    amount: null,
    currency: null,
    fee_amount: null,
    provider_webhook_event_id: null,
    manual_method: "cash",
    manual_amount: 99900,
    manual_currency: "PHP",
    paid_at: "2026-10-02T03:00:00.000Z",
    confirmed_at: "2026-10-02T04:00:00.000Z",
    confirmed_by: "op-1",
    reference_note: null,
    refunded_at: null,
    refunded_by: null,
    refund_note: null,
    created_at: "2026-10-02T04:00:00.000Z",
    updated_at: "2026-10-02T04:00:00.000Z",
    confirmedByEmail: "op@example.com",
    refundedByEmail: null,
    eventName: "Ana & Ben",
    hostEmail: "host@example.com",
    duplicate: false,
    ...overrides,
  };
}

describe("payment ledger", () => {
  it("dates a payment by when the money arrived, in Manila, across a month boundary", () => {
    // 17:30 UTC on 30 Sep is 01:30 on 1 Oct in Manila (UTC+8): an October receipt.
    const [line] = ledgerLines([payment({ paid_at: "2026-09-30T17:30:00.000Z" })]);
    expect(ledgerMonth(line.at)).toBe("2026-10");
    expect(ledgerMonth("2026-09-30T15:59:00.000Z")).toBe("2026-09");
  });

  it("a refund is its own negative line, in the month it happened", () => {
    const refunded = payment({
      refunded_at: "2026-11-05T02:00:00.000Z",
      refunded_by: "op-2",
      refundedByEmail: "op2@example.com",
    });
    const lines = ledgerLines([refunded]);
    expect(lines.map((l) => [l.kind, l.amount])).toEqual([
      ["refund", -99900],
      ["payment", 99900],
    ]);
    expect(ledgerMonths(lines)).toEqual(["2026-11", "2026-10"]);

    expect(ledgerTotals(filterLedgerByMonth(lines, "2026-10"))).toEqual({
      received: 99900,
      refunded: 0,
      net: 99900,
      paymentCount: 1,
      refundCount: 0,
    });
    expect(ledgerTotals(filterLedgerByMonth(lines, "2026-11")).net).toBe(-99900);
    expect(ledgerTotals(lines).net).toBe(0);
  });

  it("reads a provider payment's amount and currency from the provider fields", () => {
    const [line] = ledgerLines([
      payment({
        source: "provider",
        provider_status: "paid",
        manual_method: null,
        manual_amount: null,
        manual_currency: null,
        amount: 149000,
        currency: "PHP",
        paid_at: null,
        confirmed_at: null,
        created_at: "2026-10-01T00:00:00.000Z",
      }),
    ]);
    expect(line.amount).toBe(149000);
    expect(line.at).toBe("2026-10-01T00:00:00.000Z");
  });

  it("accepts only real YYYY-MM months", () => {
    expect(isLedgerMonth("2026-10")).toBe(true);
    expect(isLedgerMonth("2026-13")).toBe(false);
    expect(isLedgerMonth("2026-1")).toBe(false);
    expect(isLedgerMonth(undefined)).toBe(false);
  });

  it("formats pesos with centavos only when there are some", () => {
    expect(formatPeso(99900)).toBe("₱999");
    expect(formatPeso(149050)).toBe("₱1,490.50");
    expect(formatPeso(-99900)).toBe("−₱999");
  });

  it("exports CSV that a spreadsheet cannot run as a formula", () => {
    const csv = ledgerCsv(
      ledgerLines([
        payment({
          eventName: '=HYPERLINK("http://evil")',
          reference_note: "GCash ref 123, paid by Ana",
        }),
      ]),
    );
    const [header, row] = csv.replace("﻿", "").split("\r\n");
    expect(header.startsWith("Date (Asia/Manila),Type,Amount")).toBe(true);
    expect(row).toContain(`"'=HYPERLINK(""http://evil"")"`);
    expect(row).toContain('"GCash ref 123, paid by Ana"');
    expect(row).toMatch(/^2026-10-02 11:00,Payment,999\.00,PHP,Cash,/);
  });

  it("flags an unrefunded duplicate in the export", () => {
    const csv = ledgerCsv(ledgerLines([payment({ duplicate: true })]));
    expect(csv).toContain("Duplicate — needs refund");
  });
});
