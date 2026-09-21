import "server-only";

import { createServiceClient } from "@/lib/supabase/service-client";
import type { EventRow } from "@/lib/db/types";

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
    ...(event as EventRow),
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
};

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

  return {
    event: event as EventRow,
    hostEmail: hosts?.email ?? "unknown",
    captureCounts: {
      pending: pending.count ?? 0,
      committed: committed.count ?? 0,
      hidden: hidden.count ?? 0,
      favorited: favorited.count ?? 0,
      deleted: deleted.count ?? 0,
    },
  };
}
