import "server-only";

import { createServiceClient } from "@/lib/supabase/service-client";
import type { EventRow, PaymentRow } from "@/lib/db/types";
import type { OperatorPaymentView } from "@/lib/payments/audit";

/**
 * Operator Console reads (architecture §8b, product.md §5.1). Deliberately a separate
 * module from lib/dal/events.ts: every function here has no host-ownership predicate —
 * operator visibility is explicitly cross-host — so that case is never accidentally
 * reachable from a host-facing code path, and vice versa.
 *
 * Aggregate counts only, never guest media: no function in this module selects a
 * capture's storage_path/display_path/thumbnail_path or mints a signed URL. That
 * capability simply does not exist on this code path, matching §8b's design boundary.
 */

export type OperatorEventListItem = EventRow & { hostEmail: string };

/**
 * The Operator Console never receives theme media (product.md §10.1, architecture §7a): not a
 * signed URL, and not even the private object path. Every event this module returns passes
 * through here, so no operator route can hand the path to a signing function.
 */
function withoutThemeMedia<T extends EventRow>(event: T): T {
  return { ...event, theme_image_path: null };
}

export async function listEventsForOperator(
  query?: string,
): Promise<OperatorEventListItem[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("events")
    .select("*, hosts(email)")
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) throw error;

  const rows = (data ?? []) as unknown as (EventRow & {
    hosts: { email: string } | null;
  })[];

  const items: OperatorEventListItem[] = rows.map(({ hosts, ...event }) => ({
    ...withoutThemeMedia(event as EventRow),
    hostEmail: hosts?.email ?? "unknown",
  }));

  const needle = query?.trim().toLowerCase();
  if (!needle) return items;

  return items.filter(
    (item) =>
      item.name.toLowerCase().includes(needle) ||
      item.hostEmail.toLowerCase().includes(needle) ||
      item.id.toLowerCase().includes(needle),
  );
}

export type OperatorCaptureCounts = {
  pending: number;
  committed: number;
  hidden: number;
  favorited: number;
  deleted: number;
};

export type OperatorEventDetail = {
  event: EventRow;
  hostEmail: string;
  captureCounts: OperatorCaptureCounts;
  /** Every payment row for this event, most recent first — not just the latest one, so a
   *  `paid_duplicate` payment (product.md §15.1 manual-refund follow-up) stays visible
   *  even when it isn't the most recently created row. */
  payments: OperatorPaymentView[];
};

/**
 * Lightweight event lookup for an operator-authorized mutation (confirm manual payment,
 * record a manual refund — architecture §8a). No host-ownership predicate, same as every
 * other function in this module; the caller (lib/dal/payments.ts) reads the returned
 * `host_id` only to run the ownership-conflict check, never to grant host access.
 */
export async function getEventForOperatorMutation(
  eventId: string,
): Promise<EventRow | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("events")
    .select()
    .eq("id", eventId)
    .maybeSingle();

  if (error) throw error;
  return data ? withoutThemeMedia(data as EventRow) : null;
}

export async function getOperatorEventDetail(
  eventId: string,
): Promise<OperatorEventDetail | null> {
  const supabase = createServiceClient();

  const { data: eventRow, error: eventError } = await supabase
    .from("events")
    .select("*, hosts(email)")
    .eq("id", eventId)
    .maybeSingle();

  if (eventError) throw eventError;
  if (!eventRow) return null;

  const { hosts, ...event } = eventRow as unknown as EventRow & {
    hosts: { email: string } | null;
  };

  const [pending, committed, hidden, favorited, deleted] = await Promise.all([
    supabase
      .from("captures")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId)
      .eq("status", "pending"),
    supabase
      .from("captures")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId)
      .eq("status", "committed")
      .is("hidden_at", null)
      .is("deleted_at", null),
    supabase
      .from("captures")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId)
      .not("hidden_at", "is", null)
      .is("deleted_at", null),
    supabase
      .from("captures")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId)
      .not("favorited_at", "is", null)
      .is("deleted_at", null),
    supabase
      .from("captures")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId)
      .not("deleted_at", "is", null),
  ]);

  for (const result of [pending, committed, hidden, favorited, deleted]) {
    if (result.error) throw result.error;
  }

  const { data: payments, error: paymentsError } = await supabase
    .from("payments")
    .select()
    .eq("event_id", eventId)
    .order("created_at", { ascending: false });

  if (paymentsError) throw paymentsError;
  const paymentRows = (payments ?? []) as PaymentRow[];

  return {
    event: withoutThemeMedia(event as EventRow),
    hostEmail: hosts?.email ?? "unknown",
    captureCounts: {
      pending: pending.count ?? 0,
      committed: committed.count ?? 0,
      hidden: hidden.count ?? 0,
      favorited: favorited.count ?? 0,
      deleted: deleted.count ?? 0,
    },
    payments: await withOperatorEmails(paymentRows),
  };
}

/**
 * confirmed_by / refunded_by are operator user ids. Resolves them to the account email for the
 * audit record (OPS-03); every auth user has a hosts row carrying it.
 */
export async function withOperatorEmails<T extends PaymentRow>(
  payments: T[],
): Promise<(T & { confirmedByEmail: string | null; refundedByEmail: string | null })[]> {
  const actorIds = [
    ...new Set(
      payments.flatMap((p) => [p.confirmed_by, p.refunded_by]).filter((id): id is string => !!id),
    ),
  ];
  const actorEmail = new Map<string, string>();
  if (actorIds.length > 0) {
    const { data: actors, error } = await createServiceClient()
      .from("hosts")
      .select("id, email")
      .in("id", actorIds);
    if (error) throw error;
    for (const actor of actors as { id: string; email: string }[]) {
      actorEmail.set(actor.id, actor.email);
    }
  }

  return payments.map((p) => ({
    ...p,
    confirmedByEmail: p.confirmed_by ? (actorEmail.get(p.confirmed_by) ?? null) : null,
    refundedByEmail: p.refunded_by ? (actorEmail.get(p.refunded_by) ?? null) : null,
  }));
}
