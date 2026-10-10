import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServiceClient } from "@/lib/supabase/service-client";
import { createDraftEvent, getEventForHost, setEventPlan } from "@/lib/dal/events";
import { createGuestSession } from "@/lib/dal/guest-sessions";
import { grantOperator } from "@/lib/dal/operators";
import {
  activateEvent,
  confirmManualPayment,
  recordProviderWebhookAndActivate,
  type ManualPaymentInput,
} from "@/lib/dal/payments";
import { GRACE_PERIOD_DAYS } from "@/lib/events/policy";
import { PLANS, type PaidPlanId } from "@/lib/plans/registry";
import type { PaymongoWebhookEvent } from "@/lib/payments/paymongo-client";
import type { EventRow } from "@/lib/db/types";

/**
 * Plans (D24, architecture §8c), against the real linked dev Postgres. Activation and event
 * capacity are load-bearing guards (CLAUDE.md "Verification"), so the counterexamples run for
 * real: a draft whose plan changes after a checkout was created, two payments for different
 * plans racing one event, and concurrent joins at a plan's exact capacity.
 */
describe("plans", () => {
  const supabase = createServiceClient();
  const suffix = crypto.randomUUID();
  let hostId: string;
  let otherHostId: string;
  let operatorId: string;

  const DAY_MS = 24 * 60 * 60 * 1000;
  const manualInput: ManualPaymentInput = {
    method: "cash",
    amountCentavos: 49_900,
    currency: "PHP",
    paidAtIso: new Date().toISOString(),
    referenceNote: null,
  };

  async function createUser(label: string): Promise<string> {
    const { data, error } = await supabase.auth.admin.createUser({
      email: `plans-${label}-${suffix}@example.test`,
      password: crypto.randomUUID(),
      email_confirm: true,
    });
    if (error) throw error;
    return data.user.id;
  }

  beforeAll(async () => {
    hostId = await createUser("host");
    otherHostId = await createUser("other");
    operatorId = await createUser("operator");
    await grantOperator(operatorId);
  });

  afterAll(async () => {
    for (const id of [hostId, otherHostId, operatorId]) {
      if (id) await supabase.auth.admin.deleteUser(id);
    }
  });

  async function draftWithPlan(plan: PaidPlanId | null): Promise<EventRow> {
    const event = await createDraftEvent(hostId, `Plans ${suffix}`);
    if (!plan) return event;
    const updated = await setEventPlan(hostId, event.id, plan);
    expect(updated?.plan).toBe(plan);
    return updated!;
  }

  async function insertProviderPayment(
    eventId: string,
    plan: PaidPlanId | null,
  ): Promise<{ id: string; sessionId: string }> {
    const sessionId = `cs_plans_${crypto.randomUUID()}`;
    const { data, error } = await supabase
      .from("payments")
      .insert({
        event_id: eventId,
        source: "provider",
        plan,
        provider_checkout_session_id: sessionId,
        checkout_url: `https://checkout.paymongo.com/${sessionId}`,
        // Not "pending": the one-active-checkout index allows only one pending row per event,
        // and these tests need several. Webhook handling doesn't read this status.
        provider_status: "superseded",
        amount: plan ? PLANS[plan].pricePhp * 100 : 99_900,
        currency: "PHP",
      })
      .select("id")
      .single();
    if (error) throw error;
    return { id: data.id as string, sessionId };
  }

  function paid(sessionId: string): PaymongoWebhookEvent {
    return {
      id: `evt_${crypto.randomUUID()}`,
      type: "checkout_session.payment.paid",
      livemode: false,
      checkoutSession: {
        id: sessionId,
        referenceNumber: null,
        payments: [{ amount: 49_900, currency: "PHP", fee: 0 }],
      },
    };
  }

  function expectStampedFor(event: EventRow, plan: PaidPlanId) {
    expect(event.plan).toBe(plan);
    expect(event.guest_session_cap).toBe(PLANS[plan].guestSessionCap);
    const hostedMs = Date.parse(event.hosted_until!) - Date.parse(event.activated_at!);
    expect(Math.round(hostedMs / DAY_MS)).toBe(PLANS[plan].hostedAccessDays);
    const graceMs = Date.parse(event.grace_until!) - Date.parse(event.hosted_until!);
    expect(Math.round(graceMs / DAY_MS)).toBe(GRACE_PERIOD_DAYS);
  }

  describe("choosing a plan", () => {
    it("lets only the owner choose, and only while Draft", async () => {
      const event = await draftWithPlan(null);
      expect(event.plan).toBeNull();

      expect(await setEventPlan(otherHostId, event.id, "celebration")).toBeNull();
      expect((await getEventForHost(hostId, event.id))?.plan).toBeNull();

      await setEventPlan(hostId, event.id, "intimate");
      await confirmManualPayment(operatorId, event.id, manualInput);

      // A stale Share-step tab can't change a running event's plan.
      expect(await setEventPlan(hostId, event.id, "celebration")).toBeNull();
      expect((await getEventForHost(hostId, event.id))?.plan).toBe("intimate");
    });
  });

  describe("manual confirmation", () => {
    it("has nothing to confirm until the host chooses a paid plan", async () => {
      const event = await draftWithPlan(null);
      const result = await confirmManualPayment(operatorId, event.id, manualInput);
      expect(result.outcome).toBe("plan_not_chosen");

      const { count } = await supabase
        .from("payments")
        .select("id", { count: "exact", head: true })
        .eq("event_id", event.id);
      expect(count).toBe(0);
      expect((await getEventForHost(hostId, event.id))?.activated_at).toBeNull();
    });

    it("records the plan on the payment and stamps its capacity and hosted access", async () => {
      const event = await draftWithPlan("intimate");
      const result = await confirmManualPayment(operatorId, event.id, manualInput);
      expect(result.outcome).toBe("activated");
      if (result.outcome !== "activated") return;

      expect(result.payment.plan).toBe("intimate");
      expectStampedFor(result.event, "intimate");
    });
  });

  describe("activation takes the plan from what was paid for", () => {
    it("activates the paid plan even after the draft moved to another one", async () => {
      // Host started a checkout on Intimate, then switched the draft to Celebration. The
      // Intimate checkout is paid anyway (late webhook): the host bought Intimate.
      const event = await draftWithPlan("intimate");
      const intimate = await insertProviderPayment(event.id, "intimate");
      await setEventPlan(hostId, event.id, "celebration");

      const result = await recordProviderWebhookAndActivate(paid(intimate.sessionId));
      expect(result).toEqual({ handled: true, duplicate: false });

      const activated = (await getEventForHost(hostId, event.id))!;
      expect(activated.activating_payment_id).toBe(intimate.id);
      expectStampedFor(activated, "intimate");
    });

    it("reads a payment from before plans as Celebration", async () => {
      const event = await draftWithPlan(null);
      const legacy = await insertProviderPayment(event.id, null);
      await recordProviderWebhookAndActivate(paid(legacy.sessionId));
      expectStampedFor((await getEventForHost(hostId, event.id))!, "celebration");
    });

    it("keeps plan, capacity and access consistent when two plans' payments race", async () => {
      const event = await draftWithPlan("celebration");
      const intimate = await insertProviderPayment(event.id, "intimate");
      const celebration = await insertProviderPayment(event.id, "celebration");

      const results = await Promise.all([
        activateEvent(event.id, { kind: "payment", paymentId: intimate.id }),
        activateEvent(event.id, { kind: "payment", paymentId: celebration.id }),
      ]);
      expect(results.filter((r) => r.activatedByThisCall)).toHaveLength(1);

      const activated = (await getEventForHost(hostId, event.id))!;
      const winner: PaidPlanId = activated.activating_payment_id === intimate.id ? "intimate" : "celebration";
      expectStampedFor(activated, winner);
    });

    it("refuses to activate with a payment that belongs to a different event", async () => {
      const event = await draftWithPlan("intimate");
      const elsewhere = await draftWithPlan("celebration");
      const foreign = await insertProviderPayment(elsewhere.id, "celebration");
      await expect(activateEvent(event.id, { kind: "payment", paymentId: foreign.id })).rejects.toBeTruthy();
      expect((await getEventForHost(hostId, event.id))?.activated_at).toBeNull();
    });
  });

  describe("begin_provider_checkout_for_plan", () => {
    type Begin = {
      payment_id: string | null;
      is_new: boolean;
      already_activated: boolean;
      plan: string | null;
      superseded_checkout_session_id: string | null;
    };
    const begin = async (eventId: string) =>
      supabase.rpc("begin_provider_checkout_for_plan", { p_event_id: eventId }).single<Begin>();

    it("refuses a draft with no paid plan", async () => {
      const event = await draftWithPlan(null);
      const { error } = await begin(event.id);
      expect(error?.message).toContain("plan_not_payable");
    });

    it("reuses a pending checkout for the same plan, and supersedes one for another plan", async () => {
      const event = await draftWithPlan("intimate");

      const first = await begin(event.id);
      expect(first.error).toBeNull();
      expect(first.data).toMatchObject({ is_new: true, plan: "intimate" });
      // Fill it in the way createAndStoreCheckoutSession would.
      await supabase
        .from("payments")
        .update({ provider_checkout_session_id: "cs_plan_switch", checkout_url: "https://x.test" })
        .eq("id", first.data!.payment_id!);

      const again = await begin(event.id);
      expect(again.data).toMatchObject({ is_new: false, payment_id: first.data!.payment_id });

      await setEventPlan(hostId, event.id, "celebration");
      const switched = await begin(event.id);
      expect(switched.data).toMatchObject({
        is_new: true,
        plan: "celebration",
        superseded_checkout_session_id: "cs_plan_switch",
      });

      const { data: rows } = await supabase
        .from("payments")
        .select("id, plan, provider_status")
        .eq("event_id", event.id);
      const pending = (rows ?? []).filter((r) => r.provider_status === "pending");
      expect(pending).toEqual([
        expect.objectContaining({ id: switched.data!.payment_id, plan: "celebration" }),
      ]);
      expect(rows).toContainEqual(
        expect.objectContaining({ id: first.data!.payment_id, provider_status: "superseded" }),
      );
    });

    it("creates exactly one pending checkout under concurrent starts", async () => {
      const event = await draftWithPlan("celebration");
      const results = await Promise.all(Array.from({ length: 6 }, () => begin(event.id)));
      for (const r of results) expect(r.error).toBeNull();
      expect(results.filter((r) => r.data!.is_new)).toHaveLength(1);
      const { count } = await supabase
        .from("payments")
        .select("id", { count: "exact", head: true })
        .eq("event_id", event.id)
        .eq("provider_status", "pending");
      expect(count).toBe(1);
    });
  });

  describe("capacity holds at each paid plan's cap under concurrent joins", () => {
    it.each(["intimate", "celebration"] as const)(
      "%s admits exactly its cap",
      async (plan) => {
        const event = await draftWithPlan(plan);
        await confirmManualPayment(operatorId, event.id, manualInput);
        const cap = PLANS[plan].guestSessionCap;

        const attempts = cap + 5;
        const outcomes = [];
        // In waves, so the test measures the guard rather than the API's connection limits.
        for (let start = 0; start < attempts; start += 50) {
          const wave = Array.from({ length: Math.min(50, attempts - start) }, (_, i) =>
            createGuestSession(event.id, `Guest ${start + i}`),
          );
          outcomes.push(...(await Promise.all(wave)));
        }

        expect(outcomes.filter((o) => o.kind === "joined")).toHaveLength(cap);
        expect(outcomes.filter((o) => o.kind === "at_capacity")).toHaveLength(5);
        const after = (await getEventForHost(hostId, event.id))!;
        expect(after.guest_session_count).toBe(cap);
      },
      120_000,
    );
  });
});
