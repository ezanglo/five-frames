import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServiceClient } from "@/lib/supabase/service-client";
import {
  createDraftEvent,
  getEventForHost,
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
