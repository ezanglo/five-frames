import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServiceClient } from "@/lib/supabase/service-client";
import { createDraftEvent, getEventForHost } from "@/lib/dal/events";
import {
  activateEvent,
  getLatestPaymentForEvent,
  recordProviderWebhookAndActivate,
  startProviderCheckout,
} from "@/lib/dal/payments";
import type { PaymongoWebhookEvent } from "@/lib/payments/paymongo-client";

/**
 * Runs against the real linked dev Postgres (architecture §11) — the shared activation
 * guard (decision D16) is a load-bearing invariant (payment-before-activation, exactly-
 * once activation), worth proving against a real database rather than a mock. Doesn't
 * exercise the actual PayMongo network call: startProviderCheckout's ownership/already-
 * activated refusals both return before reaching the network, and the webhook-processing
 * path is tested by constructing payment rows directly, the way a real checkout would
 * have left them.
 */
describe("payment and shared activation", () => {
  const supabase = createServiceClient();
  const suffix = crypto.randomUUID();
  let hostAId: string;
  let hostBId: string;

  beforeAll(async () => {
    const { data: hostA, error: errorA } = await supabase.auth.admin.createUser({
      email: `pay-host-a-${suffix}@example.test`,
      password: crypto.randomUUID(),
      email_confirm: true,
    });
    if (errorA) throw errorA;
    hostAId = hostA.user.id;

    const { data: hostB, error: errorB } = await supabase.auth.admin.createUser({
      email: `pay-host-b-${suffix}@example.test`,
      password: crypto.randomUUID(),
      email_confirm: true,
    });
    if (errorB) throw errorB;
    hostBId = hostB.user.id;
  });

  afterAll(async () => {
    if (hostAId) await supabase.auth.admin.deleteUser(hostAId);
    if (hostBId) await supabase.auth.admin.deleteUser(hostBId);
  });

  async function insertProviderPayment(eventId: string, checkoutSessionId: string) {
    const { error } = await supabase.from("payments").insert({
      event_id: eventId,
      source: "provider",
      provider_checkout_session_id: checkoutSessionId,
      provider_status: "pending",
      amount: 99900,
      currency: "PHP",
    });
    if (error) throw error;
  }

  function paidWebhookEvent(
    webhookEventId: string,
    checkoutSessionId: string,
  ): PaymongoWebhookEvent {
    return {
      id: webhookEventId,
      type: "checkout_session.payment.paid",
      livemode: false,
      checkoutSession: {
        id: checkoutSessionId,
        referenceNumber: null,
        payments: [{ amount: 99900, currency: "PHP", fee: 4500 }],
      },
    };
  }

  it("a draft event has no distributable link or QR before payment", async () => {
    const event = await createDraftEvent(hostAId, "Unpaid event");
    expect(event.activated_at).toBeNull();
    expect(event.event_token).toBeNull();
    expect(event.gallery_token).toBeNull();
  });

  it("activateEvent is idempotent under a direct double call", async () => {
    const event = await createDraftEvent(hostAId, "Direct activation race");
    const paymentId = crypto.randomUUID();

    const first = await activateEvent(event.id, paymentId);
    const second = await activateEvent(event.id, paymentId);

    expect(first.activated_at).not.toBeNull();
    expect(second.activated_at).toBe(first.activated_at);
    expect(second.event_token).toBe(first.event_token);
    expect(second.gallery_token).toBe(first.gallery_token);
  });

  it("a duplicate/replayed webhook delivery activates the event exactly once", async () => {
    const event = await createDraftEvent(hostAId, "Webhook replay");
    const checkoutSessionId = `cs_test_${crypto.randomUUID()}`;
    await insertProviderPayment(event.id, checkoutSessionId);

    const webhookEventId = `evt_test_${crypto.randomUUID()}`;
    const first = await recordProviderWebhookAndActivate(
      paidWebhookEvent(webhookEventId, checkoutSessionId),
    );
    const second = await recordProviderWebhookAndActivate(
      paidWebhookEvent(webhookEventId, checkoutSessionId),
    );

    expect(first.handled).toBe(true);
    expect(second.handled).toBe(true);

    const activated = await getEventForHost(hostAId, event.id);
    expect(activated?.activated_at).not.toBeNull();
    expect(activated?.event_token).not.toBeNull();
    expect(activated?.gallery_token).not.toBeNull();

    const { data: payments, error } = await supabase
      .from("payments")
      .select()
      .eq("event_id", event.id);
    if (error) throw error;
    expect(payments).toHaveLength(1);
    expect(payments![0].provider_status).toBe("paid");
  });

  it("an unrecognized checkout session is ignored, not activated", async () => {
    const event = await createDraftEvent(hostAId, "No matching payment row");
    const result = await recordProviderWebhookAndActivate(
      paidWebhookEvent(`evt_${crypto.randomUUID()}`, `cs_unknown_${crypto.randomUUID()}`),
    );
    expect(result.handled).toBe(false);

    const stillDraft = await getEventForHost(hostAId, event.id);
    expect(stillDraft?.activated_at).toBeNull();
  });

  it("a non-payment event type is ignored", async () => {
    const event = await createDraftEvent(hostAId, "Wrong event type");
    const checkoutSessionId = `cs_test_${crypto.randomUUID()}`;
    await insertProviderPayment(event.id, checkoutSessionId);

    const result = await recordProviderWebhookAndActivate({
      id: `evt_${crypto.randomUUID()}`,
      type: "checkout_session.payment.failed",
      livemode: false,
      checkoutSession: { id: checkoutSessionId, referenceNumber: null, payments: [] },
    });
    expect(result.handled).toBe(false);

    const stillDraft = await getEventForHost(hostAId, event.id);
    expect(stillDraft?.activated_at).toBeNull();
  });

  it("startProviderCheckout refuses for an event the caller doesn't own", async () => {
    const event = await createDraftEvent(hostAId, "Owned by host A");
    const result = await startProviderCheckout(hostBId, event.id, "https://example.test");
    expect(result).toBeNull();
  });

  it("startProviderCheckout refuses for an already-activated event", async () => {
    const event = await createDraftEvent(hostAId, "Already paid");
    await activateEvent(event.id, crypto.randomUUID());

    const result = await startProviderCheckout(hostAId, event.id, "https://example.test");
    expect(result).toBeNull();
  });

  it("getLatestPaymentForEvent is ownership-scoped", async () => {
    const event = await createDraftEvent(hostAId, "Payment visibility");
    await insertProviderPayment(event.id, `cs_test_${crypto.randomUUID()}`);

    const asOwner = await getLatestPaymentForEvent(hostAId, event.id);
    expect(asOwner?.event_id).toBe(event.id);

    const asOther = await getLatestPaymentForEvent(hostBId, event.id);
    expect(asOther).toBeNull();
  });
});
