import "server-only";

import { createServiceClient } from "@/lib/supabase/service-client";
import { getEventForOperatorMutation } from "@/lib/dal/operator-events";
import type { CapacityOverrideRow } from "@/lib/db/types";

/**
 * Operator capacity override (product.md §9.5, decision D24, architecture §6a). Operator-only,
 * like lib/dal/operator-events.ts: nothing here has a host-ownership predicate, so no host page
 * imports this module. The host sees only the new capacity, on their dashboard.
 */

/** A typo guard ("3000" for "300"), not a product limit. The SQL function refuses above it too. */
export const MAX_GUEST_SESSION_CAP = 5000;
export const MAX_OVERRIDE_REASON_LENGTH = 500;

export type OverrideGuestCapacityInput = { newCap: number; reason: string };

export type OverrideRefusal =
  | "not_found"
  | "owns_event"
  | "not_activated"
  | "not_a_raise"
  | "reason_required"
  | "reason_too_long"
  | "cap_too_large"
  | "not_operator";

export type OverrideGuestCapacityResult =
  | { outcome: OverrideRefusal; currentCap?: number }
  | { outcome: "raised"; entry: CapacityOverrideRow };

const SQL_REFUSALS: readonly OverrideRefusal[] = [
  "owns_event",
  "not_activated",
  "not_a_raise",
  "reason_required",
  "reason_too_long",
  "cap_too_large",
  "not_operator",
];

/**
 * Raises an event's guest-session cap and writes its log entry in one transaction
 * (`override_guest_capacity()`). The caller must already be a verified operator
 * (`requireOperator()` in the server action), the same split as `confirmManualPayment`.
 *
 * The checks here run first so the Console gets a clean answer. They read a row that can be
 * stale by the time the RPC runs, so the SQL function repeats every one of them under the row
 * lock. That second layer is what holds under a race: an override that's no longer a raise
 * because another one landed first is refused there, never applied.
 */
export async function overrideGuestCapacity(
  operatorId: string,
  eventId: string,
  input: OverrideGuestCapacityInput,
): Promise<OverrideGuestCapacityResult> {
  const reason = input.reason.trim();
  if (!reason) return { outcome: "reason_required" };
  if (reason.length > MAX_OVERRIDE_REASON_LENGTH) return { outcome: "reason_too_long" };
  if (!Number.isInteger(input.newCap) || input.newCap > MAX_GUEST_SESSION_CAP) {
    return { outcome: "cap_too_large" };
  }

  const event = await getEventForOperatorMutation(eventId);
  if (!event) return { outcome: "not_found" };
  if (event.host_id === operatorId) return { outcome: "owns_event" };
  if (!event.activated_at) return { outcome: "not_activated" };
  if (input.newCap <= event.guest_session_cap) {
    return { outcome: "not_a_raise", currentCap: event.guest_session_cap };
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .rpc("override_guest_capacity", {
      p_event_id: eventId,
      p_operator_id: operatorId,
      p_new_cap: input.newCap,
      p_reason: reason,
    })
    .maybeSingle();

  if (error) {
    const refusal = SQL_REFUSALS.find((key) => key === error.message);
    if (error.code === "P0006" && refusal) {
      if (refusal === "not_a_raise") {
        const latest = await getEventForOperatorMutation(eventId);
        return { outcome: refusal, currentCap: latest?.guest_session_cap };
      }
      return { outcome: refusal };
    }
    throw error;
  }
  if (!data) return { outcome: "not_found" };

  return { outcome: "raised", entry: data as CapacityOverrideRow };
}

export type CapacityOverrideView = CapacityOverrideRow & { operatorEmail: string | null };

/** The event's overrides, newest first, each with the operator's email (product.md §5.1). */
export async function listCapacityOverridesForOperator(
  eventId: string,
): Promise<CapacityOverrideView[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("capacity_overrides")
    .select()
    .eq("event_id", eventId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as CapacityOverrideRow[];

  const operatorIds = [...new Set(rows.map((row) => row.operator_id))];
  const emailById = new Map<string, string>();
  if (operatorIds.length > 0) {
    // Every auth user has a hosts row carrying their email, operators included.
    const { data: actors, error: actorsError } = await supabase
      .from("hosts")
      .select("id, email")
      .in("id", operatorIds);
    if (actorsError) throw actorsError;
    for (const actor of actors as { id: string; email: string }[]) {
      emailById.set(actor.id, actor.email);
    }
  }

  return rows.map((row) => ({ ...row, operatorEmail: emailById.get(row.operator_id) ?? null }));
}
