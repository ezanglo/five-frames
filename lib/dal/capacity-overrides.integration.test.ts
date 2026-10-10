import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServiceClient } from "@/lib/supabase/service-client";
import { createDraftEvent, setEventPlan } from "@/lib/dal/events";
import { createGuestSession } from "@/lib/dal/guest-sessions";
import { grantOperator } from "@/lib/dal/operators";
import { activateFreeEvent, confirmManualPayment } from "@/lib/dal/payments";
import {
  listCapacityOverridesForOperator,
  overrideGuestCapacity,
  type OverrideGuestCapacityResult,
} from "@/lib/dal/capacity-overrides";
import { PLANS } from "@/lib/plans/registry";
import type { CapacityOverrideRow, EventRow } from "@/lib/db/types";

/**
 * Operator capacity override (D24, product.md §9.5, criterion 76; architecture §6a) against the
 * real linked dev Postgres. CLAUDE.md requires a concurrency test for changes to event-join
 * capacity, so the counterexamples run for real: overrides racing each other, joins racing an
 * override, the SQL function called directly with values the DAL would refuse, and the service
 * role trying to edit or delete the permanent log.
 */
describe("operator capacity override", { timeout: 120_000 }, () => {
  const supabase = createServiceClient();
  const suffix = crypto.randomUUID();
  const userIds: string[] = [];
  let operatorId: string;
  let operatorBId: string;
  let operatorEmail: string;

  async function createUser(label: string): Promise<{ id: string; email: string }> {
    const email = `cap-${label}-${crypto.randomUUID().slice(0, 8)}-${suffix}@example.test`;
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password: crypto.randomUUID(),
      email_confirm: true,
    });
    if (error) throw error;
    userIds.push(data.user.id);
    return { id: data.user.id, email };
  }

  beforeAll(async () => {
    const operator = await createUser("operator");
    operatorId = operator.id;
    operatorEmail = operator.email;
    await grantOperator(operatorId);
    operatorBId = (await createUser("operator-b")).id;
    await grantOperator(operatorBId);
  });

  afterAll(async () => {
    // Hosts first: a log row's operator can't be removed while the row exists, and the hosts'
    // events (and so their log rows) go with them.
    for (const id of [...userIds].reverse()) await supabase.auth.admin.deleteUser(id);
  });

  /** A fresh host's Free event: activated, capacity 10. */
  async function activeFreeEvent(hostId?: string): Promise<EventRow> {
    const owner = hostId ?? (await createUser("host")).id;
    const event = await createDraftEvent(owner, `Cap ${crypto.randomUUID().slice(0, 8)}`);
    const result = await activateFreeEvent(owner, event.id);
    if (result.outcome !== "activated") throw new Error(`Free activation: ${result.outcome}`);
    return result.event;
  }

  async function readEvent(eventId: string): Promise<EventRow> {
    const { data, error } = await supabase.from("events").select().eq("id", eventId).single();
    if (error) throw error;
    return data as EventRow;
  }

  async function logRows(eventId: string): Promise<CapacityOverrideRow[]> {
    const { data, error } = await supabase
      .from("capacity_overrides")
      .select()
      .eq("event_id", eventId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return data as CapacityOverrideRow[];
  }

  async function sessionRows(eventId: string): Promise<number> {
    const { count, error } = await supabase
      .from("guest_sessions")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId);
    if (error) throw error;
    return count ?? 0;
  }

  async function join(eventId: string, n: number) {
    return Promise.all(Array.from({ length: n }, (_, i) => createGuestSession(eventId, `G${i}`)));
  }

  /** Each entry's previous cap is the one before it's new cap, from `start` to the event's cap. */
  function expectUnbrokenChain(rows: CapacityOverrideRow[], start: number, finalCap: number) {
    let cap = start;
    for (const row of rows) {
      expect(row.previous_cap).toBe(cap);
      expect(row.new_cap).toBeGreaterThan(row.previous_cap);
      cap = row.new_cap;
    }
    expect(cap).toBe(finalCap);
  }

  it("raises a Free event's capacity and logs it, changing nothing else", async () => {
    const before = await activeFreeEvent();
    expect(before.guest_session_cap).toBe(PLANS.free.guestSessionCap);

    const result = await overrideGuestCapacity(operatorId, before.id, {
      newCap: 25,
      reason: "  Party grew, agreed on Viber  ",
    });
    expect(result.outcome).toBe("raised");
    const entry = (result as Extract<OverrideGuestCapacityResult, { outcome: "raised" }>).entry;
    expect(entry).toMatchObject({
      event_id: before.id,
      previous_cap: 10,
      new_cap: 25,
      reason: "Party grew, agreed on Viber",
      operator_id: operatorId,
    });

    const after = await readEvent(before.id);
    expect(after.guest_session_cap).toBe(25);
    // Capacity only: no plan, access period, activation or token change, and no payment.
    expect(after.plan).toBe("free");
    expect(after.hosted_until).toBe(before.hosted_until);
    expect(after.grace_until).toBe(before.grace_until);
    expect(after.activated_at).toBe(before.activated_at);
    expect(after.event_token).toBe(before.event_token);
    expect(after.activating_payment_id).toBeNull();
    const { count } = await supabase
      .from("payments")
      .select("id", { count: "exact", head: true })
      .eq("event_id", before.id);
    expect(count).toBe(0);

    const history = await listCapacityOverridesForOperator(before.id);
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ id: entry.id, operatorEmail });
  });

  it("raises a paid event without touching its payment or plan, and lists history newest first", async () => {
    const host = await createUser("paid");
    const draft = await createDraftEvent(host.id, "Cap paid");
    await setEventPlan(host.id, draft.id, "intimate");
    const confirmed = await confirmManualPayment(operatorBId, draft.id, {
      method: "cash",
      amountCentavos: 49_900,
      currency: "PHP",
      paidAtIso: new Date().toISOString(),
      referenceNote: null,
    });
    expect(confirmed.outcome).toBe("activated");
    const before = await readEvent(draft.id);
    expect(before.guest_session_cap).toBe(PLANS.intimate.guestSessionCap);

    expect((await overrideGuestCapacity(operatorId, draft.id, { newCap: 150, reason: "a" })).outcome).toBe("raised");
    expect((await overrideGuestCapacity(operatorBId, draft.id, { newCap: 180, reason: "b" })).outcome).toBe("raised");

    const after = await readEvent(draft.id);
    expect(after.guest_session_cap).toBe(180);
    expect(after.plan).toBe("intimate");
    expect(after.hosted_until).toBe(before.hosted_until);
    expect(after.activating_payment_id).toBe(before.activating_payment_id);
    const { data: payments } = await supabase.from("payments").select("id").eq("event_id", draft.id);
    expect(payments).toHaveLength(1);

    const history = await listCapacityOverridesForOperator(draft.id);
    expect(history.map((h) => [h.previous_cap, h.new_cap, h.reason])).toEqual([
      [150, 180, "b"],
      [100, 150, "a"],
    ]);
  });

  it("lets a guest who was turned away as full join as soon as capacity is raised", async () => {
    const event = await activeFreeEvent();
    const filled = await join(event.id, 10);
    expect(filled.every((o) => o.kind === "joined")).toBe(true);
    expect((await createGuestSession(event.id, "Late")).kind).toBe("at_capacity");

    await overrideGuestCapacity(operatorId, event.id, { newCap: 12, reason: "Two more" });

    expect((await createGuestSession(event.id, "Late")).kind).toBe("joined");
    // Exactly the raise's worth more, even under concurrency.
    const rush = await join(event.id, 6);
    expect(rush.filter((o) => o.kind === "joined")).toHaveLength(1);
    const after = await readEvent(event.id);
    expect(after.guest_session_count).toBe(12);
    expect(await sessionRows(event.id)).toBe(12);
  });

  it("refuses a lower or equal cap, a blank or overlong reason, a typo-sized cap, and a draft", async () => {
    const event = await activeFreeEvent();
    const cases: [Parameters<typeof overrideGuestCapacity>[2], string][] = [
      [{ newCap: 9, reason: "lower" }, "not_a_raise"],
      [{ newCap: 10, reason: "equal" }, "not_a_raise"],
      [{ newCap: 20, reason: "   " }, "reason_required"],
      [{ newCap: 20, reason: "x".repeat(501) }, "reason_too_long"],
      [{ newCap: 5001, reason: "typo" }, "cap_too_large"],
      [{ newCap: 12.5, reason: "fraction" }, "cap_too_large"],
    ];
    for (const [input, outcome] of cases) {
      expect((await overrideGuestCapacity(operatorId, event.id, input)).outcome).toBe(outcome);
    }
    expect((await overrideGuestCapacity(operatorId, event.id, { newCap: 9, reason: "lower" })))
      .toMatchObject({ currentCap: 10 });

    const host = await createUser("draft");
    const draft = await createDraftEvent(host.id, "Cap draft");
    expect((await overrideGuestCapacity(operatorId, draft.id, { newCap: 20, reason: "draft" })).outcome).toBe("not_activated");
    expect(
      (await overrideGuestCapacity(operatorId, crypto.randomUUID(), { newCap: 20, reason: "none" })).outcome,
    ).toBe("not_found");

    // Exactly 5,000 is allowed.
    expect((await overrideGuestCapacity(operatorId, event.id, { newCap: 5000, reason: "max" })).outcome).toBe("raised");
    expect((await readEvent(event.id)).guest_session_cap).toBe(5000);
    expect(await logRows(event.id)).toHaveLength(1);
    expect(await logRows(draft.id)).toHaveLength(0);
  });

  it("refuses an operator's own event and a caller who isn't an operator", async () => {
    const own = await activeFreeEvent(operatorId);
    expect((await overrideGuestCapacity(operatorId, own.id, { newCap: 20, reason: "mine" })).outcome).toBe("owns_event");

    const event = await activeFreeEvent();
    const plain = await createUser("not-operator");
    expect((await overrideGuestCapacity(plain.id, event.id, { newCap: 20, reason: "me" })).outcome).toBe("not_operator");

    expect((await readEvent(own.id)).guest_session_cap).toBe(10);
    expect((await readEvent(event.id)).guest_session_cap).toBe(10);
    expect(await logRows(own.id)).toHaveLength(0);
    expect(await logRows(event.id)).toHaveLength(0);
  });

  it("refuses in SQL on its own, without the DAL's checks", async () => {
    const own = await activeFreeEvent(operatorBId);
    const event = await activeFreeEvent();
    const host = await createUser("sql-draft");
    const draft = await createDraftEvent(host.id, "Cap sql draft");
    const plain = await createUser("sql-plain");

    const call = (eventId: string, operator: string, cap: number, reason: string) =>
      supabase.rpc("override_guest_capacity", {
        p_event_id: eventId,
        p_operator_id: operator,
        p_new_cap: cap,
        p_reason: reason,
      });
    const refusals: [Awaited<ReturnType<typeof call>>, string][] = [
      [await call(own.id, operatorBId, 20, "mine"), "owns_event"],
      [await call(event.id, operatorId, 10, "equal"), "not_a_raise"],
      [await call(event.id, operatorId, 5, "lower"), "not_a_raise"],
      [await call(event.id, operatorId, 20, " "), "reason_required"],
      [await call(event.id, operatorId, 5001, "typo"), "cap_too_large"],
      [await call(event.id, plain.id, 20, "not me"), "not_operator"],
      [await call(draft.id, operatorId, 20, "draft"), "not_activated"],
    ];
    for (const [{ error }, message] of refusals) {
      expect(error?.code).toBe("P0006");
      expect(error?.message).toBe(message);
    }
    expect((await readEvent(event.id)).guest_session_cap).toBe(10);
    expect(await logRows(event.id)).toHaveLength(0);
    expect(await logRows(own.id)).toHaveLength(0);
  });

  it("serializes concurrent overrides, so each entry's previous cap is the cap it replaced", async () => {
    for (let round = 0; round < 3; round++) {
      const event = await activeFreeEvent();
      const caps = [15, 20, 25, 30, 35, 40];
      const results = await Promise.all(
        caps.map((newCap, i) =>
          overrideGuestCapacity(i % 2 ? operatorBId : operatorId, event.id, {
            newCap,
            reason: `round ${round} to ${newCap}`,
          }),
        ),
      );
      for (const r of results) expect(["raised", "not_a_raise"]).toContain(r.outcome);

      const rows = await logRows(event.id);
      expect(rows).toHaveLength(results.filter((r) => r.outcome === "raised").length);
      // 40 is a raise over anything else, so it always applies and is always last.
      const finalCap = (await readEvent(event.id)).guest_session_cap;
      expect(finalCap).toBe(40);
      expectUnbrokenChain(rows, 10, finalCap);
    }
  });

  it("never lets joins racing an override exceed the cap in force", async () => {
    for (let round = 0; round < 3; round++) {
      const event = await activeFreeEvent();
      await join(event.id, 8);

      const [joins, override] = await Promise.all([
        join(event.id, 10),
        overrideGuestCapacity(operatorId, event.id, { newCap: 12, reason: `race ${round}` }),
      ]);
      expect(override.outcome).toBe("raised");

      const after = await readEvent(event.id);
      const joined = joins.filter((o) => o.kind === "joined").length;
      expect(after.guest_session_cap).toBe(12);
      // At least the two free seats under the old cap fill; never more than the new cap.
      expect(after.guest_session_count).toBeGreaterThanOrEqual(10);
      expect(after.guest_session_count).toBeLessThanOrEqual(12);
      expect(after.guest_session_count).toBe(8 + joined);
      expect(await sessionRows(event.id)).toBe(after.guest_session_count);
    }
  });

  it("keeps the log append-only for the service role, while a host-account delete still removes it", async () => {
    const host = await createUser("cascade");
    const event = await activeFreeEvent(host.id);
    const result = await overrideGuestCapacity(operatorId, event.id, { newCap: 20, reason: "keep" });
    const entry = (result as Extract<OverrideGuestCapacityResult, { outcome: "raised" }>).entry;

    const update = await supabase
      .from("capacity_overrides")
      .update({ reason: "edited", new_cap: 9999 })
      .eq("id", entry.id);
    expect(update.error?.code).toBe("42501");
    const remove = await supabase.from("capacity_overrides").delete().eq("id", entry.id);
    expect(remove.error?.code).toBe("42501");
    expect((await logRows(event.id))[0]).toMatchObject({ reason: "keep", new_cap: 20 });

    // An entry can't be inserted that isn't a raise or has no reason, even directly.
    const bad = await supabase.from("capacity_overrides").insert({
      event_id: event.id,
      previous_cap: 20,
      new_cap: 20,
      reason: " ",
      operator_id: operatorId,
    });
    expect(bad.error?.code).toBe("23514");

    const { error } = await supabase.auth.admin.deleteUser(host.id);
    expect(error).toBeNull();
    userIds.splice(userIds.indexOf(host.id), 1);
    const { data: gone } = await supabase.from("capacity_overrides").select("id").eq("id", entry.id);
    expect(gone).toEqual([]);
  });
});
