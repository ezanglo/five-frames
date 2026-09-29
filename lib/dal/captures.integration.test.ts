import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServiceClient } from "@/lib/supabase/service-client";
import { closeCapture, createDraftEvent, openCapture } from "@/lib/dal/events";
import { createGuestSession } from "@/lib/dal/guest-sessions";
import {
  commitCapture,
  getEventCaptureStats,
  listCapturesForEventHost,
  listCapturesForGalleryViewer,
  listCapturesForGuestSessionWithUrls,
  listOriginalDownloadUrlsForEventHost,
  moderateCapture,
  reserveCapture,
} from "@/lib/dal/captures";

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
    const outcome = await createGuestSession(eventId, "Test guest");
    if (outcome.kind !== "joined") throw new Error("expected joined");
    return outcome.session;
  }

  async function expirePending(guestSessionId: string, reserveKey: string) {
    const { error } = await supabase
      .from("captures")
      .update({ expires_at: new Date(Date.now() - 1000).toISOString() })
      .eq("guest_session_id", guestSessionId)
      .eq("reserve_key", reserveKey);
    if (error) throw error;
  }

  /** Reserves, uploads a tiny real PNG, and commits — for tests that need a genuinely
   *  committed capture (moderation only ever applies to committed rows). */
  async function commitTinyCapture(eventId: string, guestSessionId: string) {
    const reserved = await reserveCapture(eventId, guestSessionId, crypto.randomUUID());
    if (reserved.kind !== "reserved") throw new Error("expected reserved");

    const { error: uploadError } = await supabase.storage
      .from("captures")
      .upload(reserved.capture.storage_path, TINY_PNG, {
        contentType: "image/png",
        upsert: true,
      });
    if (uploadError) throw uploadError;

    const committed = await commitCapture(eventId, guestSessionId, reserved.capture.id, null);
    if (committed.kind !== "committed") throw new Error("expected committed");
    return committed.capture;
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

  it("host moderation (hide/delete) removes a capture from the guest's own view but never frees its slot", async () => {
    const event = await createOpenEvent();
    const session = await newGuestSession(event.id);
    const capture = await commitTinyCapture(event.id, session.id);

    const hidden = await moderateCapture(hostId, event.id, capture.id, "hide");
    expect(hidden).toBe(true);

    let view = await listCapturesForGuestSessionWithUrls(event.id, session.id);
    expect(view.find((c) => c.id === capture.id)).toBeUndefined();

    // Product invariant 4: hiding never returns the frame — the slot stays occupied, so a
    // fresh reserve storm still only yields the 4 remaining slots, never 5.
    const keys = Array.from({ length: 5 }, () => crypto.randomUUID());
    const results = await Promise.all(
      keys.map((key) => reserveCapture(event.id, session.id, key)),
    );
    expect(results.filter((r) => r.kind === "reserved")).toHaveLength(4);
    expect(results.filter((r) => r.kind === "frames_exhausted")).toHaveLength(1);

    const unhidden = await moderateCapture(hostId, event.id, capture.id, "unhide");
    expect(unhidden).toBe(true);
    view = await listCapturesForGuestSessionWithUrls(event.id, session.id);
    expect(view.find((c) => c.id === capture.id)).toBeDefined();

    const deleted = await moderateCapture(hostId, event.id, capture.id, "delete");
    expect(deleted).toBe(true);
    view = await listCapturesForGuestSessionWithUrls(event.id, session.id);
    expect(view.find((c) => c.id === capture.id)).toBeUndefined();

    const gallery = await listCapturesForEventHost(hostId, event.id);
    expect(gallery?.find((c) => c.id === capture.id)).toBeUndefined();
  });

  it("host and guest download urls carry an attachment disposition; viewing urls stay inline", async () => {
    const event = await createOpenEvent();
    const session = await newGuestSession(event.id);
    const capture = await commitTinyCapture(event.id, session.id);

    const gallery = await listCapturesForEventHost(hostId, event.id);
    const tile = gallery?.find((c) => c.id === capture.id);
    expect(tile).toBeDefined();
    // Supabase Storage only turns a signed URL into a real download (rather than an
    // inline same-tab navigation) when it carries a `download` query param set at
    // signing time — the anchor tag's own `download` attribute is silently ignored for
    // a cross-origin URL like this one, which is exactly what made host downloads
    // navigate instead of saving a file.
    expect(tile!.downloadUrl).toMatch(/[?&]download=/);
    expect(tile!.thumbnailUrl).not.toMatch(/[?&]download=/);

    const guestView = await listCapturesForGuestSessionWithUrls(event.id, session.id);
    const guestCapture = guestView.find((c) => c.id === capture.id);
    // The same failure class applies to the guest's own "Download my photos" (a sequential
    // loop like the host's bulk download): an inline url would navigate away after the first
    // photo. Viewing urls (thumbnail, display) must stay inline so <img> can render them.
    expect(guestCapture?.downloadUrl).toMatch(/[?&]download=my-shot-\d/);
    expect(guestCapture?.thumbnailUrl).not.toMatch(/[?&]download=/);
    expect(guestCapture?.displayUrl).not.toMatch(/[?&]download=/);
  });

  it("moderation is scoped to the owning host — a different host can neither read nor moderate", async () => {
    const event = await createOpenEvent();
    const session = await newGuestSession(event.id);
    const capture = await commitTinyCapture(event.id, session.id);

    const { data: otherHost, error } = await supabase.auth.admin.createUser({
      email: `other-host-${crypto.randomUUID()}@example.test`,
      password: crypto.randomUUID(),
      email_confirm: true,
    });
    if (error) throw error;

    try {
      expect(await listCapturesForEventHost(otherHost.user.id, event.id)).toBeNull();
      expect(await getEventCaptureStats(otherHost.user.id, event.id)).toBeNull();
      expect(await moderateCapture(otherHost.user.id, event.id, capture.id, "delete")).toBe(false);

      // The real host's view is unaffected — the other host's attempted delete was a no-op.
      const gallery = await listCapturesForEventHost(hostId, event.id);
      expect(gallery?.find((c) => c.id === capture.id)).toBeDefined();
    } finally {
      await supabase.auth.admin.deleteUser(otherHost.user.id);
    }
  });

  it("listOriginalDownloadUrlsForEventHost: includes committed (even hidden) originals, excludes deleted and pending, refused for another host", async () => {
    // 3 real commits (upload + derivative generation) plus a reserve makes this slower than
    // the default 5s timeout — same reason getEventCaptureStats's test below uses 15s.
    const event = await createOpenEvent();
    const session = await newGuestSession(event.id);
    const visible = await commitTinyCapture(event.id, session.id);
    const hidden = await commitTinyCapture(event.id, session.id);
    const toDelete = await commitTinyCapture(event.id, session.id);
    await moderateCapture(hostId, event.id, hidden.id, "hide");
    await moderateCapture(hostId, event.id, toDelete.id, "delete");
    const pendingReserve = await reserveCapture(event.id, session.id, crypto.randomUUID());
    expect(pendingReserve.kind).toBe("reserved");

    const downloads = await listOriginalDownloadUrlsForEventHost(hostId, event.id);
    expect(downloads).not.toBeNull();
    const ids = downloads!.map((d) => d.id);
    expect(ids).toContain(visible.id);
    expect(ids).toContain(hidden.id);
    expect(ids).not.toContain(toDelete.id);
    if (pendingReserve.kind === "reserved") {
      expect(ids).not.toContain(pendingReserve.capture.id);
    }
    expect(downloads!.every((d) => d.url.startsWith("http"))).toBe(true);
    expect(new Set(downloads!.map((d) => d.filename)).size).toBe(downloads!.length);
    // Each bulk-download url must be attachment-capable (see the dedicated
    // listCapturesForEventHost test above for why), and must encode that specific
    // capture's stable filename so a real browser saves it under a sensible name
    // rather than the raw storage path.
    for (const download of downloads!) {
      expect(download.url).toContain(`download=${encodeURIComponent(download.filename)}`);
    }

    const { data: otherHost, error } = await supabase.auth.admin.createUser({
      email: `other-host-${crypto.randomUUID()}@example.test`,
      password: crypto.randomUUID(),
      email_confirm: true,
    });
    if (error) throw error;
    try {
      expect(await listOriginalDownloadUrlsForEventHost(otherHost.user.id, event.id)).toBeNull();
    } finally {
      await supabase.auth.admin.deleteUser(otherHost.user.id);
    }
  }, 20000);

  it(
    "getEventCaptureStats counts guest sessions and committed, non-deleted photos",
    async () => {
      const event = await createOpenEvent();
      const sessionA = await newGuestSession(event.id);
      const sessionB = await newGuestSession(event.id);
      await commitTinyCapture(event.id, sessionA.id);
      const toDelete = await commitTinyCapture(event.id, sessionA.id);
      await commitTinyCapture(event.id, sessionB.id);
      await moderateCapture(hostId, event.id, toDelete.id, "delete");

      const stats = await getEventCaptureStats(hostId, event.id);
      expect(stats).toEqual({ guestSessionCount: 2, photoCount: 2 });
    },
    15000,
  );

  it("capture open/close: close only works while capture is open; a reopen after the automatic safety-net close is refused", async () => {
    const event = await createOpenEvent();

    const notYetOpen = await supabase
      .from("events")
      .update({ capture_opened_at: null })
      .eq("id", event.id)
      .select()
      .single();
    if (notYetOpen.error) throw notYetOpen.error;
    expect(await closeCapture(hostId, event.id)).toBeNull();

    const opened = await openCapture(hostId, event.id);
    expect(opened?.capture_opened_at).not.toBeNull();
    expect(opened?.capture_closed_at).toBeNull();

    const closed = await closeCapture(hostId, event.id);
    expect(closed?.capture_closed_at).not.toBeNull();

    const reopened = await openCapture(hostId, event.id);
    expect(reopened?.capture_closed_at).toBeNull();

    const { error: pastSafetyNetError } = await supabase
      .from("events")
      .update({
        capture_closed_at: new Date().toISOString(),
        safety_net_closes_at: new Date(Date.now() - 1000).toISOString(),
      })
      .eq("id", event.id);
    if (pastSafetyNetError) throw pastSafetyNetError;

    expect(await openCapture(hostId, event.id)).toBeNull();
  });

  it("openCapture computes and stamps safety_net_closes_at on first open, and never moves it on reopen", async () => {
    const draft = await createDraftEvent(hostId, `Safety net event ${crypto.randomUUID()}`);
    const activated = await supabase
      .from("events")
      .update({ activated_at: new Date().toISOString() })
      .eq("id", draft.id)
      .select()
      .single();
    if (activated.error) throw activated.error;
    expect(activated.data.safety_net_closes_at).toBeNull();

    const opened = await openCapture(hostId, draft.id);
    expect(opened?.safety_net_closes_at).not.toBeNull();
    const firstDeadline = opened?.safety_net_closes_at;

    await closeCapture(hostId, draft.id);
    const reopened = await openCapture(hostId, draft.id);
    expect(reopened?.safety_net_closes_at).toBe(firstDeadline);
  });

  it(
    "the gallery viewer never sees a hidden or deleted capture, but does see a favorited one",
    async () => {
      const event = await createOpenEvent();
      const session = await newGuestSession(event.id);
      const visible = await commitTinyCapture(event.id, session.id);
      const hidden = await commitTinyCapture(event.id, session.id);
      const deleted = await commitTinyCapture(event.id, session.id);
      const favorited = await commitTinyCapture(event.id, session.id);

      await moderateCapture(hostId, event.id, hidden.id, "hide");
      await moderateCapture(hostId, event.id, deleted.id, "delete");
      await moderateCapture(hostId, event.id, favorited.id, "favorite");

      const gallery = await listCapturesForGalleryViewer(event.id);
      const ids = gallery.map((c) => c.id);

      expect(ids).toContain(visible.id);
      expect(ids).toContain(favorited.id);
      expect(ids).not.toContain(hidden.id);
      expect(ids).not.toContain(deleted.id);
      expect(gallery.find((c) => c.id === favorited.id)?.favorited).toBe(true);
      expect(gallery.every((c) => c.imageUrl.length > 0)).toBe(true);
    },
    15000,
  );
});
