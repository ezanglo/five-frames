import type { PaymentRow } from "@/lib/db/types";
import { MANUAL_PAYMENT_METHOD_LABEL } from "@/lib/events/labels";
import { formatEventDateTime } from "@/lib/events/format";

/**
 * A payment row as the Operator Console shows it: the stored row plus the email of the operator
 * who confirmed or refunded it (`confirmed_by`/`refunded_by` hold user ids). Payment metadata
 * only; nothing here touches guest media.
 */
export type OperatorPaymentView = PaymentRow & {
  confirmedByEmail: string | null;
  refundedByEmail: string | null;
};

export type PaymentAuditRow = { label: string; value: string; danger?: boolean };

const PROVIDER_STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  paid: "Paid",
  paid_duplicate: "Paid (duplicate)",
  superseded: "Superseded",
};

function humanize(value: string): string {
  const spaced = value.replaceAll("_", " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/**
 * The audit record for one payment (OPS-03, architecture §5a: privileged operator mutations are
 * auditable): source, method, amount, currency, when it was paid and confirmed and by whom, the
 * note, and the refund's time, operator and note. Times are in the event's timezone, like every
 * other Console time. A row appears only when it applies to that payment.
 */
export function paymentAuditRows(
  payment: OperatorPaymentView,
  options: { duplicate: boolean; timezone: string },
): PaymentAuditRow[] {
  const when = (iso: string) => formatEventDateTime(iso, options.timezone, { year: true }) ?? "—";
  const isManual = payment.source === "manual";
  const amount = payment.amount ?? payment.manual_amount;
  const currency = payment.currency ?? payment.manual_currency;
  const status = payment.refunded_at
    ? "Refunded"
    : options.duplicate
      ? "Duplicate — needs manual refund"
      : !isManual
        ? payment.provider_status
          ? (PROVIDER_STATUS_LABEL[payment.provider_status] ?? humanize(payment.provider_status))
          : "—"
        : payment.confirmed_at
          ? "Confirmed"
          : "—";

  const rows: PaymentAuditRow[] = [
    { label: "Source", value: isManual ? "Manual" : "PayMongo (self-service)" },
  ];
  if (isManual) {
    rows.push({
      label: "Method",
      value: payment.manual_method ? MANUAL_PAYMENT_METHOD_LABEL[payment.manual_method] : "—",
    });
  }
  rows.push({
    label: "Status",
    value: status,
    danger: options.duplicate && !payment.refunded_at,
  });
  rows.push({
    label: "Amount",
    value: amount != null ? `₱${(amount / 100).toLocaleString("en-PH")}` : "—",
  });
  rows.push({ label: "Currency", value: currency ?? "—" });
  if (payment.paid_at) rows.push({ label: "Paid at", value: when(payment.paid_at) });
  if (payment.confirmed_at) {
    rows.push({ label: "Confirmed at", value: when(payment.confirmed_at) });
    rows.push({ label: "Confirmed by", value: payment.confirmedByEmail ?? "Unknown operator" });
  }
  if (payment.reference_note) rows.push({ label: "Note", value: payment.reference_note });
  if (payment.refunded_at) {
    rows.push({ label: "Refunded at", value: when(payment.refunded_at) });
    rows.push({ label: "Refunded by", value: payment.refundedByEmail ?? "Unknown operator" });
    if (payment.refund_note) rows.push({ label: "Refund note", value: payment.refund_note });
  }
  return rows;
}
