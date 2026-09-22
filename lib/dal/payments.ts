import "server-only";

import { createServiceClient } from "@/lib/supabase/service-client";
import { getEventForHost } from "@/lib/dal/events";
import { generateLinkToken } from "@/lib/auth/link-tokens";
import { createCheckoutSession, type PaymongoWebhookEvent } from "@/lib/payments/paymongo-client";
import { CURRENCY, EVENT_PRICE_CENTAVOS } from "@/lib/payments/pricing";
import type { EventRow, PaymentRow } from "@/lib/db/types";

/**
 * Starts a self-service PayMongo checkout for a draft event (product.md §7.2, architecture
 * §8). Ownership-checked via getEventForHost — a host can only start checkout for an event
 * they own (invariant 9). Refuses (returns null) for an already-activated event: paying
 * twice for the same event isn't a retry, it's a no-op the UI shouldn't offer.
 */
export async function startProviderCheckout(
  hostId: string,
  eventId: string,
  baseUrl: string,
): Promise<{ checkoutUrl: string } | null> {
  const event = await getEventForHost(hostId, eventId);
  if (!event || event.activated_at) return null;

  const session = await createCheckoutSession({
    amountCentavos: EVENT_PRICE_CENTAVOS,
    currency: CURRENCY,
    eventName: event.name,
    successUrl: `${baseUrl}/events/${eventId}?checkout=pending`,
    cancelUrl: `${baseUrl}/events/${eventId}/checkout?checkout=cancelled`,
    referenceNumber: `event_${eventId}`,
    metadata: { eventId },
  });

  const supabase = createServiceClient();
  const { error } = await supabase.from("payments").insert({
    event_id: eventId,
    source: "provider",
    provider_checkout_session_id: session.id,
    provider_status: "pending",
    amount: EVENT_PRICE_CENTAVOS,
    currency: CURRENCY,
  });
  if (error) throw error;

  return { checkoutUrl: session.checkoutUrl };
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
 */
export async function activateEvent(eventId: string, paymentId: string): Promise<EventRow> {
  // paymentId is part of the D16-decided signature (every activation traces back to a
  // specific, already-confirmed payment row) even though this guard itself only needs
  // eventId — activateEvent never infers confirmation on its own, only its callers do.
  void paymentId;

  const supabase = createServiceClient();

  const { data: activated, error } = await supabase
    .from("events")
    .update({
      activated_at: new Date().toISOString(),
      event_token: generateLinkToken(),
      gallery_token: generateLinkToken(),
    })
    .eq("id", eventId)
    .is("activated_at", null)
    .select()
    .maybeSingle();

  if (error) throw error;
  if (activated) return activated as EventRow;

  // Zero rows updated ⇒ already activated by an earlier call (this delivery, a race, or a
  // manual confirmation). Idempotent success, not an error — read back the current row.
  const { data: existing, error: existingError } = await supabase
    .from("events")
    .select()
    .eq("id", eventId)
    .single();

  if (existingError) throw existingError;
  return existing as EventRow;
}

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
 */
export async function recordProviderWebhookAndActivate(
  event: PaymongoWebhookEvent,
): Promise<{ handled: boolean }> {
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
      provider_status: "paid",
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

  await activateEvent(payment.event_id, claimed?.id ?? payment.id);
  return { handled: true };
}
