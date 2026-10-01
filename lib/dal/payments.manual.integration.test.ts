import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServiceClient } from "@/lib/supabase/service-client";
import { createDraftEvent, getEventForHost } from "@/lib/dal/events";
import { deriveEventLifecycleState } from "@/lib/events/lifecycle";
import { grantOperator } from "@/lib/dal/operators";
import {
  confirmManualPayment,
  isDuplicatePayment,
  recordManualRefund,
  recordProviderWebhookAndActivate,
  type ConfirmManualPaymentResult,
  type ManualPaymentInput,
} from "@/lib/dal/payments";
import type { PaymongoWebhookEvent } from "@/lib/payments/paymongo-client";
import { getOperatorEventDetail } from "@/lib/dal/operator-events";
import { paymentAuditRows } from "@/lib/payments/audit";
import { zonedDateTimeLocalToUtcIso } from "@/lib/events/timezone";

/**
 * Runs against the real linked dev Postgres (architecture §11) — manual payment
 * confirmation and refund share the same load-bearing activation guard as provider
 * payment (decision D16), plus a new ownership-conflict rule (architecture §5a) and a new
 * cross-source race (a manual confirm and a provider webhook can now both try to activate
 * the same event) worth proving for real rather than trusting code inspection alone.
 */
describe("manual payment confirmation and refund", () => {
  const supabase = createServiceClient();
  const suffix = crypto.randomUUID();
  let hostAId: string;
  /** Both an operator and the owner of its own events — exercises the ownership-conflict
   *  rule (architecture §5a: an operator cannot confirm/refund for an event they own). */
  let operatorHostId: string;
  let operatorBId: string;

  beforeAll(async () => {
    const { data: hostA, error: errorA } = await supabase.auth.admin.createUser({
      email: `manual-host-a-${suffix}@example.test`,
      password: crypto.randomUUID(),
      email_confirm: true,
    });
    if (errorA) throw errorA;
    hostAId = hostA.user.id;

    const { data: operatorHost, error: errorOpHost } = await supabase.auth.admin.createUser({
      email: `manual-operator-host-${suffix}@example.test`,
      password: crypto.randomUUID(),
      email_confirm: true,
    });
    if (errorOpHost) throw errorOpHost;
    operatorHostId = operatorHost.user.id;
    await grantOperator(operatorHostId);

    const { data: operatorB, error: errorOpB } = await supabase.auth.admin.createUser({
      email: `manual-operator-b-${suffix}@example.test`,
      password: crypto.randomUUID(),
      email_confirm: true,
    });
    if (errorOpB) throw errorOpB;
    operatorBId = operatorB.user.id;
    await grantOperator(operatorBId);
  });

  afterAll(async () => {
    if (hostAId) await supabase.auth.admin.deleteUser(hostAId);
    if (operatorHostId) await supabase.auth.admin.deleteUser(operatorHostId);
    if (operatorBId) await supabase.auth.admin.deleteUser(operatorBId);
  });

  function manualInput(overrides: Partial<ManualPaymentInput> = {}): ManualPaymentInput {
    return {
      method: "cash",
      amountCentavos: 99900,
      currency: "PHP",
      paidAtIso: new Date().toISOString(),
      referenceNote: null,
      ...overrides,
    };
  }

  it("confirming a manual payment activates the event through the shared activation path", async () => {
    const event = await createDraftEvent(hostAId, "Manual confirm success");

    const result = await confirmManualPayment(operatorBId, event.id, manualInput());

    expect(result.outcome).toBe("activated");
    if (result.outcome !== "activated") throw new Error("unreachable");
    expect(result.event.activated_at).not.toBeNull();
    expect(result.event.event_token).not.toBeNull();
    expect(result.event.gallery_token).not.toBeNull();
    // Payment activates the event but never opens capture (product.md §7.3).
    expect(result.event.capture_opened_at).toBeNull();
    expect(result.payment.source).toBe("manual");
    expect(result.payment.manual_method).toBe("cash");
    expect(result.payment.confirmed_by).toBe(operatorBId);
    expect(result.event.activating_payment_id).toBe(result.payment.id);
  });

  it("an operator cannot confirm a manual payment for an event they own", async () => {
    const event = await createDraftEvent(operatorHostId, "Owned by the confirming operator");

    const result = await confirmManualPayment(operatorHostId, event.id, manualInput());

    expect(result.outcome).toBe("owns_event");
    const stillDraft = await getEventForHost(operatorHostId, event.id);
    expect(stillDraft?.activated_at).toBeNull();
  });

  it("a different authorized operator can confirm for that event", async () => {
    const event = await createDraftEvent(operatorHostId, "Confirmed by a different operator");

    const result = await confirmManualPayment(operatorBId, event.id, manualInput());

    expect(result.outcome).toBe("activated");
    const activated = await getEventForHost(operatorHostId, event.id);
    expect(activated?.activated_at).not.toBeNull();
  });

  it("a repeated manual confirmation attempt is refused, not duplicated", async () => {
    const event = await createDraftEvent(hostAId, "Repeated confirm");

    const first = await confirmManualPayment(operatorBId, event.id, manualInput());
    expect(first.outcome).toBe("activated");

    const second = await confirmManualPayment(operatorBId, event.id, manualInput());
    expect(second.outcome).toBe("already_activated");

    const { data: payments, error } = await supabase
      .from("payments")
      .select("id")
      .eq("event_id", event.id);
    if (error) throw error;
    expect(payments).toHaveLength(1);
  });

  it("concurrent manual confirmation attempts from two different operators activate exactly once", async () => {
    const event = await createDraftEvent(hostAId, "Concurrent manual confirm");

    const [a, b] = await Promise.all([
      confirmManualPayment(operatorBId, event.id, manualInput({ referenceNote: "from A" })),
      confirmManualPayment(operatorHostId, event.id, manualInput({ referenceNote: "from B" })),
    ]);

    const outcomes = [a.outcome, b.outcome].sort();
    expect(outcomes).toEqual(["activated", "duplicate"]);

    const activated = await getEventForHost(hostAId, event.id);
    expect(activated?.activated_at).not.toBeNull();

    const { data: payments, error } = await supabase
      .from("payments")
      .select()
      .eq("event_id", event.id);
    if (error) throw error;
    expect(payments).toHaveLength(2);

    const winner = payments!.find((p) => p.id === activated!.activating_payment_id)!;
    const loser = payments!.find((p) => p.id !== activated!.activating_payment_id)!;
    expect(isDuplicatePayment(winner, activated!)).toBe(false);
    expect(isDuplicatePayment(loser, activated!)).toBe(true);
  });

  it("a provider payment and a manual confirmation racing the same event activate exactly once", async () => {
    // This test caught a real bug: activateEvent's supersedeSiblingPendingCheckouts used
    // to update a sidelined sibling's provider_status to "superseded" unconditionally by
    // id. When the manual confirm won this race, it superseded the provider payment
    // (still reading as "pending" at that moment) right as that payment's own webhook was
    // concurrently claiming it "paid_duplicate" — the unconditional write silently
    // clobbered the claim back to "superseded", which isDuplicatePayment doesn't treat as
    // a succeeded/flagged payment, hiding a genuine second payment from the Operator
    // Console. Fixed by guarding that update on `provider_status = "pending"` at write
    // time too, not just at the earlier read (see lib/dal/payments.ts).
    const event = await createDraftEvent(hostAId, "Cross-source race");
    const checkoutSessionId = `cs_test_${crypto.randomUUID()}`;
    const { data: providerPayment, error: insertError } = await supabase
      .from("payments")
      .insert({
        event_id: event.id,
        source: "provider",
        provider_checkout_session_id: checkoutSessionId,
        checkout_url: `https://checkout.paymongo.com/${checkoutSessionId}`,
        provider_status: "pending",
        amount: 99900,
        currency: "PHP",
      })
      .select()
      .single();
    if (insertError) throw insertError;

    const webhookEvent: PaymongoWebhookEvent = {
      id: `evt_test_${crypto.randomUUID()}`,
      type: "checkout_session.payment.paid",
      livemode: false,
      checkoutSession: {
        id: checkoutSessionId,
        referenceNumber: null,
        payments: [{ amount: 99900, currency: "PHP", fee: 4500 }],
      },
    };

    const [webhookResult, manualResult] = await Promise.all([
      recordProviderWebhookAndActivate(webhookEvent),
      confirmManualPayment(operatorBId, event.id, manualInput()),
    ]);

    expect(webhookResult.handled).toBe(true);
    expect(["activated", "duplicate"]).toContain(manualResult.outcome);

    const activated = await getEventForHost(hostAId, event.id);
    expect(activated?.activated_at).not.toBeNull();
    // Exactly one of the two payments is the activating one.
    const activatingIsProvider = activated!.activating_payment_id === providerPayment.id;
    const activatingIsManual =
      manualResult.outcome === "activated" &&
      activated!.activating_payment_id === (manualResult as Extract<
        ConfirmManualPaymentResult,
        { outcome: "activated" }
      >).payment.id;
    expect(activatingIsProvider || activatingIsManual).toBe(true);
    expect(activatingIsProvider && activatingIsManual).toBe(false);

    // The loser is flagged, never silently accepted as a second normal success.
    const { data: payments, error } = await supabase
      .from("payments")
      .select()
      .eq("event_id", event.id);
    if (error) throw error;
    expect(payments).toHaveLength(2);
    const loser = payments!.find((p) => p.id !== activated!.activating_payment_id)!;
    expect(isDuplicatePayment(loser, activated!)).toBe(true);
  });

  it("a manual refund returns the event to unpaid and disables its links", async () => {
    const event = await createDraftEvent(hostAId, "Manual refund");
    const confirmed = await confirmManualPayment(operatorBId, event.id, manualInput());
    expect(confirmed.outcome).toBe("activated");
    const paymentId = (confirmed as Extract<ConfirmManualPaymentResult, { outcome: "activated" }>)
      .payment.id;

    const result = await recordManualRefund(operatorBId, event.id, { note: "returned in cash" });

    expect(result.outcome).toBe("refunded");
    if (result.outcome !== "refunded") throw new Error("unreachable");
    expect(result.event.activated_at).toBeNull();
    expect(result.event.event_token).toBeNull();
    expect(result.event.gallery_token).toBeNull();
    expect(result.event.activating_payment_id).toBeNull();
    expect(result.payment?.id).toBe(paymentId);
    expect(result.payment?.refunded_at).not.toBeNull();
    expect(result.payment?.refunded_by).toBe(operatorBId);
    expect(result.payment?.refund_note).toBe("returned in cash");

    // Regression: a refund must also clear the retention/safety-net timestamps
    // activation stamped (product.md §15.1) — otherwise a refunded, unpaid event could
    // later derive as expired/archived from a since-undone activation (decision D8 checks
    // hosted_until/grace_until before activated_at).
    expect(result.event.hosted_until).toBeNull();
    expect(result.event.grace_until).toBeNull();
    expect(result.event.safety_net_closes_at).toBeNull();
    expect(result.event.capture_opened_at).toBeNull();
    expect(result.event.capture_closed_at).toBeNull();
    expect(deriveEventLifecycleState(result.event)).toBe("draft");
  });

  it("the Operator Console's payment record carries the full confirm and refund audit trail (OPS-03)", async () => {
    const event = await createDraftEvent(hostAId, "Manual audit trail");
    // 00:30 on Oct 2 in Manila is still Oct 1 in UTC: a day-boundary paid-at.
    const paidAtIso = zonedDateTimeLocalToUtcIso("2026-10-02T00:30", event.timezone);
    expect(paidAtIso.startsWith("2026-10-01T16:30")).toBe(true);

    const confirmed = await confirmManualPayment(
      operatorBId,
      event.id,
      manualInput({ method: "bank_transfer", paidAtIso, referenceNote: "ref 123" }),
    );
    expect(confirmed.outcome).toBe("activated");

    let detail = await getOperatorEventDetail(event.id);
    let rows = Object.fromEntries(
      paymentAuditRows(detail!.payments[0], { duplicate: false, timezone: event.timezone }).map(
        (r) => [r.label, r.value],
      ),
    );
    expect(rows).toMatchObject({
      Source: "Manual",
      Method: "Bank transfer (verified)",
      Status: "Confirmed",
      Amount: "₱999",
      Currency: "PHP",
      "Paid at": "Fri, Oct 2, 2026 · 12:30 AM",
      "Confirmed by": `manual-operator-b-${suffix}@example.test`,
      Note: "ref 123",
    });
    expect(rows["Confirmed at"]).toMatch(/2026/);
    expect(rows["Refunded at"]).toBeUndefined();

    await recordManualRefund(operatorBId, event.id, { note: "returned by transfer" });

    detail = await getOperatorEventDetail(event.id);
    rows = Object.fromEntries(
      paymentAuditRows(detail!.payments[0], { duplicate: false, timezone: event.timezone }).map(
        (r) => [r.label, r.value],
      ),
    );
    expect(rows).toMatchObject({
      Status: "Refunded",
      "Refunded by": `manual-operator-b-${suffix}@example.test`,
      "Refund note": "returned by transfer",
      // The confirmation record stays after the refund.
      "Confirmed by": `manual-operator-b-${suffix}@example.test`,
      "Paid at": "Fri, Oct 2, 2026 · 12:30 AM",
    });
    expect(rows["Refunded at"]).toMatch(/2026/);
  });

  it("the sole activating manual payment is not flagged a duplicate after a valid refund", async () => {
    const event = await createDraftEvent(hostAId, "Refund not duplicate");
    const confirmed = await confirmManualPayment(operatorBId, event.id, manualInput());
    expect(confirmed.outcome).toBe("activated");
    const payment = (confirmed as Extract<ConfirmManualPaymentResult, { outcome: "activated" }>)
      .payment;

    const result = await recordManualRefund(operatorBId, event.id, { note: null });
    expect(result.outcome).toBe("refunded");
    if (result.outcome !== "refunded") throw new Error("unreachable");
    expect(result.payment?.id).toBe(payment.id);

    // The refund clears event.activating_payment_id as part of returning the event to
    // draft — that must never be misread as "this payment isn't the activating one, so
    // it's an unresolved duplicate" (the defect this test guards against).
    expect(result.event.activating_payment_id).toBeNull();
    expect(isDuplicatePayment(result.payment!, result.event)).toBe(false);
  });

  it("a genuine second successful payment still surfaces as a duplicate after the activating payment is refunded", async () => {
    const event = await createDraftEvent(hostAId, "Refund keeps real duplicates visible");
    const confirmed = await confirmManualPayment(operatorBId, event.id, manualInput());
    expect(confirmed.outcome).toBe("activated");

    // A second, genuinely distinct manual confirmation attempt after the event is
    // already active is refused outright by confirmManualPayment's own atomic guard —
    // so to model "a second payment that lost the activation race," confirm against a
    // second event and then treat that payment as if it belonged to the first event's
    // now-refunded state, exactly like isDuplicatePayment's own race-loser tests above.
    const otherEvent = await createDraftEvent(hostAId, "Other event for race-loser payment");
    const otherConfirmed = await confirmManualPayment(operatorBId, otherEvent.id, manualInput());
    expect(otherConfirmed.outcome).toBe("activated");
    const raceLoserPayment = (
      otherConfirmed as Extract<ConfirmManualPaymentResult, { outcome: "activated" }>
    ).payment;

    const result = await recordManualRefund(operatorBId, event.id, { note: null });
    expect(result.outcome).toBe("refunded");
    if (result.outcome !== "refunded") throw new Error("unreachable");

    expect(isDuplicatePayment(raceLoserPayment, result.event)).toBe(true);
  });

  it("repeated refund submissions are safe", async () => {
    const event = await createDraftEvent(hostAId, "Repeated refund");
    await confirmManualPayment(operatorBId, event.id, manualInput());

    const first = await recordManualRefund(operatorBId, event.id, { note: null });
    expect(first.outcome).toBe("refunded");

    const second = await recordManualRefund(operatorBId, event.id, { note: null });
    expect(second.outcome).toBe("not_activated");

    const stillUnpaid = await getEventForHost(hostAId, event.id);
    expect(stillUnpaid?.activated_at).toBeNull();
  });

  it("a refund is refused for an event that was never activated", async () => {
    const event = await createDraftEvent(hostAId, "Never activated");
    const result = await recordManualRefund(operatorBId, event.id, { note: null });
    expect(result.outcome).toBe("not_activated");
  });

  it("an operator cannot record a refund for an event they own", async () => {
    const event = await createDraftEvent(operatorHostId, "Owned refund attempt");
    await confirmManualPayment(operatorBId, event.id, manualInput());

    const result = await recordManualRefund(operatorHostId, event.id, { note: null });
    expect(result.outcome).toBe("owns_event");

    const stillActivated = await getEventForHost(operatorHostId, event.id);
    expect(stillActivated?.activated_at).not.toBeNull();
  });
});
