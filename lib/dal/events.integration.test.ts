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
