import type { NextRequest } from "next/server";
import { requireOperator } from "@/lib/auth/operator-session";
import { listPaymentLedgerForOperator } from "@/lib/dal/payment-ledger";
import { filterLedgerByMonth, isLedgerMonth, ledgerCsv, ledgerLines } from "@/lib/payments/ledger";

/**
 * The payment ledger as CSV (product.md §5.1.1, decision D23), all time or one `?month=YYYY-MM`.
 * A route handler is outside the operator layout, so it runs `requireOperator()` itself. Never
 * cached: it's a live read of who paid what.
 */
export async function GET(request: NextRequest) {
  await requireOperator();

  const monthParam = request.nextUrl.searchParams.get("month") ?? undefined;
  const month = isLedgerMonth(monthParam) ? monthParam : null;
  const lines = filterLedgerByMonth(ledgerLines(await listPaymentLedgerForOperator()), month);

  return new Response(ledgerCsv(lines), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="fiveframes-payments-${month ?? "all"}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
