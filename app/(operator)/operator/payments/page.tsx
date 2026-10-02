import Link from "next/link";
import { Download, ReceiptText } from "lucide-react";
import { listPaymentLedgerForOperator } from "@/lib/dal/payment-ledger";
import {
  filterLedgerByMonth,
  formatPeso,
  isLedgerMonth,
  LEDGER_TIMEZONE,
  ledgerDateTime,
  ledgerLines,
  ledgerMonths,
  ledgerSourceLabel,
  ledgerTotals,
} from "@/lib/payments/ledger";
import { ButtonAnchor } from "@/components/ff/button";
import { Card, StatTile } from "@/components/ff/cards";
import { FilterChip } from "@/components/ff/filter-chip";
import { cn } from "@/lib/utils";

export const metadata = { title: "Payments · FiveFrames Operator" };

/**
 * Payment ledger (product.md §5.1.1, decision D23): every payment that took money and every
 * refund, across all events, newest first, with the month's totals and a CSV export for the
 * books. Read-only; confirming and refunding stay on each event's page. The layout has already
 * run `requireOperator()`, and the export route runs it again for itself.
 */
export default async function OperatorPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month: monthParam } = await searchParams;
  const month = isLedgerMonth(monthParam) ? monthParam : null;

  const allLines = ledgerLines(await listPaymentLedgerForOperator());
  const months = ledgerMonths(allLines);
  const lines = filterLedgerByMonth(allLines, month);
  const totals = ledgerTotals(lines);
  const exportHref = `/operator/payments/export${month ? `?month=${month}` : ""}`;

  return (
    <div className="flex flex-col gap-5 lg:gap-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-display font-semibold text-ink lg:text-page-desktop">
            Payments
          </h1>
          <p className="text-caption font-medium text-ink-muted">
            Money received and refunded, across all events. Times in {LEDGER_TIMEZONE.replace("_", " ")}.
          </p>
        </div>
        <ButtonAnchor href={exportHref} variant="secondary" size="sm" download>
          <Download aria-hidden />
          Download CSV
        </ButtonAnchor>
      </div>

      <nav aria-label="Month" className="-mx-5 flex gap-2 overflow-x-auto px-5 lg:mx-0 lg:flex-wrap lg:px-0">
        <FilterChip href="/operator/payments" active={!month}>
          All time
        </FilterChip>
        {months.map((m) => (
          <FilterChip key={m} href={`/operator/payments?month=${m}`} active={m === month}>
            {monthLabel(m)}
          </FilterChip>
        ))}
      </nav>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatTile
          tone="white"
          label="Received"
          value={<span className="tabular">{formatPeso(totals.received)}</span>}
          caption={`${totals.paymentCount} payment${totals.paymentCount === 1 ? "" : "s"}`}
        />
        <StatTile
          tone="white"
          label="Refunded"
          value={<span className="tabular">{formatPeso(totals.refunded)}</span>}
          caption={`${totals.refundCount} refund${totals.refundCount === 1 ? "" : "s"}`}
        />
        <StatTile
          tone="white"
          label="Net"
          value={<span className="tabular">{formatPeso(totals.net)}</span>}
          caption={month ? monthLabel(month) : "All time"}
        />
      </div>

      {lines.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 px-6 py-14 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-brand-tint text-brand">
            <ReceiptText aria-hidden className="size-5" />
          </span>
          <p className="text-[16px] leading-snug font-bold text-ink">No payments yet</p>
          <p className="max-w-xs text-caption font-medium text-ink-muted">
            {month
              ? `Nothing was received or refunded in ${monthLabel(month)}.`
              : "Confirmed payments and refunds appear here."}
          </p>
        </Card>
      ) : (
        <Card as="section" className="overflow-hidden">
          <ul className="divide-y divide-line">
            {lines.map((line) => {
              const p = line.payment;
              const refund = line.kind === "refund";
              const flag = refund
                ? "Refund"
                : p.duplicate
                  ? "Duplicate — needs refund"
                  : p.refunded_at
                    ? "Refunded later"
                    : null;
              return (
                <li key={line.key}>
                  <Link
                    href={`/operator/events/${p.event_id}`}
                    className="ff-focus flex items-start gap-4 px-4 py-3.5 transition-colors hover:bg-surface-subtle lg:px-6 lg:py-4"
                  >
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="truncate text-label font-bold text-ink">{p.eventName}</span>
                      <span className="truncate text-caption font-medium text-ink-muted">
                        {[ledgerDateTime(line.at), ledgerSourceLabel(p), p.hostEmail].join(" · ")}
                      </span>
                      {(refund ? p.refund_note : p.reference_note) && (
                        <span className="truncate text-caption font-medium text-ink-muted">
                          {refund ? p.refund_note : p.reference_note}
                        </span>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span
                        className={cn(
                          "tabular text-label font-bold",
                          refund ? "text-danger" : "text-ink",
                        )}
                      >
                        {formatPeso(line.amount)}
                      </span>
                      {flag && (
                        <span
                          className={cn(
                            "text-micro font-semibold",
                            p.duplicate && !refund ? "text-danger" : "text-ink-muted",
                          )}
                        >
                          {flag}
                        </span>
                      )}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}

/** "Oct 2026" for "2026-10". */
function monthLabel(month: string): string {
  const [year, m] = month.split("-").map(Number);
  return new Date(Date.UTC(year, m - 1, 1)).toLocaleDateString("en-PH", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}
