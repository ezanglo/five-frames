import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServiceClient } from "@/lib/supabase/service-client";
import {
  createDraftEvent,
  getEventByGalleryToken,
  getEventForHost,
  revokeEventToken,
  revokeGalleryToken,
  rotateEventToken,
  rotateGalleryToken,
  updateEventConfig,
} from "@/lib/dal/events";
import { createGuestSession } from "@/lib/dal/guest-sessions";

/**
 * Runs against the real linked dev Postgres (architecture §11): the ownership
 * predicate is the actual security boundary here (DAL discipline, decision D4), so it
 * is worth proving against a real database rather than a mock.
 */
describe("event ownership isolation", () => {
  const supabase = createServiceClient();
  const suffix = crypto.randomUUID();
  let hostAId: string;
  let hostBId: string;

  beforeAll(async () => {
    const { data: hostA, error: errorA } = await supabase.auth.admin.createUser({
      email: `host-a-${suffix}@example.test`,
      password: crypto.randomUUID(),
      email_confirm: true,
    });
    if (errorA) throw errorA;
    hostAId = hostA.user.id;

    const { data: hostB, error: errorB } = await supabase.auth.admin.createUser({
      email: `host-b-${suffix}@example.test`,
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

  it("never returns another host's event", async () => {
    const event = await createDraftEvent(hostAId, "Host A's Wedding");

    const asOwner = await getEventForHost(hostAId, event.id);
    expect(asOwner?.id).toBe(event.id);

    const asOther = await getEventForHost(hostBId, event.id);
    expect(asOther).toBeNull();
  });

  it("never lets another host update an event, and leaves it unchanged", async () => {
    const event = await createDraftEvent(hostAId, "Original name");

    const result = await updateEventConfig(hostBId, event.id, {
      name: "Renamed by an intruder",
    });
    expect(result).toBeNull();

    const stillOwned = await getEventForHost(hostAId, event.id);
    expect(stillOwned?.name).toBe("Original name");
  });
});

/**
 * Roadmap Slice 5: link rotation/revocation (product.md §8.1) and its interaction with
 * the ownership predicate (invariant 9) and the "must be activated" gate (invariant 7 —
 * a draft event never has a working link to rotate into existence).
 */
describe("link rotation and revocation", () => {
  const supabase = createServiceClient();
  const suffix = crypto.randomUUID();
  let hostAId: string;
  let hostBId: string;

  beforeAll(async () => {
    const { data: hostA, error: errorA } = await supabase.auth.admin.createUser({
      email: `link-host-a-${suffix}@example.test`,
      password: crypto.randomUUID(),
      email_confirm: true,
    });
    if (errorA) throw errorA;
    hostAId = hostA.user.id;

    const { data: hostB, error: errorB } = await supabase.auth.admin.createUser({
      email: `link-host-b-${suffix}@example.test`,
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

  async function createActivatedEvent(hostId: string) {
    const event = await createDraftEvent(hostId, `Link test ${crypto.randomUUID()}`);
    const { data, error } = await supabase
      .from("events")
      .update({
        activated_at: new Date().toISOString(),
        event_token: `seed-event-${crypto.randomUUID()}`,
        gallery_token: `seed-gallery-${crypto.randomUUID()}`,
      })
      .eq("id", event.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  it("rotating the gallery token immediately invalidates the old one", async () => {
    const event = await createActivatedEvent(hostAId);
    const oldToken = event.gallery_token as string;

    const rotated = await rotateGalleryToken(hostAId, event.id);
    expect(rotated?.gallery_token).toBeTruthy();
    expect(rotated?.gallery_token).not.toBe(oldToken);

    const byOldToken = await getEventByGalleryToken(oldToken);
    expect(byOldToken).toBeNull();

    const byNewToken = await getEventByGalleryToken(rotated!.gallery_token as string);
    expect(byNewToken?.id).toBe(event.id);
  });

  it("revoking the gallery token clears it so no token resolves to the event", async () => {
    const event = await createActivatedEvent(hostAId);
    const oldToken = event.gallery_token as string;

    const revoked = await revokeGalleryToken(hostAId, event.id);
    expect(revoked?.gallery_token).toBeNull();

    const byOldToken = await getEventByGalleryToken(oldToken);
    expect(byOldToken).toBeNull();
  });

  it("rotating the event (capture) token invalidates the old one the same way", async () => {
    const event = await createActivatedEvent(hostAId);
    const oldToken = event.event_token as string;

    const rotated = await rotateEventToken(hostAId, event.id);
    expect(rotated?.event_token).toBeTruthy();
    expect(rotated?.event_token).not.toBe(oldToken);
  });

  it("revoking the event token clears it", async () => {
    const event = await createActivatedEvent(hostAId);
    const revoked = await revokeEventToken(hostAId, event.id);
    expect(revoked?.event_token).toBeNull();
  });

  it("refuses to rotate or revoke a link for an event another host owns", async () => {
    const event = await createActivatedEvent(hostAId);
    const originalGalleryToken = event.gallery_token;

    const rotateResult = await rotateGalleryToken(hostBId, event.id);
    expect(rotateResult).toBeNull();

    const revokeResult = await revokeEventToken(hostBId, event.id);
    expect(revokeResult).toBeNull();

    const stillOwned = await getEventForHost(hostAId, event.id);
    expect(stillOwned?.gallery_token).toBe(originalGalleryToken);
    expect(stillOwned?.event_token).toBeTruthy();
  });

  it("refuses to rotate or revoke a link before the event is activated", async () => {
    const draft = await createDraftEvent(hostAId, "Still a draft");
    expect(draft.activated_at).toBeNull();

    const rotateResult = await rotateGalleryToken(hostAId, draft.id);
    expect(rotateResult).toBeNull();

    const revokeResult = await revokeEventToken(hostAId, draft.id);
    expect(revokeResult).toBeNull();
  });
});

/**
 * Roadmap Slice 6: the event join-capacity mechanism (product.md §9.5, decision D13). Same
 * class of concurrency risk as the frame mechanism (D5/D6) — a "count then insert" race —
 * proven here against the real database the way `captures.integration.test.ts` proves the
 * frame mechanism, rather than assuming the atomic UPDATE pattern behaves as designed.
 */
describe("event join-capacity boundary", () => {
  const supabase = createServiceClient();
  const suffix = crypto.randomUUID();
  let hostId: string;

  beforeAll(async () => {
    const { data, error } = await supabase.auth.admin.createUser({
      email: `capacity-host-${suffix}@example.test`,
      password: crypto.randomUUID(),
      email_confirm: true,
    });
    if (error) throw error;
    hostId = data.user.id;
  });

  afterAll(async () => {
    if (hostId) await supabase.auth.admin.deleteUser(hostId);
  });

  async function createOpenEventWithCap(cap: number) {
    const event = await createDraftEvent(hostId, `Capacity test ${crypto.randomUUID()}`);
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("events")
      .update({
        activated_at: now,
        capture_opened_at: now,
        guest_session_cap: cap,
      })
      .eq("id", event.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  it("never lets concurrent joins push guest_session_count past guest_session_cap", async () => {
    const event = await createOpenEventWithCap(5);

    const results = await Promise.all(
      Array.from({ length: 8 }, (_, i) =>
        createGuestSession(event.id, `Concurrent guest ${i}`),
      ),
    );

    const joined = results.filter((r) => r.kind === "joined");
    const atCapacity = results.filter((r) => r.kind === "at_capacity");
    expect(joined).toHaveLength(5);
    expect(atCapacity).toHaveLength(3);

    const { count, error } = await supabase
      .from("guest_sessions")
      .select("id", { count: "exact", head: true })
      .eq("event_id", event.id);
    if (error) throw error;
    expect(count).toBe(5);

    const { data: refreshed, error: refreshError } = await supabase
      .from("events")
      .select("guest_session_count")
      .eq("id", event.id)
      .single();
    if (refreshError) throw refreshError;
    expect(refreshed.guest_session_count).toBe(5);
  });

  it("refuses a join exactly at capacity and creates no guest_sessions row", async () => {
    const event = await createOpenEventWithCap(1);

    const first = await createGuestSession(event.id, "First guest");
    expect(first.kind).toBe("joined");

    const second = await createGuestSession(event.id, "Second guest");
    expect(second.kind).toBe("at_capacity");

    const { count, error } = await supabase
      .from("guest_sessions")
      .select("id", { count: "exact", head: true })
      .eq("event_id", event.id);
    if (error) throw error;
    expect(count).toBe(1);
  });

  it("leaves guests who already joined unaffected once the event is at capacity", async () => {
    const event = await createOpenEventWithCap(1);

    const outcome = await createGuestSession(event.id, "Already joined");
    if (outcome.kind !== "joined") throw new Error("expected joined");
    const existingSessionId = outcome.session.id;

    const rejected = await createGuestSession(event.id, "Turned away");
    expect(rejected.kind).toBe("at_capacity");

    const { data: stillThere, error } = await supabase
      .from("guest_sessions")
      .select("id")
      .eq("id", existingSessionId)
      .maybeSingle();
    if (error) throw error;
    expect(stillThere?.id).toBe(existingSessionId);
  });
});
