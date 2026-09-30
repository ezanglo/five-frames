import { afterAll, beforeAll, describe, expect, it } from "vitest";
import sharp from "sharp";
import { createServiceClient } from "@/lib/supabase/service-client";
import { createDraftEvent } from "@/lib/dal/events";
import { createGuestSession } from "@/lib/dal/guest-sessions";
import { commitCapture, moderateCapture, reserveCapture } from "@/lib/dal/captures";
import { generateLinkToken } from "@/lib/auth/link-tokens";
import { getFullSetAvailability, getFullSetSources, makeFullSetKeepsake } from "@/lib/dal/keepsakes";
import { FULL_SET_SLOTS } from "@/lib/keepsakes/geometry";
import { FULL_SET_STYLES } from "@/lib/keepsakes/styles";
import type { CaptureRow, EventRow } from "@/lib/db/types";

/**
 * Full Set keepsakes against the real dev Postgres and Storage (roadmap Slice 16 Phase B;
 * product.md §10.2.2, criteria 56–65; architecture §7b; D20). The server derives the five; order
 * is `(committed_at, slot_index)`; hidden blocks until unhidden; deleted blocks forever; nothing
 * is written; originals stay byte-identical.
 */

const COLORS = [
  { r: 230, g: 30, b: 30 },
  { r: 30, g: 200, b: 30 },
  { r: 30, g: 30, b: 230 },
  { r: 230, g: 200, b: 30 },
  { r: 200, g: 30, b: 200 },
];

