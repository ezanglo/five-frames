import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createServiceClient } from "@/lib/supabase/service-client";
import { createDraftEvent, getEventForHost } from "@/lib/dal/events";
import {
  listOriginalDownloadUrlsForEventHost,
  reserveCapture,
} from "@/lib/dal/captures";
import { createGuestSession } from "@/lib/dal/guest-sessions";
import {
  listEventsPendingPermanentDeletion,
  permanentlyDeleteEventMedia,
  runLifecycleSweep,
} from "@/lib/dal/lifecycle";
import { CAPTURES_BUCKET } from "@/lib/media/constants";
import * as storageModule from "@/lib/media/storage";

/**
 * Runs against the real linked dev Postgres and Storage bucket (architecture §11) —
 * permanent deletion is the one genuinely irreversible mutation in this codebase, so it's
 * worth proving for real: that it actually removes the storage objects it claims to, that a
 * rerun after partial or full completion is a safe no-op, that it never fires before the
 * grace period actually elapses, and that one event's processing never touches another's.
 */
describe("lifecycle: retention and permanent deletion", () => {
  const supabase = createServiceClient();
  const suffix = crypto.randomUUID();
  let hostId: string;

  beforeAll(async () => {
    const { data, error } = await supabase.auth.admin.createUser({
      email: `lifecycle-host-${suffix}@example.test`,
      password: crypto.randomUUID(),
      email_confirm: true,
    });
    if (error) throw error;
    hostId = data.user.id;
  });

  afterAll(async () => {
    if (hostId) await supabase.auth.admin.deleteUser(hostId);
  });

  /** Activates an event with capture genuinely open (so test setup can reserve/upload a
   *  real capture through the normal gate), then separately backdates the retention
   *  timestamps to simulate ~12+ months having passed — rather than waiting for real time
   *  or bypassing the capture-open gate, which would make `reserveAndUploadOriginal` below
   *  exercise a state a real event can never actually be captured into. */
  async function createOpenEvent() {
    const event = await createDraftEvent(hostId, `Retention event ${crypto.randomUUID()}`);
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("events")
      .update({
        activated_at: now,
        capture_opened_at: now,
        safety_net_closes_at: new Date(Date.now() + 1000 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .eq("id", event.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async function backdateRetention(
    eventId: string,
    overrides: { hostedUntil: Date; graceUntil: Date; mediaDeletedAt?: Date | null },
  ) {
    const { error } = await supabase
      .from("events")
      .update({
        hosted_until: overrides.hostedUntil.toISOString(),
        grace_until: overrides.graceUntil.toISOString(),
        media_deleted_at: overrides.mediaDeletedAt?.toISOString() ?? null,
      })
      .eq("id", eventId);
    if (error) throw error;
  }

  async function newGuestSession(eventId: string) {
    const outcome = await createGuestSession(eventId, "Test guest");
    if (outcome.kind !== "joined") throw new Error("expected joined");
    return outcome.session;
  }

  /** Reserves a slot and uploads a real tiny object to storage at the reserved path,
   *  bypassing the signed-URL step (test setup, not the guest upload path itself) — enough
   *  to prove permanentlyDeleteEventMedia removes a real storage object, not just a row. */
  async function reserveAndUploadOriginal(eventId: string, guestSessionId: string) {
    const outcome = await reserveCapture(eventId, guestSessionId, crypto.randomUUID());
    if (outcome.kind !== "reserved") throw new Error("expected reserved");
    const { error } = await supabase.storage
      .from(CAPTURES_BUCKET)
      .upload(outcome.capture.storage_path, Buffer.from("test-bytes"), {
        contentType: "image/jpeg",
        upsert: true,
      });
    if (error) throw error;
    return outcome.capture;
  }

  async function objectExists(path: string): Promise<boolean> {
    const lastSlash = path.lastIndexOf("/");
    const { data, error } = await supabase.storage
      .from(CAPTURES_BUCKET)
      .list(path.slice(0, lastSlash), { search: path.slice(lastSlash + 1) });
    if (error) throw error;
    return (data ?? []).some((entry) => entry.name === path.slice(lastSlash + 1));
  }

  it("is not eligible before the grace period elapses, and not listed for the sweep", async () => {
    const now = new Date();
    const event = await createOpenEvent();
    await backdateRetention(event.id, {
      hostedUntil: new Date(now.getTime() - 1000),
      graceUntil: new Date(now.getTime() + 24 * 60 * 60 * 1000), // still in grace
    });

    const result = await permanentlyDeleteEventMedia(event.id, now);
    expect(result.outcome).toBe("not_eligible");

    const pending = await listEventsPendingPermanentDeletion(now);
    expect(pending.some((e) => e.id === event.id)).toBe(false);
  });

  it("host downloads keep working throughout the grace period, right up to the boundary", async () => {
    const now = new Date();
    const event = await createOpenEvent();
    const session = await newGuestSession(event.id);
    await reserveAndUploadOriginal(event.id, session.id);
    await backdateRetention(event.id, {
      hostedUntil: new Date(now.getTime() - 24 * 60 * 60 * 1000), // already expired
      graceUntil: new Date(now.getTime() + 60 * 60 * 1000), // grace ends in an hour — not yet
    });

    // Downloads are ownership-scoped only (Slice 11) — still reachable while expired.
    const urls = await listOriginalDownloadUrlsForEventHost(hostId, event.id);
    expect(urls).not.toBeNull();
  });

  it("permanently deletes storage objects and capture rows once eligible, and stamps media_deleted_at", async () => {
    const now = new Date();
    const event = await createOpenEvent();
    const session = await newGuestSession(event.id);
    const capture = await reserveAndUploadOriginal(event.id, session.id);
    await backdateRetention(event.id, {
      hostedUntil: new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000),
      graceUntil: new Date(now.getTime() - 1000), // grace period just elapsed
    });

    expect(await objectExists(capture.storage_path)).toBe(true);

    const pendingBefore = await listEventsPendingPermanentDeletion(now);
    expect(pendingBefore.some((e) => e.id === event.id)).toBe(true);

    const result = await permanentlyDeleteEventMedia(event.id, now);
    expect(result).toEqual({ outcome: "deleted", capturesDeleted: 1, objectsDeleted: 1 });

    expect(await objectExists(capture.storage_path)).toBe(false);

    const { data: remainingCaptures, error } = await supabase
      .from("captures")
      .select("id")
      .eq("event_id", event.id);
    if (error) throw error;
    expect(remainingCaptures).toHaveLength(0);

    const eventAfter = await getEventForHost(hostId, event.id);
    expect(eventAfter?.media_deleted_at).not.toBeNull();

    const pendingAfter = await listEventsPendingPermanentDeletion(now);
    expect(pendingAfter.some((e) => e.id === event.id)).toBe(false);
  });

  it("a rerun after deletion has already completed is a harmless no-op, never reviving media", async () => {
    const now = new Date();
    const event = await createOpenEvent();
    const session = await newGuestSession(event.id);
    await reserveAndUploadOriginal(event.id, session.id);
    await backdateRetention(event.id, {
      hostedUntil: new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000),
      graceUntil: new Date(now.getTime() - 1000),
    });

    const first = await permanentlyDeleteEventMedia(event.id, now);
    expect(first.outcome).toBe("deleted");

    const second = await permanentlyDeleteEventMedia(event.id, now);
    expect(second).toEqual({ outcome: "already_deleted" });
  });

  it("a rerun after a partial failure (objects gone, rows and marker not yet) safely converges", async () => {
    const now = new Date();
    const event = await createOpenEvent();
    const session = await newGuestSession(event.id);
    const capture = await reserveAndUploadOriginal(event.id, session.id);
    await backdateRetention(event.id, {
      hostedUntil: new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000),
      graceUntil: new Date(now.getTime() - 1000),
    });

    // Simulate "storage already removed, but the run crashed before deleting rows / marking
    // media_deleted_at" by removing the object out-of-band first.
    await supabase.storage.from(CAPTURES_BUCKET).remove([capture.storage_path]);
    expect(await objectExists(capture.storage_path)).toBe(false);

    const result = await permanentlyDeleteEventMedia(event.id, now);
    expect(result).toEqual({ outcome: "deleted", capturesDeleted: 1, objectsDeleted: 1 });

    const eventAfter = await getEventForHost(hostId, event.id);
    expect(eventAfter?.media_deleted_at).not.toBeNull();
  });

  it("one event's deletion failure is caught and recorded without blocking another event's deletion in the same sweep", async () => {
    const now = new Date();
    const eventA = await createOpenEvent();
    const eventB = await createOpenEvent();
    const sessionA = await newGuestSession(eventA.id);
    const sessionB = await newGuestSession(eventB.id);
    await reserveAndUploadOriginal(eventA.id, sessionA.id);
    const captureB = await reserveAndUploadOriginal(eventB.id, sessionB.id);
    await backdateRetention(eventA.id, {
      hostedUntil: new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000),
      graceUntil: new Date(now.getTime() - 1000),
    });
    await backdateRetention(eventB.id, {
      hostedUntil: new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000),
      graceUntil: new Date(now.getTime() - 1000),
    });

    // Force a genuine failure for event A only (a transient storage error, say) by spying
    // on deleteObjects — real behavior for every other call, including event B's — and
    // proving the sweep still processes B to completion despite A throwing.
    const realDeleteObjects = storageModule.deleteObjects;
    const spy = vi
      .spyOn(storageModule, "deleteObjects")
      .mockImplementation(async (paths: string[]) => {
        if (paths.some((p) => p.startsWith(`${eventA.id}/`))) {
          throw new Error("simulated storage failure for event A");
        }
        return realDeleteObjects(paths);
      });

    try {
      const result = await runLifecycleSweep(now);

      expect(result.failures).toEqual([
        { eventId: eventA.id, message: "simulated storage failure for event A" },
      ]);
      expect(result.permanentDeletionsSucceeded).toBe(1);

      const eventAAfter = await getEventForHost(hostId, eventA.id);
      expect(eventAAfter?.media_deleted_at).toBeNull();

      const eventBAfter = await getEventForHost(hostId, eventB.id);
      expect(eventBAfter?.media_deleted_at).not.toBeNull();
    } finally {
      spy.mockRestore();
    }

    // Cleanup for event A's uploaded object, since the simulated failure left it in place.
    const eventARow = await getEventForHost(hostId, eventA.id);
    if (eventARow && !eventARow.media_deleted_at) {
      const rerun = await permanentlyDeleteEventMedia(eventA.id, now);
      expect(rerun.outcome).toBe("deleted");
    }
    expect(await objectExists(captureB.storage_path)).toBe(false);
  });
});
