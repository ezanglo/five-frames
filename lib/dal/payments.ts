import "server-only";

import { createServiceClient } from "@/lib/supabase/service-client";
import { getEventForHost } from "@/lib/dal/events";
import { getEventForOperatorMutation } from "@/lib/dal/operator-events";
import { generateLinkToken } from "@/lib/auth/link-tokens";
import {
  createCheckoutSession,
  expireCheckoutSession,
  getCheckoutSessionStatus,
  type PaymongoWebhookEvent,
} from "@/lib/payments/paymongo-client";
import { CURRENCY, EVENT_PRICE_CENTAVOS } from "@/lib/payments/pricing";
import type { EventRow, ManualPaymentMethod, PaymentRow } from "@/lib/db/types";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type BeginProviderCheckoutRow = {
  payment_id: string | null;
  checkout_session_id: string | null;
  checkout_url: string | null;
  is_new: boolean;
  already_activated: boolean;
};

const REUSE_POLL_ATTEMPTS = 10;
const REUSE_POLL_INTERVAL_MS = 300;

/**
 * Starts (or safely reuses) a self-service PayMongo checkout for a draft event (product.md
 * §7.2, architecture §8). Ownership-checked via getEventForHost — a host can only start
 * checkout for an event they own (invariant 9).
 *
 * An unpaid event can have at most one active (still-`pending`) provider checkout session
 * at a time (`payments_one_active_provider_checkout_idx`). This function never creates a
 * second live session for the same event:
 * - `begin_provider_checkout()` (a Postgres function, same row-lock-then-decide shape as
 *   `reserve_capture`) atomically decides, for the whole event row, whether this call
 *   reserves a fresh placeholder or must reuse an existing one — serializing concurrent
 *   tabs/double-clicks so only one caller ever creates a real PayMongo session.
 * - The reuse path re-checks the existing session's live status with PayMongo directly
 *   (`getCheckoutSessionStatus`) rather than assuming a `pending` row is still payable —
 *   PayMongo's docs don't state whether sessions auto-expire, and a stale reused URL would
 *   be a real host-facing failure. A genuinely expired session is explicitly expired at
 *   PayMongo (harmless if already expired there) and superseded, then a fresh one is
 *   created — never silently reusing a link that might not work.
 * - Checkout-session creation itself carries an `Idempotency-Key` (the placeholder payment
 *   id) as a second, independent layer against PayMongo-side duplication from a network
 *   retry of the create call.
 *
 * Refuses (returns null) once the event is activated: paying twice for the same event
 * isn't a retry, it's a no-op the UI shouldn't offer, and no new checkout can be created
 * after activation (the `begin_provider_checkout` guard).
 */
export async function startProviderCheckout(
  hostId: string,
  eventId: string,
  baseUrl: string,
): Promise<{ checkoutUrl: string } | null> {
  const event = await getEventForHost(hostId, eventId);
  if (!event) return null;

  const supabase = createServiceClient();

  const { data: begin, error: beginError } = await supabase
    .rpc("begin_provider_checkout", { p_event_id: eventId })
    .single<BeginProviderCheckoutRow>();
  if (beginError) throw beginError;
  if (begin.already_activated) return null;

  if (begin.is_new) {
    return createAndStoreCheckoutSession(supabase, event, begin.payment_id!, baseUrl);
  }

  const reused = await reuseOrReplaceCheckoutSession(supabase, event, begin, baseUrl);
  return reused;
}

async function createAndStoreCheckoutSession(
  supabase: ReturnType<typeof createServiceClient>,
  event: EventRow,
  paymentId: string,
  baseUrl: string,
): Promise<{ checkoutUrl: string }> {
  try {
    const session = await createCheckoutSession({
      amountCentavos: EVENT_PRICE_CENTAVOS,
      currency: CURRENCY,
      eventName: event.name,
      successUrl: `${baseUrl}/events/${event.id}?checkout=pending`,
      cancelUrl: `${baseUrl}/events/${event.id}/checkout?checkout=cancelled`,
      referenceNumber: `event_${event.id}`,
      metadata: { eventId: event.id },
      idempotencyKey: paymentId,
    });

    const { error: fillError } = await supabase
      .from("payments")
      .update({
        provider_checkout_session_id: session.id,
        checkout_url: session.checkoutUrl,
        amount: EVENT_PRICE_CENTAVOS,
        currency: CURRENCY,
        updated_at: new Date().toISOString(),
      })
      .eq("id", paymentId);
    if (fillError) throw fillError;

    return { checkoutUrl: session.checkoutUrl };
  } catch (err) {
    // Creation failed after we'd already reserved the one-active-session slot — release
    // it so a retry isn't stuck forever behind our own guard.
    await supabase.from("payments").delete().eq("id", paymentId);
    throw err;
  }
}

