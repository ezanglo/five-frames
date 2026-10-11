import "server-only";

import { createServiceClient } from "@/lib/supabase/service-client";
import { getEventAccessFor } from "@/lib/dal/event-access";
import type { EventRow, SupportActionKey, SupportActionRow } from "@/lib/db/types";

/**
 * Support-access writes and the support log (decision D27, architecture §5b). Every write is one
 * SQL function that re-checks the operator grant, refuses the operator's own event, applies the
 * change and inserts its log entry in a single transaction, like `override_guest_capacity`.
 * Never "update, then log" as two calls: a failed second call would leave an unlogged change.
 *
 * Callers resolve the role first (`getEventAccess`), so the `support` branch of a host DAL
 * function is the only caller of the writes below.
 */

/** Actions that change the event row. Each admits a closed set of columns in SQL. */
export type SupportEventAction = Extract<
  SupportActionKey,
  | "settings_changed"
  | "gallery_revealed"
  | "capture_opened"
  | "capture_closed"
  | "capture_link_rotated"
  | "capture_link_turned_off"
  | "gallery_link_rotated"
  | "gallery_link_turned_off"
  | "theme_image_changed"
  | "theme_image_removed"
>;

export async function supportUpdateEvent(
  operatorId: string,
  eventId: string,
  action: SupportEventAction,
  patch: Record<string, unknown>,
): Promise<EventRow | null> {
  const { data, error } = await createServiceClient()
    .rpc("support_update_event", {
      p_operator_id: operatorId,
      p_event_id: eventId,
      p_action: action,
      p_patch: patch,
    })
    .maybeSingle<EventRow>();
  if (error) throw error;
  return data;
}

/** Hide or unhide only. Delete and favorite have no support path. */
export async function supportSetCaptureHidden(
  operatorId: string,
  eventId: string,
  captureId: string,
  hidden: boolean,
): Promise<boolean> {
  const { data, error } = await createServiceClient().rpc("support_set_capture_hidden", {
    p_operator_id: operatorId,
    p_event_id: eventId,
    p_capture_id: captureId,
    p_hidden: hidden,
  });
  if (error) throw error;
  return data === true;
}

/**
 * The entries that change nothing: viewing photos (the SQL keeps one per operator, event and
 * 30 minutes, so live refreshes don't flood the log), downloading signage, downloading originals
 * (one each, or one per ZIP part, D30) and making a guest's Full Set keepsake (one per operator,
 * event and guest session per 30 minutes). Called before anything is signed or rendered, so a
 * failed write serves nothing.
 */
export async function logSupportAccess(
  operatorId: string,
  eventId: string,
  action: Extract<
    SupportActionKey,
    "photos_viewed" | "signage_downloaded" | "original_downloaded" | "originals_zip_downloaded" | "keepsake_made"
  >,
  value: Record<string, unknown> | null = null,
): Promise<void> {
  const { data, error } = await createServiceClient().rpc("log_support_access", {
    p_operator_id: operatorId,
    p_event_id: eventId,
    p_action: action,
    p_value: value,
  });
  if (error) throw error;
  if (data !== true) throw new Error("Support access log entry was not written");
}

/** The host's view of the log: what changed and when, never who (product.md §5.1.3). */
export type HostSupportActionView = { id: string; action: SupportActionKey; createdAt: string };

/** Admits: owner, support. Newest first. */
export async function listSupportActionsForEvent(
  userId: string,
  eventId: string,
): Promise<HostSupportActionView[] | null> {
  const access = await getEventAccessFor(userId, eventId, ["owner", "support"]);
  if (!access) return null;

  const { data, error } = await createServiceClient()
    .from("support_actions")
    .select("id, action, created_at")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data as Pick<SupportActionRow, "id" | "action" | "created_at">[]).map((row) => ({
    id: row.id,
    action: row.action,
    createdAt: row.created_at,
  }));
}

export type OperatorSupportActionView = SupportActionRow & { operatorEmail: string | null };

/**
 * The Console's view of the log, with each entry's operator (product.md §5.1.1). Operator-only:
 * no ownership predicate, so the caller must already have passed `requireOperator()`, the same
 * split as `listCapacityOverridesForOperator`.
 */
export async function listSupportActionsForOperator(
  eventId: string,
): Promise<OperatorSupportActionView[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("support_actions")
    .select()
    .eq("event_id", eventId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as SupportActionRow[];

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

/** The host's email, for the support banner. Admits: support only — the owner knows who they are. */
export async function getSupportedHostEmail(
  operatorId: string,
  eventId: string,
): Promise<string | null> {
  const access = await getEventAccessFor(operatorId, eventId, ["support"]);
  if (!access) return null;
  const { data, error } = await createServiceClient()
    .from("hosts")
    .select("email")
    .eq("id", access.event.host_id)
    .maybeSingle();
  if (error) throw error;
  return (data as { email: string } | null)?.email ?? null;
}
