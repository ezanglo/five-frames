import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServiceClient } from "@/lib/supabase/service-client";
import {
  createDraftEvent,
  getEventForHost,
  isFreeEventAvailable,
  setEventPlan,
} from "@/lib/dal/events";
import { createGuestSession } from "@/lib/dal/guest-sessions";
import { grantOperator } from "@/lib/dal/operators";
import {
  activateEvent,
  activateFreeEvent,
  confirmManualPayment,
  FreeEventUnavailableError,
  recordManualRefund,
  recordProviderWebhookAndActivate,
  type ManualPaymentInput,
} from "@/lib/dal/payments";
import { GRACE_PERIOD_DAYS } from "@/lib/events/policy";
import { PLANS } from "@/lib/plans/registry";
import type { PaymongoWebhookEvent } from "@/lib/payments/paymongo-client";
import type { EventRow } from "@/lib/db/types";

/**
 * The Free first event (D24, product.md §7.2, criteria 71–73; architecture §8c) against the real
 * linked dev Postgres. "Once per account, ever" is an atomic guard like D5/D13/D16, so the
 * counterexamples run for real: repeated taps, drafts racing each other for Free, an operator
 * confirming a payment for the same draft at the same moment, deleting the Free event, and a
 * paid event trying to consume the claim. Each scenario gets its own host account, because the
 * claim is per account.
 */
