import { utcIsoToZonedDateTimeLocal } from "@/lib/events/timezone";
import { MANUAL_PAYMENT_METHOD_LABEL } from "@/lib/events/labels";
import type { OperatorPaymentView } from "@/lib/payments/audit";

/**
 * The Operator Console payment ledger (product.md §5.1.1, decision D23): every movement of money
 * FiveFrames recorded, across all events. A read-only view over the `payments` rows, which stay
 * the audit record themselves (D17). No new table, and nothing here writes.
 *
 * Each payment that actually took money (a confirmed manual payment, or a provider payment
 * PayMongo reported paid) is one `payment` line; a refund of it is a separate, negative `refund`
 * line dated when the refund happened. So a month's totals show money in and out in the month it
 * moved, the way a bank statement would.
 */

/** Ledger dates and months are in the market's timezone (product.md §3), not per event. */
export const LEDGER_TIMEZONE = "Asia/Manila";

export type LedgerPayment = OperatorPaymentView & {
  eventName: string;
  hostEmail: string;
  /** Took money but isn't the payment that activated its event (`isDuplicatePayment`). */
  duplicate: boolean;
};

export type LedgerLine = {
  key: string;
  kind: "payment" | "refund";
  at: string;
  /** Centavos; negative for a refund. */
  amount: number;
  currency: string;
  payment: LedgerPayment;
};

export type LedgerTotals = {
  received: number;
  refunded: number;
  net: number;
  paymentCount: number;
  refundCount: number;
};

function amountOf(payment: LedgerPayment): number {
  return payment.amount ?? payment.manual_amount ?? 0;
}

/**
 * When the money arrived. Manual: the operator-entered "payment received at". Provider: PayMongo
 * rows carry no paid time of their own, so the confirmation or creation time stands in.
 */
function receivedAt(payment: LedgerPayment): string {
  return payment.paid_at ?? payment.confirmed_at ?? payment.created_at;
}

export function ledgerLines(payments: LedgerPayment[]): LedgerLine[] {
  const lines: LedgerLine[] = [];
  for (const payment of payments) {
    const currency = payment.currency ?? payment.manual_currency ?? "PHP";
    lines.push({
      key: `${payment.id}:payment`,
      kind: "payment",
      at: receivedAt(payment),
      amount: amountOf(payment),
      currency,
      payment,
    });
    if (payment.refunded_at) {
      lines.push({
        key: `${payment.id}:refund`,
        kind: "refund",
        at: payment.refunded_at,
        amount: -amountOf(payment),
        currency,
        payment,
      });
    }
  }
  return lines.sort((a, b) => b.at.localeCompare(a.at));
}

/** "2026-10" for an instant, in the ledger timezone. */
export function ledgerMonth(iso: string): string {
  return utcIsoToZonedDateTimeLocal(iso, LEDGER_TIMEZONE).slice(0, 7);
}

/** Months that have at least one line, newest first. */
export function ledgerMonths(lines: LedgerLine[]): string[] {
  return [...new Set(lines.map((line) => ledgerMonth(line.at)))].sort().reverse();
}

export function isLedgerMonth(value: string | undefined): value is string {
  return !!value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

export function filterLedgerByMonth(lines: LedgerLine[], month: string | null): LedgerLine[] {
  return month ? lines.filter((line) => ledgerMonth(line.at) === month) : lines;
}

export function ledgerTotals(lines: LedgerLine[]): LedgerTotals {
  const totals: LedgerTotals = { received: 0, refunded: 0, net: 0, paymentCount: 0, refundCount: 0 };
  for (const line of lines) {
    if (line.kind === "payment") {
      totals.received += line.amount;
      totals.paymentCount += 1;
    } else {
      totals.refunded -= line.amount;
      totals.refundCount += 1;
    }
  }
  totals.net = totals.received - totals.refunded;
  return totals;
}

/** "₱999" / "−₱999", whole pesos unless there are centavos. */
export function formatPeso(centavos: number): string {
  const sign = centavos < 0 ? "−" : "";
  const pesos = Math.abs(centavos) / 100;
  return `${sign}₱${pesos.toLocaleString("en-PH", {
    minimumFractionDigits: Number.isInteger(pesos) ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

export function ledgerSourceLabel(payment: LedgerPayment): string {
  if (payment.source === "provider") return "PayMongo";
  return payment.manual_method ? MANUAL_PAYMENT_METHOD_LABEL[payment.manual_method] : "Manual";
}

/** "2026-10-02 14:05", ledger timezone. */
export function ledgerDateTime(iso: string): string {
  return utcIsoToZonedDateTimeLocal(iso, LEDGER_TIMEZONE).replace("T", " ");
}

const CSV_HEADER = [
  `Date (${LEDGER_TIMEZONE})`,
  "Type",
  "Amount",
  "Currency",
  "Source",
  "Event",
  "Host email",
  "Reference / note",
  "Confirmed at",
  "Confirmed by",
  "Refunded by",
  "Refund note",
  "Flag",
  "Event id",
  "Payment id",
];

/**
 * A text cell. Event names and notes are typed by hosts and operators, so a leading `=`, `+`,
 * `-`, `@`, tab or CR is neutralised: spreadsheets would otherwise run it as a formula.
 */
function textCell(value: string | null | undefined): string {
  let text = value ?? "";
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function ledgerCsv(lines: LedgerLine[]): string {
  const rows = lines.map((line) => {
    const p = line.payment;
    return [
      textCell(ledgerDateTime(line.at)),
      textCell(line.kind === "payment" ? "Payment" : "Refund"),
      (line.amount / 100).toFixed(2),
      textCell(line.currency),
      textCell(ledgerSourceLabel(p)),
      textCell(p.eventName),
      textCell(p.hostEmail),
      textCell(p.reference_note),
      textCell(p.confirmed_at ? ledgerDateTime(p.confirmed_at) : ""),
      textCell(p.confirmedByEmail),
      textCell(line.kind === "refund" ? p.refundedByEmail : ""),
      textCell(line.kind === "refund" ? p.refund_note : ""),
      textCell(line.kind === "payment" && p.duplicate && !p.refunded_at ? "Duplicate — needs refund" : ""),
      textCell(p.event_id),
      textCell(p.id),
    ].join(",");
  });
  // CRLF per RFC 4180; the BOM makes Excel read the peso sign and em dashes as UTF-8.
  return `﻿${[CSV_HEADER.join(","), ...rows].join("\r\n")}\r\n`;
}
