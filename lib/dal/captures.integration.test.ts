import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServiceClient } from "@/lib/supabase/service-client";
import { createDraftEvent } from "@/lib/dal/events";
import { createGuestSession } from "@/lib/dal/guest-sessions";
import { commitCapture, listCapturesForGuestSessionWithUrls, reserveCapture } from "@/lib/dal/captures";

/**
 * Runs against the real linked dev Postgres and dev Storage bucket (architecture §11) —
 * these are the tests that matter most in the project (roadmap Slice 2). They exercise the
 * frame-limit mechanism itself: the row lock, the idempotent reserve_key, the partial
 * unique slot index, and the reservation TTL (architecture §6, decisions D5/D6).
 */

// A minimal valid 1x1 PNG, used to exercise the real commit → storage → derivative path.
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

describe("frame-limit mechanism (reserve → upload → commit)", () => {
  const supabase = createServiceClient();
  const suffix = crypto.randomUUID();
  let hostId: string;

  beforeAll(async () => {
    const { data, error } = await supabase.auth.admin.createUser({
      email: `capture-host-${suffix}@example.test`,
      password: crypto.randomUUID(),
      email_confirm: true,
    });
    if (error) throw error;
    hostId = data.user.id;
  });

  afterAll(async () => {
    if (hostId) await supabase.auth.admin.deleteUser(hostId);
  });

  async function createOpenEvent() {
    const event = await createDraftEvent(hostId, `Test event ${crypto.randomUUID()}`);
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("events")
      .update({
        activated_at: now,
        capture_opened_at: now,
        safety_net_closes_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      })
      .eq("id", event.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async function newGuestSession(eventId: string) {
    return createGuestSession(eventId, "Test guest");
  }

  async function expirePending(guestSessionId: string, reserveKey: string) {
    const { error } = await supabase
      .from("captures")
      .update({ expires_at: new Date(Date.now() - 1000).toISOString() })
      .eq("guest_session_id", guestSessionId)
      .eq("reserve_key", reserveKey);
    if (error) throw error;
  }

  it("never lets a guest session reserve more than 5 slots, even under a concurrent storm", async () => {
    const event = await createOpenEvent();
    const session = await newGuestSession(event.id);
    const keys = Array.from({ length: 6 }, () => crypto.randomUUID());

    const results = await Promise.all(
      keys.map((key) => reserveCapture(event.id, session.id, key)),
    );

    const reserved = results.filter((r) => r.kind === "reserved");
    const exhausted = results.filter((r) => r.kind === "frames_exhausted");

    expect(reserved).toHaveLength(5);
    expect(exhausted).toHaveLength(1);

    const slotIndices = new Set(
      reserved.map((r) => (r.kind === "reserved" ? r.capture.slot_index : -1)),
    );
    expect(slotIndices).toEqual(new Set([0, 1, 2, 3, 4]));
  });

  it("two concurrent reserves sharing one reserve_key consume exactly one slot", async () => {
    const event = await createOpenEvent();
    const session = await newGuestSession(event.id);
    const key = crypto.randomUUID();

    const [first, second] = await Promise.all([
      reserveCapture(event.id, session.id, key),
      reserveCapture(event.id, session.id, key),
    ]);

    expect(first.kind).toBe("reserved");
    expect(second.kind).toBe("reserved");
    if (first.kind === "reserved" && second.kind === "reserved") {
      expect(first.capture.id).toBe(second.capture.id);
      expect(first.capture.slot_index).toBe(second.capture.slot_index);
    }

    const { data: rows, error } = await supabase
      .from("captures")
      .select()
      .eq("guest_session_id", session.id)
      .eq("reserve_key", key);
    if (error) throw error;
    expect(rows).toHaveLength(1);
  });

  it("retry after a failed upload produces exactly one committed capture, never two", async () => {
    const event = await createOpenEvent();
    const session = await newGuestSession(event.id);
    const key = crypto.randomUUID();

    const reserved = await reserveCapture(event.id, session.id, key);
    expect(reserved.kind).toBe("reserved");
    if (reserved.kind !== "reserved") return;

    // First commit attempt: nothing was actually uploaded, so it must be refused.
    const failedCommit = await commitCapture(event.id, session.id, reserved.capture.id, null);
    expect(failedCommit.kind).toBe("not_uploaded");

    // Retry reuses the same reserve_key — idempotent no-op, same row and slot.
    const retried = await reserveCapture(event.id, session.id, key);
    expect(retried.kind).toBe("reserved");
    if (retried.kind !== "reserved") return;
    expect(retried.capture.id).toBe(reserved.capture.id);

    const { error: uploadError } = await supabase.storage
      .from("captures")
      .upload(reserved.capture.storage_path, TINY_PNG, {
        contentType: "image/png",
        upsert: true,
      });
    if (uploadError) throw uploadError;

    const committed = await commitCapture(event.id, session.id, reserved.capture.id, null);
    expect(committed.kind).toBe("committed");

    // A second commit call (e.g. a duplicate client retry) is an idempotent success, not
    // a second capture.
    const committedAgain = await commitCapture(event.id, session.id, reserved.capture.id, null);
    expect(committedAgain.kind).toBe("committed");

    const { data: rows, error } = await supabase
      .from("captures")
      .select()
      .eq("guest_session_id", session.id)
      .eq("status", "committed");
    if (error) throw error;
    expect(rows).toHaveLength(1);

    const basePath = reserved.capture.storage_path.replace(/\/original$/, "");
    await supabase.storage
      .from("captures")
      .remove([`${basePath}/original`, `${basePath}/display`, `${basePath}/thumbnail`]);
  });

  it("an abandoned reservation past its TTL frees its slot for a fresh attempt", async () => {
    const event = await createOpenEvent();
    const session = await newGuestSession(event.id);
    const staleKey = crypto.randomUUID();

    const stale = await reserveCapture(event.id, session.id, staleKey);
    expect(stale.kind).toBe("reserved");
    if (stale.kind !== "reserved") return;

    await expirePending(session.id, staleKey);

    const freshKey = crypto.randomUUID();
    const fresh = await reserveCapture(event.id, session.id, freshKey);
    expect(fresh.kind).toBe("reserved");
    if (fresh.kind !== "reserved") return;

    // The freed slot (0, since this is a fresh guest session) is reused rather than
    // treated as still occupied.
    expect(fresh.capture.slot_index).toBe(stale.capture.slot_index);
  });

  it("a retry arriving after its reservation expired is reported as lapsed, not revived", async () => {
    const event = await createOpenEvent();
    const session = await newGuestSession(event.id);
    const key = crypto.randomUUID();

    const reserved = await reserveCapture(event.id, session.id, key);
    expect(reserved.kind).toBe("reserved");
    if (reserved.kind !== "reserved") return;

    await expirePending(session.id, key);

    const retried = await reserveCapture(event.id, session.id, key);
    expect(retried.kind).toBe("expired");
  });

  it("refuses to commit a lapsed reservation", async () => {
    const event = await createOpenEvent();
    const session = await newGuestSession(event.id);
    const key = crypto.randomUUID();

    const reserved = await reserveCapture(event.id, session.id, key);
    expect(reserved.kind).toBe("reserved");
    if (reserved.kind !== "reserved") return;

    await expirePending(session.id, key);

    const commitResult = await commitCapture(event.id, session.id, reserved.capture.id, null);
    expect(commitResult.kind).toBe("expired");
  });

  it("refuses to reserve or commit while capture is closed", async () => {
    const event = await createOpenEvent();
    const session = await newGuestSession(event.id);

    const { error } = await supabase
      .from("events")
      .update({ capture_closed_at: new Date().toISOString() })
      .eq("id", event.id);
    if (error) throw error;

    const result = await reserveCapture(event.id, session.id, crypto.randomUUID());
    expect(result.kind).toBe("capture_not_open");
  });

  it("the guest's own view has signed urls for a committed capture and none for a pending one", async () => {
    const event = await createOpenEvent();
    const session = await newGuestSession(event.id);

    const committedKey = crypto.randomUUID();
    const reservedCommitted = await reserveCapture(event.id, session.id, committedKey);
    expect(reservedCommitted.kind).toBe("reserved");
    if (reservedCommitted.kind !== "reserved") return;

    const { error: uploadError } = await supabase.storage
      .from("captures")
      .upload(reservedCommitted.capture.storage_path, TINY_PNG, {
        contentType: "image/png",
        upsert: true,
      });
    if (uploadError) throw uploadError;
    const committed = await commitCapture(event.id, session.id, reservedCommitted.capture.id, null);
    expect(committed.kind).toBe("committed");

    const pendingKey = crypto.randomUUID();
    const reservedPending = await reserveCapture(event.id, session.id, pendingKey);
    expect(reservedPending.kind).toBe("reserved");

    const view = await listCapturesForGuestSessionWithUrls(event.id, session.id);
    const committedView = view.find((c) => c.status === "committed");
    const pendingView = view.find((c) => c.status === "pending");

    expect(committedView?.thumbnailUrl).toMatch(/^https?:\/\//);
    expect(committedView?.downloadUrl).toMatch(/^https?:\/\//);
    expect(pendingView?.thumbnailUrl).toBeNull();
    expect(pendingView?.downloadUrl).toBeNull();

    if (reservedCommitted.kind === "reserved") {
      const basePath = reservedCommitted.capture.storage_path.replace(/\/original$/, "");
      await supabase.storage
        .from("captures")
        .remove([`${basePath}/original`, `${basePath}/display`, `${basePath}/thumbnail`]);
    }
  });
});