async function reuseOrReplaceCheckoutSession(
  supabase: ReturnType<typeof createServiceClient>,
  event: EventRow,
  begin: BeginProviderCheckoutRow,
  baseUrl: string,
): Promise<{ checkoutUrl: string }> {
  let paymentId = begin.payment_id!;
  let checkoutSessionId = begin.checkout_session_id;
  let checkoutUrl = begin.checkout_url;

  // The row that won the placeholder slot may still be mid-creation in another request
  // (a genuine concurrent-tab race) — briefly poll for it to be filled in rather than
  // erroring immediately.
  for (let attempt = 0; !checkoutUrl && attempt < REUSE_POLL_ATTEMPTS; attempt += 1) {
    await sleep(REUSE_POLL_INTERVAL_MS);
    const { data: row, error } = await supabase
      .from("payments")
      .select("provider_checkout_session_id, checkout_url")
      .eq("id", paymentId)
      .maybeSingle();
    if (error) throw error;
    checkoutSessionId = row?.provider_checkout_session_id ?? null;
    checkoutUrl = row?.checkout_url ?? null;
  }

  if (!checkoutUrl || !checkoutSessionId) {
    throw new Error(
      "An existing checkout attempt is still being created. Please try again in a moment.",
    );
  }

  const status = await getCheckoutSessionStatus(checkoutSessionId);
  if (status !== "expired") {
    // Still active (or unknown, in which case we optimistically trust our own
    // bookkeeping rather than blocking checkout on an inconclusive provider read) — reuse
    // it rather than creating a second live session.
    return { checkoutUrl };
  }

  // Genuinely expired at PayMongo (not just in our own guess) — explicitly expire it in
  // our records, then create and store a real replacement under a fresh placeholder.
  await supabase
    .from("payments")
    .update({ provider_status: "superseded", updated_at: new Date().toISOString() })
    .eq("id", paymentId)
    .eq("provider_status", "pending");

  const { data: fresh, error: freshError } = await supabase
    .rpc("begin_provider_checkout", { p_event_id: event.id })
    .single<BeginProviderCheckoutRow>();
  if (freshError) throw freshError;
  if (fresh.already_activated) {
    throw new Error("Event was activated while replacing an expired checkout session.");
  }

  if (fresh.is_new) {
    return createAndStoreCheckoutSession(supabase, event, fresh.payment_id!, baseUrl);
  }

  // Another request replaced it first — reuse whatever it produced (bounded, no further
  // recursion: a session that was just freshly created cannot itself be expired yet).
  paymentId = fresh.payment_id!;
  checkoutUrl = fresh.checkout_url;
  for (let attempt = 0; !checkoutUrl && attempt < REUSE_POLL_ATTEMPTS; attempt += 1) {
    await sleep(REUSE_POLL_INTERVAL_MS);
    const { data: row, error } = await supabase
      .from("payments")
      .select("checkout_url")
      .eq("id", paymentId)
      .maybeSingle();
    if (error) throw error;
    checkoutUrl = row?.checkout_url ?? null;
  }
  if (!checkoutUrl) {
    throw new Error(
      "An existing checkout attempt is still being created. Please try again in a moment.",
    );
  }
  return { checkoutUrl };
}

