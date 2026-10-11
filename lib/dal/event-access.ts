import "server-only";

import { createServiceClient } from "@/lib/supabase/service-client";
import { isOperator } from "@/lib/dal/operators";
import type { EventRow } from "@/lib/db/types";

/**
 * The one event-access check for host pages (decision D27, architecture §5b). It returns the
 * caller's role on the event, and each host DAL function names the roles it admits:
 *
 *   owner   — events.host_id = userId. Wins on an operator's own event, where support access
 *             doesn't apply (product.md §5.1.3).
 *   support — a fresh `operators` read for userId (the same read as requireOperator), any event.
 *   null    — anything else. Callers treat it as not found.
 *
 * Owner-only functions (plan, checkout, refund request, event or photo deletion, favorite,
 * original and ZIP downloads, co-hosts) don't call this. They keep their `host_id` predicate,
 * which is what keeps support away from them. Never add an "or operator" predicate anywhere.
 */

export type EventRole = "owner" | "support";

export type EventAccess = { event: EventRow; role: EventRole };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getEventAccess(userId: string, eventId: string): Promise<EventAccess | null> {
  if (!UUID.test(eventId) || !UUID.test(userId)) return null;
  const supabase = createServiceClient();

  const { data: owned, error } = await supabase
    .from("events")
    .select()
    .eq("id", eventId)
    .eq("host_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (owned) return { event: owned as EventRow, role: "owner" };

  if (!(await isOperator(userId))) return null;

  const { data: event, error: eventError } = await supabase
    .from("events")
    .select()
    .eq("id", eventId)
    .maybeSingle();
  if (eventError) throw eventError;
  return event ? { event: event as EventRow, role: "support" } : null;
}

/** `getEventAccess`, narrowed to the roles a function admits. Any other role is not found. */
export async function getEventAccessFor(
  userId: string,
  eventId: string,
  roles: readonly EventRole[],
): Promise<EventAccess | null> {
  const access = await getEventAccess(userId, eventId);
  return access && roles.includes(access.role) ? access : null;
}