describe("Free first event", { timeout: 120_000 }, () => {
  const supabase = createServiceClient();
  const suffix = crypto.randomUUID();
  const userIds: string[] = [];
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
      email: `free-${label}-${crypto.randomUUID().slice(0, 8)}-${suffix}@example.test`,
      password: crypto.randomUUID(),
      email_confirm: true,
    });
    if (error) throw error;
    userIds.push(data.user.id);
    return data.user.id;
  }

  beforeAll(async () => {
    operatorId = await createUser("operator");
    await grantOperator(operatorId);
  });

  afterAll(async () => {
    for (const id of userIds) await supabase.auth.admin.deleteUser(id);
  });

  async function draft(hostId: string): Promise<EventRow> {
    return createDraftEvent(hostId, `Free ${crypto.randomUUID().slice(0, 8)}`);
  }

  async function hostClaim(hostId: string) {
    const { data, error } = await supabase
      .from("hosts")
      .select("free_event_claimed_at, free_event_id")
      .eq("id", hostId)
      .single();
    if (error) throw error;
    return data as { free_event_claimed_at: string | null; free_event_id: string | null };
  }

  function expectFreeStamp(event: EventRow) {
    expect(event.activated_at).not.toBeNull();
    expect(event.plan).toBe("free");
    expect(event.activating_payment_id).toBeNull();
    expect(event.event_token).toBeTruthy();
    expect(event.gallery_token).toBeTruthy();
    expect(event.guest_session_cap).toBe(PLANS.free.guestSessionCap);
    const hostedMs = Date.parse(event.hosted_until!) - Date.parse(event.activated_at!);
    expect(Math.round(hostedMs / DAY_MS)).toBe(PLANS.free.hostedAccessDays);
    const graceMs = Date.parse(event.grace_until!) - Date.parse(event.hosted_until!);
    expect(Math.round(graceMs / DAY_MS)).toBe(GRACE_PERIOD_DAYS);
  }

  it("activates straight away with no payment, then is never offered again on the account", async () => {
    const hostId = await createUser("happy");
    expect(await isFreeEventAvailable(hostId)).toBe(true);

    const event = await draft(hostId);
    expect((await setEventPlan(hostId, event.id, "free"))?.plan).toBe("free");

    const result = await activateFreeEvent(hostId, event.id);
    expect(result.outcome).toBe("activated");
    if (result.outcome !== "activated") return;
    expectFreeStamp(result.event);

    const { count } = await supabase
      .from("payments")
      .select("id", { count: "exact", head: true })
      .eq("event_id", event.id);
    expect(count).toBe(0);

    expect(await hostClaim(hostId)).toMatchObject({ free_event_id: event.id });
    expect(await isFreeEventAvailable(hostId)).toBe(false);

    // Another draft on the same account can neither choose Free nor activate it.
    const second = await draft(hostId);
    expect(await setEventPlan(hostId, second.id, "free")).toBeNull();
    expect((await activateFreeEvent(hostId, second.id)).outcome).toBe("unavailable");
    expect((await getEventForHost(hostId, second.id))?.activated_at).toBeNull();
  });

  it("treats a repeated tap after success as the same Free event, with the same links", async () => {
    const hostId = await createUser("repeat");
    const event = await draft(hostId);
    const first = await activateFreeEvent(hostId, event.id);
    const again = await activateFreeEvent(hostId, event.id);
    expect(first.outcome).toBe("activated");
    expect(again.outcome).toBe("activated");
    if (first.outcome !== "activated" || again.outcome !== "activated") return;
    expect(again.event.event_token).toBe(first.event.event_token);
    expect(again.event.activated_at).toBe(first.event.activated_at);

    // The shared activation itself is idempotent for Free too.
    const direct = await activateEvent(event.id, { kind: "free" });
    expect(direct.activatedByThisCall).toBe(false);
    expect(direct.event.event_token).toBe(first.event.event_token);
  });

  it("gives exactly one Free event when drafts race, including repeated concurrent taps", async () => {
    const hostId = await createUser("race");
    const drafts = await Promise.all(Array.from({ length: 5 }, () => draft(hostId)));

    const results = await Promise.all(
      drafts.flatMap((d) => [activateFreeEvent(hostId, d.id), activateFreeEvent(hostId, d.id)]),
    );
    const winners = new Set(
      results.flatMap((r) => (r.outcome === "activated" ? [r.event.id] : [])),
    );
    expect(winners.size).toBe(1);
    const [winnerId] = [...winners];

    const { data: rows } = await supabase
      .from("events")
      .select("id, activated_at, plan")
      .in(
        "id",
        drafts.map((d) => d.id),
      );
    const active = rows!.filter((r) => r.activated_at);
    expect(active).toEqual([expect.objectContaining({ id: winnerId, plan: "free" })]);
    expect(await hostClaim(hostId)).toMatchObject({ free_event_id: winnerId });
  });

  it("never gives the Free event back after it is deleted", async () => {
    const hostId = await createUser("deleted");
    const event = await draft(hostId);
    expect((await activateFreeEvent(hostId, event.id)).outcome).toBe("activated");

    const { error } = await supabase.from("events").delete().eq("id", event.id);
    expect(error).toBeNull();

    expect(await isFreeEventAvailable(hostId)).toBe(false);
    const next = await draft(hostId);
    expect(await setEventPlan(hostId, next.id, "free")).toBeNull();
    expect((await activateFreeEvent(hostId, next.id)).outcome).toBe("unavailable");
  });

  it("can't be used on an event already activated by payment, and leaves the claim untouched", async () => {
    const hostId = await createUser("paid");
    const event = await draft(hostId);
    await setEventPlan(hostId, event.id, "intimate");
    expect((await confirmManualPayment(operatorId, event.id, manualInput)).outcome).toBe("activated");

    expect((await activateFreeEvent(hostId, event.id)).outcome).toBe("unavailable");
    const after = (await getEventForHost(hostId, event.id))!;
    expect(after.plan).toBe("intimate");
    expect(after.guest_session_cap).toBe(PLANS.intimate.guestSessionCap);
    expect(await hostClaim(hostId)).toEqual({ free_event_claimed_at: null, free_event_id: null });
    expect(await isFreeEventAvailable(hostId)).toBe(true);
  });

  it("activates the draft exactly once when Free and an operator's confirmation race, and never burns Free on a paid event", async () => {
    for (let round = 0; round < 4; round += 1) {
      const hostId = await createUser(`race-paid-${round}`);
      const event = await draft(hostId);
      await setEventPlan(hostId, event.id, "intimate");

      const [free, manual] = await Promise.all([
        activateFreeEvent(hostId, event.id),
        confirmManualPayment(operatorId, event.id, manualInput),
      ]);

      const after = (await getEventForHost(hostId, event.id))!;
      const claim = await hostClaim(hostId);
      if (after.plan === "free") {
        expect(free.outcome).toBe("activated");
        // The operator really received money for an event that activated Free: surfaced as a
        // duplicate for follow-up, never silently a second activation.
        expect(manual.outcome).toBe("duplicate");
        expect(after.activating_payment_id).toBeNull();
        expect(claim.free_event_id).toBe(event.id);
      } else {
        expect(after.plan).toBe("intimate");
        expect(manual.outcome).toBe("activated");
        expect(free.outcome).toBe("unavailable");
        expect(claim).toEqual({ free_event_claimed_at: null, free_event_id: null });
      }
    }
  });

  it("refuses another host's event as not found, and claims nothing", async () => {
    const hostId = await createUser("owner");
    const intruderId = await createUser("intruder");
    const event = await draft(hostId);
    expect((await activateFreeEvent(intruderId, event.id)).outcome).toBe("not_found");
    expect(await setEventPlan(intruderId, event.id, "free")).toBeNull();
    expect((await getEventForHost(hostId, event.id))?.activated_at).toBeNull();
    expect(await isFreeEventAvailable(intruderId)).toBe(true);
    expect(await isFreeEventAvailable(hostId)).toBe(true);
  });

  it("returns other drafts that had chosen Free to no plan once Free is used", async () => {
    const hostId = await createUser("others");
    const winner = await draft(hostId);
    const other = await draft(hostId);
    await setEventPlan(hostId, winner.id, "free");
    await setEventPlan(hostId, other.id, "free");
    expect((await activateFreeEvent(hostId, winner.id)).outcome).toBe("activated");
    expect((await getEventForHost(hostId, other.id))?.plan).toBeNull();
  });

  it("is never a way to activate a paid plan without payment", async () => {
    const hostId = await createUser("paid-plan");
    const event = await draft(hostId);
    await setEventPlan(hostId, event.id, "celebration");
    // The draft says Premium; Free activation still activates Free, with Free's limits.
    const result = await activateFreeEvent(hostId, event.id);
    expect(result.outcome).toBe("activated");
    if (result.outcome === "activated") expectFreeStamp(result.event);

    // The database refuses a paid plan with no payment and Free with one.
    const call = (paymentId: string | null, plan: string) =>
      supabase.rpc("activate_event", {
        p_event_id: event.id,
        p_payment_id: paymentId,
        p_plan: plan,
        p_guest_session_cap: 300,
        p_activated_at: new Date().toISOString(),
        p_hosted_until: new Date().toISOString(),
        p_grace_until: new Date().toISOString(),
        p_event_token: "x",
        p_gallery_token: "y",
      });
    expect((await call(null, "celebration")).error?.message).toContain("activation_source_mismatch");
    expect((await call(crypto.randomUUID(), "free")).error?.message).toContain(
      "activation_source_mismatch",
    );
  });

  it("throws FreeEventUnavailableError from the shared activation for a second Free event", async () => {
    const hostId = await createUser("shared");
    const first = await draft(hostId);
    const second = await draft(hostId);
    await activateEvent(first.id, { kind: "free" });
    await expect(activateEvent(second.id, { kind: "free" })).rejects.toBeInstanceOf(
      FreeEventUnavailableError,
    );
    expect((await getEventForHost(hostId, second.id))?.activated_at).toBeNull();
  });

  it("has nothing to refund", async () => {
    const hostId = await createUser("refund");
    const event = await draft(hostId);
    await activateFreeEvent(hostId, event.id);
    expect((await recordManualRefund(operatorId, event.id, { note: null })).outcome).toBe("free_event");
    expect((await getEventForHost(hostId, event.id))?.activated_at).not.toBeNull();
  });

  it("flags a late webhook for a checkout started before Free activation as a duplicate payment", async () => {
    const hostId = await createUser("late-webhook");
    const event = await draft(hostId);
    await setEventPlan(hostId, event.id, "intimate");
    const sessionId = `cs_free_${crypto.randomUUID()}`;
    const { data: payment, error } = await supabase
      .from("payments")
      .insert({
        event_id: event.id,
        source: "provider",
        plan: "intimate",
        provider_checkout_session_id: sessionId,
        checkout_url: `https://checkout.paymongo.com/${sessionId}`,
        provider_status: "pending",
        amount: 49_900,
        currency: "PHP",
      })
      .select("id")
      .single();
    if (error) throw error;

    await activateFreeEvent(hostId, event.id);
    // Free activation supersedes the pending checkout, the same as a paid activation would.
    const { data: superseded } = await supabase
      .from("payments")
      .select("provider_status")
      .eq("id", payment.id)
      .single();
    expect(superseded?.provider_status).toBe("superseded");

    const webhook: PaymongoWebhookEvent = {
      id: `evt_${crypto.randomUUID()}`,
      type: "checkout_session.payment.paid",
      livemode: false,
      checkoutSession: {
        id: sessionId,
        referenceNumber: null,
        payments: [{ amount: 49_900, currency: "PHP", fee: 0 }],
      },
    };
    expect(await recordProviderWebhookAndActivate(webhook)).toEqual({ handled: true, duplicate: true });
    const after = (await getEventForHost(hostId, event.id))!;
    expect(after.plan).toBe("free");
    expect(after.activating_payment_id).toBeNull();
  });

  it("admits exactly the Free cap under concurrent joins (criterion 73)", async () => {
    const hostId = await createUser("cap");
    const event = await draft(hostId);
    const result = await activateFreeEvent(hostId, event.id);
    if (result.outcome !== "activated") throw new Error("expected activated");

    const joins = await Promise.all(
      Array.from({ length: PLANS.free.guestSessionCap + 5 }, (_, i) =>
        createGuestSession(event.id, `Guest ${i}`),
      ),
    );
    expect(joins.filter((j) => j.kind === "joined")).toHaveLength(PLANS.free.guestSessionCap);
    expect(joins.filter((j) => j.kind === "at_capacity")).toHaveLength(5);
  });
});
