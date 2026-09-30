import { afterAll, beforeAll, describe, expect, it } from "vitest";
import sharp from "sharp";
import { createServiceClient } from "@/lib/supabase/service-client";
import { createDraftEvent } from "@/lib/dal/events";
import { createGuestSession } from "@/lib/dal/guest-sessions";
import { commitCapture, moderateCapture, reserveCapture } from "@/lib/dal/captures";
import { generateLinkToken } from "@/lib/auth/link-tokens";
import { makeSingleKeepsake } from "@/lib/dal/keepsakes";
import { SINGLE_STYLES } from "@/lib/keepsakes/styles";
import type { CaptureRow, EventRow } from "@/lib/db/types";

/**
 * Keepsake authorization and isolation against the real dev Postgres and Storage (roadmap Slice
 * 16 verification; product.md §10.2–§10.3, invariants 10 and 14; architecture §7b). Every refusal
 * but "sharing off" is the same generic not-found; nothing is written; originals and derivatives
 * are byte-identical afterwards; capture being closed or the gallery unrevealed doesn't matter.
 */

const JPEG_MAGIC = Buffer.from([0xff, 0xd8, 0xff]);

describe("Single-photo keepsakes (real Postgres + Storage)", () => {
  const supabase = createServiceClient();
  const suffix = crypto.randomUUID();
  let hostId: string;
  let portrait: Buffer;

  beforeAll(async () => {
    const { data, error } = await supabase.auth.admin.createUser({
      email: `keepsake-host-${suffix}@example.test`,
      password: crypto.randomUUID(),
      email_confirm: true,
    });
    if (error) throw error;
    hostId = data.user.id;
    portrait = await sharp({ create: { width: 600, height: 800, channels: 3, background: { r: 200, g: 120, b: 90 } } })
      .jpeg()
      .toBuffer();
  });

  afterAll(async () => {
    if (hostId) await supabase.auth.admin.deleteUser(hostId);
  });

  async function update(eventId: string, patch: Record<string, unknown>): Promise<EventRow> {
    const { data, error } = await supabase.from("events").update(patch).eq("id", eventId).select().single();
    if (error) throw error;
    return data as EventRow;
  }

  /** An activated event with capture open, a real event token, gallery unrevealed and private. */
  async function openEvent(overrides: Record<string, unknown> = {}): Promise<EventRow> {
    const event = await createDraftEvent(hostId, `Keepsake event ${crypto.randomUUID()}`);
    return update(event.id, {
      activated_at: new Date().toISOString(),
      capture_opened_at: new Date().toISOString(),
      safety_net_closes_at: new Date(Date.now() + 3600_000).toISOString(),
      event_token: generateLinkToken(),
      gallery_token: generateLinkToken(),
      reveal_mode: "after_event",
      visibility: "only_me",
      ...overrides,
    });
  }

  async function guest(eventId: string) {
    const outcome = await createGuestSession(eventId, "Mia Reyes");
    if (outcome.kind !== "joined") throw new Error("expected joined");
    return outcome.session.id;
  }

  async function commit(eventId: string, sessionId: string, message: string | null = null): Promise<CaptureRow> {
    const reserved = await reserveCapture(eventId, sessionId, crypto.randomUUID());
    if (reserved.kind !== "reserved") throw new Error(`expected reserved, got ${reserved.kind}`);
    const { error } = await supabase.storage
      .from("captures")
      .upload(reserved.capture.storage_path, portrait, { contentType: "image/jpeg", upsert: true });
    if (error) throw error;
    const committed = await commitCapture(eventId, sessionId, reserved.capture.id, message);
    if (committed.kind !== "committed") throw new Error("expected committed");
    return committed.capture;
  }

  async function bytesOf(path: string): Promise<Buffer> {
    const { data, error } = await supabase.storage.from("captures").download(path);
    if (error) throw error;
    return Buffer.from(await data.arrayBuffer());
  }

  async function folderListing(capture: CaptureRow): Promise<string[]> {
    const folder = capture.storage_path.slice(0, capture.storage_path.lastIndexOf("/"));
    const { data, error } = await supabase.storage.from("captures").list(folder);
    if (error) throw error;
    return data.map((o) => o.name).sort();
  }

  async function capturesOf(eventId: string) {
    const { data, error } = await supabase.from("captures").select().eq("event_id", eventId).order("id");
    if (error) throw error;
    return data;
  }

  it("makes a JPEG keepsake of the guest's own committed capture, in every style", async () => {
    const event = await openEvent({ name: "Dani’s 40th", hashtag: "DaniTurns40", accent_color: "marigold" });
    const session = await guest(event.id);
    const capture = await commit(event.id, session, "Best. Cake. Ever.");

    for (const { id } of SINGLE_STYLES) {
      const outcome = await makeSingleKeepsake(event.event_token!, session, capture.id, id);
      expect(outcome.kind).toBe("ok");
      if (outcome.kind !== "ok") continue;
      expect(outcome.bytes.subarray(0, 3)).toEqual(JPEG_MAGIC);
      expect(outcome.filename).toBe(`fiveframes-danis-40th-${id}.jpg`);
      const meta = await sharp(outcome.bytes).metadata();
      expect([meta.width, meta.height]).toEqual([1080, 1350]);
    }
  }, 60_000);

  it("writes nothing and leaves the original and its derivatives byte-identical", async () => {
    const event = await openEvent();
    const session = await guest(event.id);
    const capture = await commit(event.id, session, "hello");
    const [original, display, thumbnail] = await Promise.all([
      bytesOf(capture.storage_path),
      bytesOf(capture.display_path!),
      bytesOf(capture.thumbnail_path!),
    ]);
    const rowsBefore = await capturesOf(event.id);
    const filesBefore = await folderListing(capture);
    const { data: sessionsBefore } = await supabase.from("guest_sessions").select("id").eq("event_id", event.id);

    for (const { id } of SINGLE_STYLES) {
      expect((await makeSingleKeepsake(event.event_token!, session, capture.id, id)).kind).toBe("ok");
    }

    expect((await bytesOf(capture.storage_path)).equals(original)).toBe(true);
    expect((await bytesOf(capture.display_path!)).equals(display)).toBe(true);
    expect((await bytesOf(capture.thumbnail_path!)).equals(thumbnail)).toBe(true);
    expect(await capturesOf(event.id)).toEqual(rowsBefore); // no frame consumed, nothing changed
    expect(await folderListing(capture)).toEqual(filesBefore); // no keepsake object stored
    const { data: sessionsAfter } = await supabase.from("guest_sessions").select("id").eq("event_id", event.id);
    expect(sessionsAfter).toEqual(sessionsBefore);
    const { data: themeObjects } = await supabase.storage.from("event-theme").list(event.id);
    expect(themeObjects ?? []).toEqual([]);
  }, 60_000);

  it("refuses another guest's capture, a missing session, another event's session and unknown ids — all as not-found", async () => {
    const event = await openEvent();
    const mine = await guest(event.id);
    const theirs = await guest(event.id);
    const theirCapture = await commit(event.id, theirs);
    const other = await openEvent();
    const otherSession = await guest(other.id);
    const token = event.event_token!;

    expect((await makeSingleKeepsake(token, mine, theirCapture.id, "print")).kind).toBe("not_found");
    expect((await makeSingleKeepsake(token, null, theirCapture.id, "print")).kind).toBe("not_found");
    expect((await makeSingleKeepsake(token, otherSession, theirCapture.id, "print")).kind).toBe("not_found");
    expect((await makeSingleKeepsake(token, crypto.randomUUID(), theirCapture.id, "print")).kind).toBe("not_found");
    expect((await makeSingleKeepsake(token, theirs, crypto.randomUUID(), "print")).kind).toBe("not_found");
    expect((await makeSingleKeepsake(token, theirs, "not-a-uuid", "print")).kind).toBe("not_found");
    expect((await makeSingleKeepsake("wrong-token", theirs, theirCapture.id, "print")).kind).toBe("not_found");
    // The other event's token with this capture: the capture isn't in that event.
    expect((await makeSingleKeepsake(other.event_token!, otherSession, theirCapture.id, "print")).kind).toBe("not_found");
  }, 60_000);

  it("refuses an unknown style and a Full Set style on the Single-photo route", async () => {
    const event = await openEvent();
    const session = await guest(event.id);
    const capture = await commit(event.id, session);
    for (const style of ["signature", "grid", "nope", "PRINT", ""]) {
      expect((await makeSingleKeepsake(event.event_token!, session, capture.id, style)).kind).toBe("not_found");
    }
  }, 60_000);

  it("refuses hidden and deleted captures, and allows again after unhide", async () => {
    const event = await openEvent();
    const session = await guest(event.id);
    const hidden = await commit(event.id, session);
    const deleted = await commit(event.id, session);
    await moderateCapture(hostId, event.id, hidden.id, "hide");
    await moderateCapture(hostId, event.id, deleted.id, "delete");

    expect((await makeSingleKeepsake(event.event_token!, session, hidden.id, "print")).kind).toBe("not_found");
    expect((await makeSingleKeepsake(event.event_token!, session, deleted.id, "print")).kind).toBe("not_found");
    await moderateCapture(hostId, event.id, hidden.id, "unhide");
    expect((await makeSingleKeepsake(event.event_token!, session, hidden.id, "print")).kind).toBe("ok");
  }, 60_000);

  it("refuses a pending (uncommitted) capture", async () => {
    const event = await openEvent();
    const session = await guest(event.id);
    const reserved = await reserveCapture(event.id, session, crypto.randomUUID());
    if (reserved.kind !== "reserved") throw new Error("expected reserved");
    expect((await makeSingleKeepsake(event.event_token!, session, reserved.capture.id, "print")).kind).toBe("not_found");
  });

  it("says sharing is disabled (only) when the host turned sharing off", async () => {
    const event = await openEvent();
    const session = await guest(event.id);
    const capture = await commit(event.id, session);
    await update(event.id, { sharing_enabled: false });
    expect((await makeSingleKeepsake(event.event_token!, session, capture.id, "print")).kind).toBe("sharing_disabled");
    // Sharing off never leaks existence: a foreign capture id is still plain not-found.
    const stranger = await guest(event.id);
    expect((await makeSingleKeepsake(event.event_token!, stranger, crypto.randomUUID(), "nope")).kind).toBe("not_found");
  }, 60_000);

  it("refuses expired, archived, media-deleted and rotated-token events", async () => {
    const event = await openEvent();
    const session = await guest(event.id);
    const capture = await commit(event.id, session);
    const past = new Date(Date.now() - 1000).toISOString();

    await update(event.id, { hosted_until: past });
    expect((await makeSingleKeepsake(event.event_token!, session, capture.id, "print")).kind).toBe("not_found");
    await update(event.id, { hosted_until: null, grace_until: past });
    expect((await makeSingleKeepsake(event.event_token!, session, capture.id, "print")).kind).toBe("not_found");
    await update(event.id, { grace_until: null, media_deleted_at: past });
    expect((await makeSingleKeepsake(event.event_token!, session, capture.id, "print")).kind).toBe("not_found");
    await update(event.id, { media_deleted_at: null });
    expect((await makeSingleKeepsake(event.event_token!, session, capture.id, "print")).kind).toBe("ok");

    const rotated = await update(event.id, { event_token: generateLinkToken() });
    expect((await makeSingleKeepsake(event.event_token!, session, capture.id, "print")).kind).toBe("not_found");
    expect((await makeSingleKeepsake(rotated.event_token!, session, capture.id, "print")).kind).toBe("ok");
  }, 60_000);

  it("works after capture closes and before the gallery is revealed, without reading the gallery", async () => {
    const event = await openEvent({ visibility: "only_me", reveal_mode: "after_event" });
    const session = await guest(event.id);
    const capture = await commit(event.id, session);

    // Capture open, gallery unrevealed and private.
    expect((await makeSingleKeepsake(event.event_token!, session, capture.id, "poster")).kind).toBe("ok");
    // Capture closed by the host.
    await update(event.id, { capture_closed_at: new Date().toISOString() });
    const closed = await makeSingleKeepsake(event.event_token!, session, capture.id, "poster");
    expect(closed.kind).toBe("ok");
    if (closed.kind === "ok") {
      expect(closed.bytes.includes(Buffer.from(event.gallery_token!))).toBe(false);
      expect(closed.bytes.includes(Buffer.from(event.event_token!))).toBe(false);
    }
    // Revoked gallery link changes nothing for keepsakes.
    await update(event.id, { gallery_token: null });
    expect((await makeSingleKeepsake(event.event_token!, session, capture.id, "print")).kind).toBe("ok");
  }, 60_000);

  it("re-confirms before responding: a hide or sharing-off landing mid-render withholds the bytes", async () => {
    const event = await openEvent();
    const session = await guest(event.id);
    const capture = await commit(event.id, session);

    const hidden = await makeSingleKeepsake(event.event_token!, session, capture.id, "print", {
      afterRender: async () => {
        await moderateCapture(hostId, event.id, capture.id, "hide");
      },
    });
    expect(hidden.kind).toBe("not_found");

    await moderateCapture(hostId, event.id, capture.id, "unhide");
    const sharingOff = await makeSingleKeepsake(event.event_token!, session, capture.id, "print", {
      afterRender: async () => {
        await update(event.id, { sharing_enabled: false });
      },
    });
    expect(sharingOff.kind).toBe("sharing_disabled");
  }, 60_000);

  it("uses the event theme as it is at render time", async () => {
    const event = await openEvent({ accent_color: "violet" });
    const session = await guest(event.id);
    const capture = await commit(event.id, session);
    const before = await makeSingleKeepsake(event.event_token!, session, capture.id, "booth");
    await update(event.id, { accent_color: "teal" });
    const after = await makeSingleKeepsake(event.event_token!, session, capture.id, "booth");
    if (before.kind !== "ok" || after.kind !== "ok") throw new Error("expected ok");
    const pixel = async (jpeg: Buffer) => (await sharp(jpeg).extract({ left: 20, top: 20, width: 1, height: 1 }).raw().toBuffer()).toJSON().data;
    expect(await pixel(before.bytes)).not.toEqual(await pixel(after.bytes));
  }, 60_000);
});