/** Ownership-checked read for the checkout confirmation page's retry messaging. */
export async function getLatestPaymentForEvent(
  hostId: string,
  eventId: string,
): Promise<PaymentRow | null> {
  const event = await getEventForHost(hostId, eventId);
  if (!event) return null;

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("payments")
    .select()
    .eq("event_id", eventId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data as PaymentRow | null;
}

/**
 * The one place `event_token`/`gallery_token` are minted (decision D16, architecture §8a).
 * A single atomic `WHERE activated_at IS NULL` guard — the same pattern already accepted
 * for frame slots (D5/D6) and event-join capacity (D13) — means a replayed webhook and a
 * (future, Slice 9) double-clicked manual confirm can never double-activate or mint a
 * second, inconsistent pair of links. Callers must have already verified their own trust
 * boundary (webhook signature here; requireOperator() + ownership check for manual
 * payment) before calling this — it never infers "payment looks confirmed" on its own.
 *
 * `activating_payment_id` is stamped in the same atomic statement, so it's race-free: it
 * records which payment actually won activation, letting a caller distinguish "this
 * payment IS the one that activated the event" (including a replay of its own webhook)
 * from "a different payment already activated this event" (a genuine duplicate payment —
 * see `recordProviderWebhookAndActivate`). Returns `activatedByThisCall` so the caller
 * knows which case it's in without a second read.
 *
 * Also supersedes (best-effort, never throws) any other still-`pending` provider checkout
 * sessions for this event once activation actually happens here — once paid, no other
 * session for this event should remain payable.
 */
export async function activateEvent(
  eventId: string,
  paymentId: string,
): Promise<{ event: EventRow; activatedByThisCall: boolean }> {
  const supabase = createServiceClient();

  const { data: activated, error } = await supabase
    .from("events")
    .update({
      activated_at: new Date().toISOString(),
      event_token: generateLinkToken(),
      gallery_token: generateLinkToken(),
      activating_payment_id: paymentId,
    })
    .eq("id", eventId)
    .is("activated_at", null)
    .select()
    .maybeSingle();

  if (error) throw error;

  if (activated) {
    await supersedeSiblingPendingCheckouts(supabase, eventId, paymentId);
    return { event: activated as EventRow, activatedByThisCall: true };
  }

  // Zero rows updated ⇒ already activated by an earlier call (this delivery, a race, or a
  // manual confirmation). Idempotent success, not an error — read back the current row.
  const { data: existing, error: existingError } = await supabase
    .from("events")
    .select()
    .eq("id", eventId)
    .single();

  if (existingError) throw existingError;
  return { event: existing as EventRow, activatedByThisCall: false };
}

async function supersedeSiblingPendingCheckouts(
  supabase: ReturnType<typeof createServiceClient>,
  eventId: string,
  winningPaymentId: string,
): Promise<void> {
  const { data: siblings, error } = await supabase
    .from("payments")
    .select("id, provider_checkout_session_id")
    .eq("event_id", eventId)
    .eq("source", "provider")
    .eq("provider_status", "pending")
    .neq("id", winningPaymentId);

  if (error) throw error;
  if (!siblings || siblings.length === 0) return;

  for (const sibling of siblings) {
    if (sibling.provider_checkout_session_id) {
      try {
        await expireCheckoutSession(sibling.provider_checkout_session_id);
      } catch (err) {
        // Best-effort: our own `payments` row is the source of truth for whether we still
        // treat this session as active, so a failed provider-side expiry never blocks
        // activation — it just means PayMongo's own copy may stay `active` a bit longer.
        console.error(
          `Failed to expire superseded checkout session ${sibling.provider_checkout_session_id}`,
          err,
        );
      }
    }

    // Re-guarded on `provider_status = "pending"` at write time, not just at the read
    // above (Slice 9 regression — see docs/progress.md): a sibling can stop being merely
    // "pending" between that read and this write, e.g. its own webhook lands concurrently
    // and claims it as `paid`/`paid_duplicate` while this call still thinks it's pending.
    // Without this guard, an unconditional update-by-id here would silently clobber that
    // outcome back to `superseded`, hiding a genuine second payment. If the row already
    // moved on, this becomes a harmless no-op — the concurrent write already recorded
    // whatever actually happened to it, which is the correct terminal state.
    const { error: updateError } = await supabase
      .from("payments")
      .update({ provider_status: "superseded", updated_at: new Date().toISOString() })
      .eq("id", sibling.id)
      .eq("provider_status", "pending");
    if (updateError) throw updateError;
  }
}

export type RecordProviderWebhookResult = {
  handled: boolean;
  /** True when this delivery's payment was a genuinely distinct payment for an event that
   *  another payment had already activated — flagged, never silently treated as normal. */
  duplicate?: boolean;
};

/**
 * Handles a verified `checkout_session.payment.paid` webhook delivery: matches it to the
 * payment row created at checkout start (by checkout session id — never trusts metadata
 * from the payload for that), records the delivery, and activates the event. Returns
 * `{ handled: false }` for any other event type or an unrecognized session, so the route
 * handler can 200 without acting rather than erroring on events we don't subscribe to.
 *
 * Idempotent on the webhook's own event id via a partial unique index (payments.
 * provider_webhook_event_id) as a defense-in-depth layer, but the actual "activate exactly
 * once" guarantee is activateEvent's atomic guard — a duplicate delivery here is harmless
 * even if this claim step is skipped.
 *
 * If a second, genuinely distinct payment reaches "paid" for an event another payment
 * already activated (real double payment, not a replay — the DB-level one-active-session
 * guard makes this rare but does not make it impossible: two sessions can be created in
 * the same race window before the first is superseded, and both can then be paid), this
 * payment is recorded as `provider_status = "paid_duplicate"`, not silently as a second
 * ordinary "paid" success. No automatic refund is issued — product.md §15.1 requires
 * provider refunds to go through PayMongo's own refund mechanism, handled manually; this
 * only makes the duplicate visible (via the Operator Console, architecture §8b) for that
 * manual follow-up.
 */
export async function recordProviderWebhookAndActivate(
  event: PaymongoWebhookEvent,
): Promise<RecordProviderWebhookResult> {
  if (event.type !== "checkout_session.payment.paid" || !event.checkoutSession) {
    return { handled: false };
  }

  const supabase = createServiceClient();
  const { data: payment, error: lookupError } = await supabase
    .from("payments")
    .select()
    .eq("provider_checkout_session_id", event.checkoutSession.id)
    .maybeSingle();

  if (lookupError) throw lookupError;
  if (!payment) return { handled: false };

  const firstPayment = event.checkoutSession.payments[0];

  const { data: claimed, error: claimError } = await supabase
    .from("payments")
    .update({
      provider_webhook_event_id: event.id,
      amount: firstPayment?.amount ?? payment.amount,
      currency: firstPayment?.currency ?? payment.currency,
      fee_amount: firstPayment?.fee ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", payment.id)
    .is("provider_webhook_event_id", null)
    .select()
    .maybeSingle();

  if (claimError) throw claimError;

  const paymentId = claimed?.id ?? payment.id;
  const { event: activatedEvent } = await activateEvent(payment.event_id, paymentId);

  const isDuplicate =
    activatedEvent.activating_payment_id !== null &&
    activatedEvent.activating_payment_id !== paymentId;

  const { error: statusError } = await supabase
    .from("payments")
    .update({ provider_status: isDuplicate ? "paid_duplicate" : "paid" })
    .eq("id", paymentId);
  if (statusError) throw statusError;

  return { handled: true, duplicate: isDuplicate };
}

export type ManualPaymentInput = {
  method: ManualPaymentMethod;
  amountCentavos: number;
  currency: string;
  /** UTC instant the payment was actually received, already converted from the
   *  operator's local input (product.md §7.2.1's "the date the payment was made"). */
  paidAtIso: string;
  referenceNote: string | null;
};

export type ConfirmManualPaymentResult =
  | { outcome: "not_found" }
  | { outcome: "owns_event" }
  | { outcome: "already_activated" }
  | { outcome: "activated"; event: EventRow; payment: PaymentRow }
  | { outcome: "duplicate"; event: EventRow; payment: PaymentRow };

/**
 * Confirms a supplier-assisted/manual payment (product.md §7.2/§7.2.1) and activates the
 * event through the same `activateEvent` the provider path uses (decision D16) — no
 * separate manual activation implementation. The caller must already be a verified
 * operator (`requireOperator()`, checked by the server action, not here); this function
 * only enforces the ownership-conflict rule (architecture §5a) — the same trust split
 * `startProviderCheckout` already has with `requireHost()`.
 *
 * Refuses outright (rather than inserting a second manual payment row) once the event is
 * already activated, so a repeated/duplicated confirm submission for the same event is a
 * clean no-op instead of creating a spurious extra payment row that would always lose the
 * activation race. A genuine concurrent race — two different confirmations, or an
 * operator confirming while a PayMongo webhook lands — can still both pass this pre-check
 * before either commits: `activateEvent`'s atomic guard is what actually guarantees
 * exactly-once activation there, and the loser is reported as "duplicate" so the Console
 * can surface it for follow-up rather than silently treating it as ordinary success.
 */
export async function confirmManualPayment(
  operatorId: string,
  eventId: string,
  input: ManualPaymentInput,
): Promise<ConfirmManualPaymentResult> {
  const event = await getEventForOperatorMutation(eventId);
  if (!event) return { outcome: "not_found" };
  if (event.host_id === operatorId) return { outcome: "owns_event" };
  if (event.activated_at) return { outcome: "already_activated" };

  const supabase = createServiceClient();
  const { data: payment, error } = await supabase
    .from("payments")
    .insert({
      event_id: eventId,
      source: "manual",
      manual_method: input.method,
      manual_amount: input.amountCentavos,
      manual_currency: input.currency,
      paid_at: input.paidAtIso,
      confirmed_at: new Date().toISOString(),
      confirmed_by: operatorId,
      reference_note: input.referenceNote,
    })
    .select()
    .single();
  if (error) throw error;

  const { event: activatedEvent, activatedByThisCall } = await activateEvent(
    eventId,
    payment.id as string,
  );

  return {
    outcome: activatedByThisCall ? "activated" : "duplicate",
    event: activatedEvent,
    payment: payment as PaymentRow,
  };
}

export type ManualRefundInput = { note: string | null };

export type RecordManualRefundResult =
  | { outcome: "not_found" }
  | { outcome: "owns_event" }
  | { outcome: "not_activated" }
  | { outcome: "refunded"; event: EventRow; payment: PaymentRow | null };

/**
 * Records a manually executed refund (product.md §15.1) and returns the event to unpaid,
 * disabling its links — the same outcome a provider refund produces (architecture §8a).
 * Mirrors `confirmManualPayment`'s trust boundary: the caller must already be a verified
 * operator; this only enforces the ownership-conflict rule.
 *
 * Two independent atomic guards make repeated or concurrent refund submissions safe
 * without a cross-table transaction: the payment row only ever claims `refunded_at` once
 * (`WHERE refunded_at IS NULL`), and the event only ever clears its activation once
 * (`WHERE activated_at IS NOT NULL`) — a second call for an already-refunded event sees
 * `not_activated` and does nothing further, the same idempotent-under-replay shape as
 * every other guarded mutation in this codebase (D5/D6/D13/D16).
 */
export async function recordManualRefund(
  operatorId: string,
  eventId: string,
  input: ManualRefundInput,
): Promise<RecordManualRefundResult> {
  const event = await getEventForOperatorMutation(eventId);
  if (!event) return { outcome: "not_found" };
  if (event.host_id === operatorId) return { outcome: "owns_event" };
  if (!event.activated_at) return { outcome: "not_activated" };

  const supabase = createServiceClient();

  let refundedPayment: PaymentRow | null = null;
  if (event.activating_payment_id) {
    const { data, error } = await supabase
      .from("payments")
      .update({
        refunded_at: new Date().toISOString(),
        refunded_by: operatorId,
        refund_note: input.note,
        updated_at: new Date().toISOString(),
      })
      .eq("id", event.activating_payment_id)
      .is("refunded_at", null)
      .select()
      .maybeSingle();
    if (error) throw error;
    refundedPayment = data as PaymentRow | null;
  }

  const { data: clearedEvent, error: clearError } = await supabase
    .from("events")
    .update({
      activated_at: null,
      event_token: null,
      gallery_token: null,
      activating_payment_id: null,
    })
    .eq("id", eventId)
    .not("activated_at", "is", null)
    .select()
    .maybeSingle();
  if (clearError) throw clearError;

  return {
    outcome: "refunded",
    event: (clearedEvent as EventRow | null) ?? event,
    payment: refundedPayment,
  };
}

/**
 * True when this payment reached a successful terminal state (provider `paid`/
 * `paid_duplicate`, or a confirmed manual payment) but is not the payment that actually
 * activated the event — a genuinely distinct payment surfaced for operator follow-up
 * (product.md §15.1). Computed from `events.activating_payment_id` rather than a second
 * stored flag, so it reads correctly for either payment source without new schema.
 */
export function isDuplicatePayment(payment: PaymentRow, event: EventRow): boolean {
  const succeeded =
    payment.source === "provider"
      ? payment.provider_status === "paid" || payment.provider_status === "paid_duplicate"
      : payment.confirmed_at !== null;
  return succeeded && event.activating_payment_id !== payment.id;
}
