import "server-only";

import { createServiceClient } from "@/lib/supabase/service-client";
import { isDuplicatePayment } from "@/lib/dal/payments";
import { withOperatorEmails } from "@/lib/dal/operator-events";
import type { PaymentRow } from "@/lib/db/types";
import type { LedgerPayment } from "@/lib/payments/ledger";

const PAGE_SIZE = 1000;

type LedgerRow = PaymentRow & {
  events: {
    name: string;
    activating_payment_id: string | null;
    hosts: { email: string } | null;
  } | null;
};

/**
 * Every payment that took money, across all events, for the Operator Console ledger (product.md
 * §5.1.1, decision D23). Like the rest of the Console's reads it has no host-ownership predicate,
 * and callers must have run `requireOperator()`. Payment metadata only: no guest media.
 *
 * "Took money" is a confirmed manual payment or a provider payment PayMongo reported paid.
 * Pending, superseded and abandoned checkout attempts never moved money, so they stay out.
 * Read in pages, so the ledger is never silently cut off at the API's row limit.
 */
export async function listPaymentLedgerForOperator(): Promise<LedgerPayment[]> {
  const supabase = createServiceClient();
  const rows: LedgerRow[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("payments")
      // Two foreign keys join these tables (payments.event_id, events.activating_payment_id);
      // the ledger wants the event each payment is for.
      .select("*, events!payments_event_id_fkey(name, activating_payment_id, hosts(email))")
      .or("confirmed_at.not.is.null,provider_status.in.(paid,paid_duplicate)")
      .order("created_at", { ascending: false })
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...((data ?? []) as unknown as LedgerRow[]));
    if (!data || data.length < PAGE_SIZE) break;
  }

  return (await withOperatorEmails(rows)).map(({ events: event, ...payment }) => ({
    ...payment,
    eventName: event?.name ?? "Deleted event",
    hostEmail: event?.hosts?.email ?? "unknown",
    duplicate: isDuplicatePayment(payment, {
      activating_payment_id: event?.activating_payment_id ?? null,
    }),
  }));
}
