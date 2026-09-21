import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServiceClient } from "@/lib/supabase/service-client";
import { createDraftEvent, getEventForHost } from "@/lib/dal/events";
import { createGuestSession } from "@/lib/dal/guest-sessions";
import { getOperatorEventDetail, listEventsForOperator } from "@/lib/dal/operator-events";

/**
 * Runs against the real linked dev Postgres (architecture §11). Proves the operator
 * Console's cross-host visibility and its privacy boundary (product.md §5.1.2,
 * architecture §8b): aggregate counts only, never a capture's media.
 */
describe("operator event visibility", () => {
  const supabase = createServiceClient();
  const suffix = crypto.randomUUID();
  let hostAId: string;
  let hostBId: string;
  let eventAId: string;
  let eventBId: string;

  beforeAll(async () => {
    const { data: hostA, error: errorA } = await supabase.auth.admin.createUser({
      email: `op-host-a-${suffix}@example.test`,
      password: crypto.randomUUID(),
      email_confirm: true,
    });
    if (errorA) throw errorA;
    hostAId = hostA.user.id;

    const { data: hostB, error: errorB } = await supabase.auth.admin.createUser({
      email: `op-host-b-${suffix}@example.test`,
      password: crypto.randomUUID(),
      email_confirm: true,
    });
    if (errorB) throw errorB;
    hostBId = hostB.user.id;

    const eventA = await createDraftEvent(hostAId, `Operator visibility A ${suffix}`);
    const eventB = await createDraftEvent(hostBId, `Operator visibility B ${suffix}`);
    eventAId = eventA.id;
    eventBId = eventB.id;

    await createGuestSession(eventAId, "Guest one");
    await createGuestSession(eventAId, "Guest two");
  });

  afterAll(async () => {
    if (hostAId) await supabase.auth.admin.deleteUser(hostAId);
    if (hostBId) await supabase.auth.admin.deleteUser(hostBId);
  });

  it("lists events across multiple different hosts, not just one", async () => {
    const events = await listEventsForOperator();
    const ids = events.map((e) => e.id);

    expect(ids).toContain(eventAId);
    expect(ids).toContain(eventBId);

    const seenHostEmails = new Set(
      events
        .filter((e) => e.id === eventAId || e.id === eventBId)
        .map((e) => e.hostEmail),
    );
    expect(seenHostEmails.size).toBe(2);
  });

  it("search matches by event name, host email, and event id", async () => {
    const byName = await listEventsForOperator(`Operator visibility A ${suffix}`);
    expect(byName.map((e) => e.id)).toEqual([eventAId]);

    const byHostEmail = await listEventsForOperator(`op-host-b-${suffix}`);
    expect(byHostEmail.map((e) => e.id)).toEqual([eventBId]);

    const byId = await listEventsForOperator(eventAId);
    expect(byId.map((e) => e.id)).toEqual([eventAId]);
  });

  it("returns aggregate guest-session and capture counts, scoped to the right event", async () => {
    const detail = await getOperatorEventDetail(eventAId);

    expect(detail).not.toBeNull();
    expect(detail!.hostEmail).toContain(`op-host-a-${suffix}`);
    expect(detail!.event.guest_session_count).toBe(2);
    expect(detail!.captureCounts).toEqual({
      pending: 0,
      committed: 0,
      hidden: 0,
      favorited: 0,
      deleted: 0,
    });
  });

  it("never returns a capture's storage path or a signed media URL", async () => {
    const detail = await getOperatorEventDetail(eventAId);

    const serialized = JSON.stringify(detail);
    expect(serialized).not.toMatch(/storage_path|display_path|thumbnail_path|signedUrl/i);
  });

  it("operator-events.ts has no capability to mint a capture's signed media URL", () => {
    const source = readFileSync(
      new URL("./operator-events.ts", import.meta.url),
      "utf-8",
    );
    expect(source).not.toMatch(/media\/storage|createSignedReadUrl|createSignedUploadUrl/);
  });

  it("operator authorization does not grant host ownership of another host's event", async () => {
    // hostAId here stands in for "an operator account" — the point is that having any
    // authority over eventB (as operator or otherwise) never satisfies the *host*
    // ownership predicate that lib/dal/events.ts enforces on every query.
    const asWrongHost = await getEventForHost(hostAId, eventBId);
    expect(asWrongHost).toBeNull();
  });
});