describe("Full Set keepsakes (real Postgres + Storage)", () => {
  const supabase = createServiceClient();
  let hostId: string;
  const photos: Buffer[] = [];

  beforeAll(async () => {
    const { data, error } = await supabase.auth.admin.createUser({
      email: `fullset-host-${crypto.randomUUID()}@example.test`,
      password: crypto.randomUUID(),
      email_confirm: true,
    });
    if (error) throw error;
    hostId = data.user.id;
    for (const [i, color] of COLORS.entries()) {
      const [w, h] = i % 2 ? [800, 600] : [600, 800];
      photos.push(await sharp({ create: { width: w, height: h, channels: 3, background: color } }).jpeg({ quality: 95 }).toBuffer());
    }
  });

  afterAll(async () => {
    if (hostId) await supabase.auth.admin.deleteUser(hostId);
  });

  async function update(eventId: string, patch: Record<string, unknown>): Promise<EventRow> {
    const { data, error } = await supabase.from("events").update(patch).eq("id", eventId).select().single();
    if (error) throw error;
    return data as EventRow;
  }

  async function openEvent(overrides: Record<string, unknown> = {}): Promise<EventRow> {
    const event = await createDraftEvent(hostId, `Full Set event ${crypto.randomUUID()}`);
    return update(event.id, {
      activated_at: new Date().toISOString(),
      capture_opened_at: new Date().toISOString(),
      safety_net_closes_at: new Date(Date.now() + 3600_000).toISOString(),
      event_token: generateLinkToken(),
      gallery_token: generateLinkToken(),
      visibility: "only_me",
      reveal_mode: "after_event",
      ...overrides,
    });
  }

  async function guest(eventId: string) {
    const outcome = await createGuestSession(eventId, "Mia Reyes");
    if (outcome.kind !== "joined") throw new Error("expected joined");
    return outcome.session.id;
  }

  /** Commits `count` captures (photo i gets COLORS[i]) with messages that must never appear. */
  async function commitMany(eventId: string, sessionId: string, count = 5): Promise<CaptureRow[]> {
    const out: CaptureRow[] = [];
    for (let i = 0; i < count; i++) {
      const reserved = await reserveCapture(eventId, sessionId, crypto.randomUUID());
      if (reserved.kind !== "reserved") throw new Error(`expected reserved, got ${reserved.kind}`);
      const { error } = await supabase.storage
        .from("captures")
        .upload(reserved.capture.storage_path, photos[i], { contentType: "image/jpeg", upsert: true });
      if (error) throw error;
      const committed = await commitCapture(eventId, sessionId, reserved.capture.id, `PRIVATE MESSAGE ${i}`);
      if (committed.kind !== "committed") throw new Error("expected committed");
      out.push(committed.capture);
    }
    return out;
  }

  /** Which COLORS index fills each Signature slot of an exported Full Set. */
  async function signatureOrder(jpeg: Buffer): Promise<number[]> {
    const order: number[] = [];
    for (const slot of FULL_SET_SLOTS.signature) {
      const { data } = await sharp(jpeg)
        .extract({ left: Math.round(slot.x + slot.width / 2), top: Math.round(slot.y + slot.height / 2), width: 1, height: 1 })
        .raw()
        .toBuffer({ resolveWithObject: true });
      const distance = (c: (typeof COLORS)[number]) => Math.abs(c.r - data[0]) + Math.abs(c.g - data[1]) + Math.abs(c.b - data[2]);
      order.push(COLORS.map(distance).reduce((best, d, i, all) => (d < all[best] ? i : best), 0));
    }
    return order;
  }

  it("makes a Full Set of the session's own five, in commit order, in every style", async () => {
    const event = await openEvent({ name: "Dani’s 40th", hashtag: "DaniTurns40", accent_color: "marigold" });
    const session = await guest(event.id);
    const captures = await commitMany(event.id, session);

    const sources = await getFullSetSources(event.id, session);
    expect(sources.kind).toBe("eligible");
    if (sources.kind === "eligible") expect(sources.captures.map((c) => c.id)).toEqual(captures.map((c) => c.id));
    expect(await getFullSetAvailability(event, session)).toEqual(captures.map((c) => c.id));

    for (const { id } of FULL_SET_STYLES) {
      const outcome = await makeFullSetKeepsake(event.event_token!, session, id);
      expect(outcome.kind).toBe("ok");
      if (outcome.kind !== "ok") continue;
      expect(outcome.filename).toBe(`fiveframes-danis-40th-${id}.jpg`);
      const meta = await sharp(outcome.bytes).metadata();
      expect([meta.width, meta.height]).toEqual([1200, 1800]);
      expect(outcome.bytes.length).toBeLessThan(800 * 1024);
      if (id === "signature") expect(await signatureOrder(outcome.bytes)).toEqual([0, 1, 2, 3, 4]); // photo 5 → the square
    }
  }, 120_000);

  it("orders by committed_at, then slot_index for equal timestamps — never by upload or client order", async () => {
    const event = await openEvent();
    const session = await guest(event.id);
    const captures = await commitMany(event.id, session);

    // Reverse the commit instants: capture 5 was committed first.
    for (const [i, c] of captures.entries()) {
      await supabase.from("captures").update({ committed_at: new Date(Date.UTC(2026, 9, 18, 12, 0, 10 - i)).toISOString() }).eq("id", c.id);
    }
    let outcome = await makeFullSetKeepsake(event.event_token!, session, "signature");
    if (outcome.kind !== "ok") throw new Error(outcome.kind);
    expect(await signatureOrder(outcome.bytes)).toEqual([4, 3, 2, 1, 0]);

    // Equal instants: slot_index breaks the tie.
    for (const c of captures) await supabase.from("captures").update({ committed_at: "2026-10-18T12:00:00Z" }).eq("id", c.id);
    outcome = await makeFullSetKeepsake(event.event_token!, session, "signature");
    if (outcome.kind !== "ok") throw new Error(outcome.kind);
    const bySlot = [...captures].sort((a, b) => a.slot_index - b.slot_index).map((c) => captures.indexOf(c));
    expect(await signatureOrder(outcome.bytes)).toEqual(bySlot);
  }, 120_000);

  it("is unavailable with fewer than five committed captures (and a pending one doesn't count)", async () => {
    const event = await openEvent();
    const session = await guest(event.id);
    await commitMany(event.id, session, 4);
    expect((await getFullSetSources(event.id, session)).kind).toBe("unavailable");
    expect(await getFullSetAvailability(event, session)).toBeNull();
    expect((await makeFullSetKeepsake(event.event_token!, session, "signature")).kind).toBe("not_found");
    const pending = await reserveCapture(event.id, session, crypto.randomUUID());
    expect(pending.kind).toBe("reserved");
    expect((await makeFullSetKeepsake(event.event_token!, session, "signature")).kind).toBe("not_found");
  }, 60_000);

  it("hide → unavailable; unhide → the same five in the same order", async () => {
    const event = await openEvent();
    const session = await guest(event.id);
    const captures = await commitMany(event.id, session);
    await moderateCapture(hostId, event.id, captures[2].id, "hide");
    expect((await makeFullSetKeepsake(event.event_token!, session, "grid")).kind).toBe("not_found");
    expect(await getFullSetAvailability(event, session)).toBeNull();

    await moderateCapture(hostId, event.id, captures[2].id, "unhide");
    expect(await getFullSetAvailability(event, session)).toEqual(captures.map((c) => c.id));
    const outcome = await makeFullSetKeepsake(event.event_token!, session, "signature");
    if (outcome.kind !== "ok") throw new Error(outcome.kind);
    expect(await signatureOrder(outcome.bytes)).toEqual([0, 1, 2, 3, 4]);
  }, 120_000);

  it("delete → unavailable forever, with no four-photo fallback and no frame restored", async () => {
    const event = await openEvent();
    const session = await guest(event.id);
    const captures = await commitMany(event.id, session);
    await moderateCapture(hostId, event.id, captures[4].id, "delete");
    expect((await getFullSetSources(event.id, session)).kind).toBe("unavailable");
    expect((await makeFullSetKeepsake(event.event_token!, session, "signature")).kind).toBe("not_found");
    // The deleted capture still holds its slot: the session can't commit a replacement.
    expect((await reserveCapture(event.id, session, crypto.randomUUID())).kind).toBe("frames_exhausted");
    expect((await makeFullSetKeepsake(event.event_token!, session, "prints")).kind).toBe("not_found");
  }, 60_000);

  it("draws only on the cookie's own session and event: another session, a mixed event and substitution are impossible", async () => {
    const event = await openEvent();
    const full = await guest(event.id);
    const partial = await guest(event.id);
    const fullCaptures = await commitMany(event.id, full);
    await commitMany(event.id, partial, 3);

    // The session with three can't borrow the other session's five.
    expect((await makeFullSetKeepsake(event.event_token!, partial, "signature")).kind).toBe("not_found");
    const sources = await getFullSetSources(event.id, full);
    if (sources.kind !== "eligible") throw new Error("expected eligible");
    expect(sources.captures.every((c) => c.guest_session_id === full && c.event_id === event.id)).toBe(true);
    expect(sources.captures.map((c) => c.id)).toEqual(fullCaptures.map((c) => c.id));

    // Another event's token with this session, and this token with another event's session.
    const other = await openEvent();
    const otherSession = await guest(other.id);
    await commitMany(other.id, otherSession);
    expect((await makeFullSetKeepsake(other.event_token!, full, "signature")).kind).toBe("not_found");
    expect((await makeFullSetKeepsake(event.event_token!, otherSession, "signature")).kind).toBe("not_found");
    expect((await makeFullSetKeepsake(event.event_token!, null, "signature")).kind).toBe("not_found");
    // The DAL entry point takes no capture ids at all (the route has no parameter for them).
    expect(makeFullSetKeepsake.length).toBeLessThanOrEqual(4);
  }, 120_000);

  it("refuses Single-photo and unknown style ids, sharing off, expiry and media deletion", async () => {
    const event = await openEvent();
    const session = await guest(event.id);
    await commitMany(event.id, session);
    for (const style of ["print", "album", "nope", ""]) {
      expect((await makeFullSetKeepsake(event.event_token!, session, style)).kind).toBe("not_found");
    }
    await update(event.id, { sharing_enabled: false });
    expect((await makeFullSetKeepsake(event.event_token!, session, "signature")).kind).toBe("sharing_disabled");
    expect(await getFullSetAvailability({ ...event, sharing_enabled: false }, session)).toBeNull();
    await update(event.id, { sharing_enabled: true, hosted_until: new Date(Date.now() - 1000).toISOString() });
    expect((await makeFullSetKeepsake(event.event_token!, session, "signature")).kind).toBe("not_found");
    await update(event.id, { hosted_until: null, media_deleted_at: new Date().toISOString() });
    expect((await makeFullSetKeepsake(event.event_token!, session, "signature")).kind).toBe("not_found");
  }, 60_000);

  it("works after capture closes and before reveal; writes nothing; originals and derivatives stay byte-identical", async () => {
    const event = await openEvent();
    const session = await guest(event.id);
    const captures = await commitMany(event.id, session);
    const download = async (path: string) => Buffer.from(await (await supabase.storage.from("captures").download(path)).data!.arrayBuffer());
    const before = await Promise.all(captures.flatMap((c) => [c.storage_path, c.display_path!, c.thumbnail_path!]).map(download));
    const rowsBefore = (await supabase.from("captures").select().eq("event_id", event.id).order("id")).data;
    const listing = async () =>
      (await Promise.all(captures.map((c) => supabase.storage.from("captures").list(c.storage_path.slice(0, c.storage_path.lastIndexOf("/"))))))
        .map((r) => r.data!.map((o) => o.name).sort().join(","));
    const filesBefore = await listing();

    await update(event.id, { capture_closed_at: new Date().toISOString() }); // gallery still unrevealed, private
    for (const { id } of FULL_SET_STYLES) {
      const outcome = await makeFullSetKeepsake(event.event_token!, session, id);
      expect(outcome.kind).toBe("ok");
      if (outcome.kind === "ok") {
        expect(outcome.bytes.includes(Buffer.from("PRIVATE MESSAGE"))).toBe(false);
        expect(outcome.bytes.includes(Buffer.from(event.gallery_token!))).toBe(false);
      }
    }

    const after = await Promise.all(captures.flatMap((c) => [c.storage_path, c.display_path!, c.thumbnail_path!]).map(download));
    after.forEach((bytes, i) => expect(bytes.equals(before[i])).toBe(true));
    expect((await supabase.from("captures").select().eq("event_id", event.id).order("id")).data).toEqual(rowsBefore);
    expect(await listing()).toEqual(filesBefore);
  }, 180_000);

  it("re-confirms before responding: a hide landing mid-render withholds the Full Set", async () => {
    const event = await openEvent();
    const session = await guest(event.id);
    const captures = await commitMany(event.id, session);
    const outcome = await makeFullSetKeepsake(event.event_token!, session, "signature", {
      afterRender: async () => {
        await moderateCapture(hostId, event.id, captures[3].id, "hide");
      },
    });
    expect(outcome.kind).toBe("not_found");
  }, 60_000);

  it("uses the theme as it is at render time", async () => {
    const event = await openEvent({ accent_color: "violet" });
    const session = await guest(event.id);
    await commitMany(event.id, session);
    const a = await makeFullSetKeepsake(event.event_token!, session, "grid");
    await update(event.id, { accent_color: "teal" });
    const b = await makeFullSetKeepsake(event.event_token!, session, "grid");
    if (a.kind !== "ok" || b.kind !== "ok") throw new Error("expected ok");
    const endCard = async (jpeg: Buffer) => [...(await sharp(jpeg).extract({ left: 1100, top: 1700, width: 1, height: 1 }).raw().toBuffer())];
    expect(await endCard(a.bytes)).not.toEqual(await endCard(b.bytes));
  }, 60_000);
});
