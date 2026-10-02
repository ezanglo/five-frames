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
import { deriveDraftPaymentState } from "@/lib/payments/draft-payment";

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

  async function insertProviderPayment(
    eventId: string,
    checkoutSessionId: string,
  ): Promise<string> {
    const { data, error } = await supabase
      .from("payments")
      .insert({
        event_id: eventId,
        source: "provider",
        provider_checkout_session_id: checkoutSessionId,
        checkout_url: `https://checkout.paymongo.com/${checkoutSessionId}`,
        provider_status: "pending",
        amount: 99900,
        currency: "PHP",
      })
      .select("id")
      .single();
    if (error) throw error;
    return data.id as string;
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
    const paymentId = await insertProviderPayment(event.id, `cs_test_${crypto.randomUUID()}`);

    const first = await activateEvent(event.id, paymentId);
    const second = await activateEvent(event.id, paymentId);

    expect(first.activatedByThisCall).toBe(true);
    expect(second.activatedByThisCall).toBe(false);
    expect(first.event.activated_at).not.toBeNull();
    expect(second.event.activated_at).toBe(first.event.activated_at);
    expect(second.event.event_token).toBe(first.event.event_token);
    expect(second.event.gallery_token).toBe(first.event.gallery_token);
    expect(second.event.activating_payment_id).toBe(paymentId);
  });

  it("activation stamps hosted_until (~12 months out) and grace_until (~30 days after that)", async () => {
    const event = await createDraftEvent(hostAId, "Retention timestamps");
    const paymentId = await insertProviderPayment(event.id, `cs_test_${crypto.randomUUID()}`);

    const before = Date.now();
    const { event: activated } = await activateEvent(event.id, paymentId);
    const after = Date.now();

    expect(activated.hosted_until).not.toBeNull();
    expect(activated.grace_until).not.toBeNull();

    const hostedUntilMs = Date.parse(activated.hosted_until as string);
    const graceUntilMs = Date.parse(activated.grace_until as string);
    const oneDayMs = 24 * 60 * 60 * 1000;

    // ~365 days from activation, allowing for the small window between `before`/`after`.
    expect(hostedUntilMs).toBeGreaterThanOrEqual(before + 364 * oneDayMs);
    expect(hostedUntilMs).toBeLessThanOrEqual(after + 366 * oneDayMs);
    // grace_until is ~30 days after hosted_until.
    expect(graceUntilMs - hostedUntilMs).toBe(30 * oneDayMs);
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

  it("two active pending provider checkouts for the same event are impossible at the DB level", async () => {
    // Root-cause regression for the real production incident (two separate PayMongo test
    // checkouts both reaching "paid" for one event): payments_one_active_provider_checkout_idx
    // now refuses a second `pending` provider payment row for an event outright, the same
    // DB-enforced-limit philosophy as the frame slot and guest-capacity guards.
    const event = await createDraftEvent(hostAId, "Two pending checkouts refused");
    await insertProviderPayment(event.id, `cs_test_${crypto.randomUUID()}`);

    await expect(
      insertProviderPayment(event.id, `cs_test_${crypto.randomUUID()}`),
    ).rejects.toThrow(/payments_one_active_provider_checkout_idx/);
  });

  it("a payment that reaches paid after a different payment already activated the event is flagged, not silently accepted", async () => {
    // The new unique index above makes two live pending sessions impossible going
    // forward, but a genuinely distinct payment can still reach "paid" after activation
    // already happened from another payment (e.g. residual pre-fix data, or a
    // provider/manual cross-source race once Slice 9 exists) — requirement 7: never
    // silently treat that as a second normal success.
    const event = await createDraftEvent(hostAId, "Duplicate payment after activation");
    const checkoutSessionA = `cs_test_${crypto.randomUUID()}`;
    await insertProviderPayment(event.id, checkoutSessionA);

    const first = await recordProviderWebhookAndActivate(
      paidWebhookEvent(`evt_test_${crypto.randomUUID()}`, checkoutSessionA),
    );
    expect(first.handled).toBe(true);
    expect(first.duplicate).toBeFalsy();

    const activatedAfterFirst = await getEventForHost(hostAId, event.id);
    expect(activatedAfterFirst?.activated_at).not.toBeNull();

    // Now that A is no longer `pending`, a second provider payment row can exist for this
    // event (the partial unique index only restricts concurrently-pending rows) —
    // representing a payment that lands after activation already happened elsewhere.
    const checkoutSessionB = `cs_test_${crypto.randomUUID()}`;
    await insertProviderPayment(event.id, checkoutSessionB);

    const second = await recordProviderWebhookAndActivate(
      paidWebhookEvent(`evt_test_${crypto.randomUUID()}`, checkoutSessionB),
    );
    expect(second.handled).toBe(true);
    expect(second.duplicate).toBe(true);

    const activatedAfterSecond = await getEventForHost(hostAId, event.id);
    expect(activatedAfterSecond?.activated_at).toBe(activatedAfterFirst?.activated_at);
    expect(activatedAfterSecond?.event_token).toBe(activatedAfterFirst?.event_token);
    expect(activatedAfterSecond?.gallery_token).toBe(activatedAfterFirst?.gallery_token);

    const { data: payments, error } = await supabase
      .from("payments")
      .select()
      .eq("event_id", event.id)
      .order("created_at", { ascending: true });
    if (error) throw error;
    expect(payments).toHaveLength(2);
    expect(payments![0].provider_status).toBe("paid");
    expect(payments![1].provider_status).toBe("paid_duplicate");
  });

  it("begin_provider_checkout reuses the same pending payment on a repeated call", async () => {
    const event = await createDraftEvent(hostAId, "Repeated pay click");

    const { data: first, error: firstError } = await supabase
      .rpc("begin_provider_checkout", { p_event_id: event.id })
      .single<{ payment_id: string; is_new: boolean; already_activated: boolean }>();
    if (firstError) throw firstError;
    expect(first.is_new).toBe(true);
    expect(first.already_activated).toBe(false);

    const { data: second, error: secondError } = await supabase
      .rpc("begin_provider_checkout", { p_event_id: event.id })
      .single<{ payment_id: string; is_new: boolean; already_activated: boolean }>();
    if (secondError) throw secondError;
    expect(second.is_new).toBe(false);
    expect(second.payment_id).toBe(first.payment_id);

    const { data: rows, error: rowsError } = await supabase
      .from("payments")
      .select("id")
      .eq("event_id", event.id)
      .eq("source", "provider")
      .eq("provider_status", "pending");
    if (rowsError) throw rowsError;
    expect(rows).toHaveLength(1);
  });

  it("concurrent begin_provider_checkout calls for the same event only let one create a session", async () => {
    const event = await createDraftEvent(hostAId, "Concurrent checkout start");

    const results = await Promise.all(
      Array.from({ length: 8 }, () =>
        supabase
          .rpc("begin_provider_checkout", { p_event_id: event.id })
          .single<{ payment_id: string; is_new: boolean; already_activated: boolean }>(),
      ),
    );
    for (const { error } of results) {
      if (error) throw error;
    }

    const winners = results.filter((r) => r.data!.is_new);
    expect(winners).toHaveLength(1);

    const { data: rows, error: rowsError } = await supabase
      .from("payments")
      .select("id")
      .eq("event_id", event.id)
      .eq("source", "provider")
      .eq("provider_status", "pending");
    if (rowsError) throw rowsError;
    expect(rows).toHaveLength(1);

    const uniquePaymentIds = new Set(results.map((r) => r.data!.payment_id));
    expect(uniquePaymentIds.size).toBe(1);
  });

  it("begin_provider_checkout refuses to create a new session once the event is activated", async () => {
    const event = await createDraftEvent(hostAId, "No checkout after activation");
    const paymentId = await insertProviderPayment(event.id, `cs_test_${crypto.randomUUID()}`);
    await activateEvent(event.id, paymentId);

    const { data, error } = await supabase
      .rpc("begin_provider_checkout", { p_event_id: event.id })
      .single<{ payment_id: string | null; is_new: boolean; already_activated: boolean }>();
    if (error) throw error;

    expect(data.already_activated).toBe(true);
    expect(data.is_new).toBe(false);
    expect(data.payment_id).toBeNull();
  });

  it("activation supersedes a still-pending provider checkout that didn't win activation", async () => {
    // Exercises requirement 4 ("expire any still-active obsolete Checkout Session where
    // practical") directly at the DAL level. Two live *provider* pending sessions for one
    // event can no longer coexist (the unique-index test above), but activateEvent is
    // payment-source-agnostic (D16) — this covers the still-plausible near-term case of a
    // leftover pending provider checkout superseded by a different source activating the
    // event (e.g. Slice 9's manual confirmation path). Best-effort: the PayMongo expire
    // call for a fake session id fails harmlessly either way (network error or 404,
    // depending on whether test PayMongo credentials are configured), so this assertion
    // doesn't depend on it succeeding.
    const event = await createDraftEvent(hostAId, "Supersede on activation");
    const sidelinedPaymentId = await insertProviderPayment(
      event.id,
      `cs_test_${crypto.randomUUID()}`,
    );

    const { data: activatorPayment, error: activatorError } = await supabase
      .from("payments")
      .insert({ event_id: event.id, source: "manual" })
      .select("id")
      .single();
    if (activatorError) throw activatorError;

    const { activatedByThisCall } = await activateEvent(event.id, activatorPayment.id as string);
    expect(activatedByThisCall).toBe(true);

    const { data: sidelined, error: sidelinedError } = await supabase
      .from("payments")
      .select("provider_status")
      .eq("id", sidelinedPaymentId)
      .single();
    if (sidelinedError) throw sidelinedError;
    expect(sidelined.provider_status).toBe("superseded");
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
    const paymentId = await insertProviderPayment(event.id, `cs_test_${crypto.randomUUID()}`);
    await activateEvent(event.id, paymentId);

    const result = await startProviderCheckout(hostAId, event.id, "https://example.test");
    expect(result).toBeNull();
  });

  it("an abandoned checkout leaves the event unpaid and unfinished, stays retryable, and a later trusted payment still activates (HOST-05)", async () => {
    const event = await createDraftEvent(hostAId, "Abandoned checkout");
    const sessionId = `cs_test_${crypto.randomUUID()}`;
    // What "Pay online" leaves behind once the host cancels on PayMongo or just walks away:
    // one pending provider row, and nothing from PayMongo saying either way.
    const paymentId = await insertProviderPayment(event.id, sessionId);

    const unpaid = await getEventForHost(hostAId, event.id);
    expect(unpaid?.activated_at).toBeNull();
    expect(unpaid?.event_token).toBeNull();
    const latest = await getLatestPaymentForEvent(hostAId, event.id);
    expect(deriveDraftPaymentState({ mode: "online", checkoutParam: undefined, latestPayment: latest })).toBe(
      "checkout_unfinished",
    );

    // Pay online again reuses the same attempt rather than refusing or starting a second one.
    const { data: retry, error: retryError } = await supabase
      .rpc("begin_provider_checkout", { p_event_id: event.id })
      .single<{ payment_id: string; is_new: boolean; already_activated: boolean }>();
    if (retryError) throw retryError;
    expect(retry.already_activated).toBe(false);
    expect(retry.is_new).toBe(false);
    expect(retry.payment_id).toBe(paymentId);

    // Only the verified webhook establishes payment, and it activates the event.
    const result = await recordProviderWebhookAndActivate(
      paidWebhookEvent(`evt_${crypto.randomUUID()}`, sessionId),
    );
    expect(result).toEqual({ handled: true, duplicate: false });
    const activated = await getEventForHost(hostAId, event.id);
    expect(activated?.activated_at).not.toBeNull();
    expect(activated?.activating_payment_id).toBe(paymentId);
    expect((await getLatestPaymentForEvent(hostAId, event.id))?.provider_status).toBe("paid");
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
