import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServiceClient } from "@/lib/supabase/service-client";
import { createDraftEvent } from "@/lib/dal/events";
import { createGuestSession } from "@/lib/dal/guest-sessions";
import { commitCapture, moderateCapture, reserveCapture } from "@/lib/dal/captures";
import { getShareCardForGuestCapture } from "@/lib/dal/share-cards";
import type { EventRow } from "@/lib/db/types";

/**
 * Runs against the real linked dev Postgres and dev Storage bucket, the same tier as
 * lib/dal/captures.integration.test.ts. Covers the slice's own authorization and isolation
 * requirements (product.md §10, roadmap Slice 10 verification): sharing respects the host
 * toggle, a guest can only ever reach their own captures, moderation and commitment state
 * still gate the flow, pre-reveal sharing never touches gallery/visibility state, the
 * original is never modified, and repeated generation is idempotent.
 */

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

describe("guest sharing flow (share-card generation and retrieval)", () => {
  const supabase = createServiceClient();
  const suffix = crypto.randomUUID();
  let hostId: string;

  beforeAll(async () => {
    const { data, error } = await supabase.auth.admin.createUser({
      email: `share-card-host-${suffix}@example.test`,
      password: crypto.randomUUID(),
      email_confirm: true,
    });
    if (error) throw error;
    hostId = data.user.id;
  });

  afterAll(async () => {
    if (hostId) await supabase.auth.admin.deleteUser(hostId);
  });

  async function createOpenEvent(overrides: Record<string, unknown> = {}): Promise<EventRow> {
    const event = await createDraftEvent(hostId, `Share test event ${crypto.randomUUID()}`);
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("events")
      .update({
        activated_at: now,
        capture_opened_at: now,
        safety_net_closes_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        ...overrides,
      })
      .eq("id", event.id)
      .select()
      .single();
    if (error) throw error;
    return data as EventRow;
  }

  async function newGuestSession(eventId: string) {
    const outcome = await createGuestSession(eventId, "Test guest");
    if (outcome.kind !== "joined") throw new Error("expected joined");
    return outcome.session;
  }

  async function commitTinyCapture(eventId: string, guestSessionId: string, message: string | null = null) {
    const reserved = await reserveCapture(eventId, guestSessionId, crypto.randomUUID());
    if (reserved.kind !== "reserved") throw new Error("expected reserved");

    const { error: uploadError } = await supabase.storage
      .from("captures")
      .upload(reserved.capture.storage_path, TINY_PNG, { contentType: "image/png", upsert: true });
    if (uploadError) throw uploadError;

    const committed = await commitCapture(eventId, guestSessionId, reserved.capture.id, message);
    if (committed.kind !== "committed") throw new Error("expected committed");
    return committed.capture;
  }

  it("sharing enabled: a guest can generate a share card for their own committed capture", async () => {
    const event = await createOpenEvent();
    const session = await newGuestSession(event.id);
    const capture = await commitTinyCapture(event.id, session.id, "hi from the party");

    const result = await getShareCardForGuestCapture(event, session.id, capture.id);

    expect(result.kind).toBe("ok");
    if (result.kind === "ok") {
      expect(result.bytes.subarray(0, 4)).toEqual(PNG_MAGIC);
    }
  });

  it("sharing disabled: the flow refuses regardless of capture eligibility", async () => {
    const event = await createOpenEvent({ sharing_enabled: false });
    const session = await newGuestSession(event.id);
    const capture = await commitTinyCapture(event.id, session.id);

    const result = await getShareCardForGuestCapture(event, session.id, capture.id);

    expect(result).toEqual({ kind: "sharing_disabled" });
  });

  it("guest A cannot generate or retrieve a share asset for guest B's capture", async () => {
    const event = await createOpenEvent();
    const sessionA = await newGuestSession(event.id);
    const sessionB = await newGuestSession(event.id);
    const captureB = await commitTinyCapture(event.id, sessionB.id);

    const result = await getShareCardForGuestCapture(event, sessionA.id, captureB.id);

    expect(result).toEqual({ kind: "not_found" });
  });

  it("possession of a capture id alone is insufficient without the matching guest session", async () => {
    const event = await createOpenEvent();
    const session = await newGuestSession(event.id);
    const capture = await commitTinyCapture(event.id, session.id);

    const result = await getShareCardForGuestCapture(event, crypto.randomUUID(), capture.id);

    expect(result).toEqual({ kind: "not_found" });
  });

  it("a pending (not yet committed) capture cannot be shared", async () => {
    const event = await createOpenEvent();
    const session = await newGuestSession(event.id);
    const reserved = await reserveCapture(event.id, session.id, crypto.randomUUID());
    if (reserved.kind !== "reserved") throw new Error("expected reserved");

    const result = await getShareCardForGuestCapture(event, session.id, reserved.capture.id);

    expect(result).toEqual({ kind: "not_found" });
  });

  it("a host-hidden capture cannot continue through the sharing flow", async () => {
    const event = await createOpenEvent();
    const session = await newGuestSession(event.id);
    const capture = await commitTinyCapture(event.id, session.id);

    const moderated = await moderateCapture(hostId, event.id, capture.id, "hide");
    expect(moderated).toBe(true);

    const result = await getShareCardForGuestCapture(event, session.id, capture.id);
    expect(result).toEqual({ kind: "not_found" });
  });

  it("a host-deleted capture cannot continue through the sharing flow", async () => {
    const event = await createOpenEvent();
    const session = await newGuestSession(event.id);
    const capture = await commitTinyCapture(event.id, session.id);

    const moderated = await moderateCapture(hostId, event.id, capture.id, "delete");
    expect(moderated).toBe(true);

    const result = await getShareCardForGuestCapture(event, session.id, capture.id);
    expect(result).toEqual({ kind: "not_found" });
  });

  it("pre-reveal sharing succeeds without consulting gallery reveal or visibility state", async () => {
    // reveal_mode defaults to "after_event" (never revealed while capture is open) and
    // visibility is set to "only_me" here — the strictest possible gallery gate. The share
    // flow must still work for the guest's own capture (product.md §10) because it never
    // reads either of these columns for its own decision.
    const event = await createOpenEvent({ visibility: "only_me" });
    const session = await newGuestSession(event.id);
    const capture = await commitTinyCapture(event.id, session.id);

    const result = await getShareCardForGuestCapture(event, session.id, capture.id);

    expect(result.kind).toBe("ok");
  });

  it("leaves the original media completely unmodified", async () => {
    const event = await createOpenEvent();
    const session = await newGuestSession(event.id);
    const capture = await commitTinyCapture(event.id, session.id);

    const before = await supabase.storage.from("captures").download(capture.storage_path);
    if (before.error) throw before.error;
    const beforeBytes = Buffer.from(await before.data.arrayBuffer());

    await getShareCardForGuestCapture(event, session.id, capture.id);

    const after = await supabase.storage.from("captures").download(capture.storage_path);
    if (after.error) throw after.error;
    const afterBytes = Buffer.from(await after.data.arrayBuffer());

    expect(afterBytes.equals(beforeBytes)).toBe(true);
  });

  it("repeated generation is idempotent: exactly one share object, one share_path value, under concurrent taps", async () => {
    const event = await createOpenEvent();
    const session = await newGuestSession(event.id);
    const capture = await commitTinyCapture(event.id, session.id);

    const [first, second] = await Promise.all([
      getShareCardForGuestCapture(event, session.id, capture.id),
      getShareCardForGuestCapture(event, session.id, capture.id),
    ]);

    expect(first.kind).toBe("ok");
    expect(second.kind).toBe("ok");

    const { data: row, error } = await supabase
      .from("captures")
      .select("share_path")
      .eq("id", capture.id)
      .single();
    if (error) throw error;
    expect(row.share_path).toBeTruthy();

    const folder = row.share_path!.slice(0, row.share_path!.lastIndexOf("/"));
    const fileName = row.share_path!.slice(row.share_path!.lastIndexOf("/") + 1);
    const { data: listing, error: listError } = await supabase.storage
      .from("captures")
      .list(folder, { search: fileName });
    if (listError) throw listError;
    expect(listing?.filter((entry) => entry.name === fileName)).toHaveLength(1);

    // A third, later call reuses the cached object rather than failing or diverging.
    const third = await getShareCardForGuestCapture(event, session.id, capture.id);
    expect(third.kind).toBe("ok");
    if (third.kind === "ok" && first.kind === "ok") {
      expect(third.bytes.equals(first.bytes)).toBe(true);
    }
  });
});
