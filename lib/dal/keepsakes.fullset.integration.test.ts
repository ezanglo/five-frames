import { afterAll, beforeAll, describe, expect, it } from "vitest";
import sharp from "sharp";
import { captureStorage } from "@/test/storage";
import { createServiceClient } from "@/lib/supabase/service-client";
import { createDraftEvent } from "@/lib/dal/events";
import { createGuestSession } from "@/lib/dal/guest-sessions";
import { commitCapture, moderateCapture, reserveCapture } from "@/lib/dal/captures";
import { generateLinkToken } from "@/lib/auth/link-tokens";
import {
  getFullSetAvailability,
  getFullSetSources,
  isFullSetPreviewable,
  listHostFullSets,
  makeFullSetKeepsake,
  makeHostFullSetKeepsake,
} from "@/lib/dal/keepsakes";
import { grantOperator } from "@/lib/dal/operators";
import { FULL_SET_SLOTS } from "@/lib/keepsakes/geometry";
import { FULL_SET_STYLES, PRESELECTED_FULL_SET_STYLE } from "@/lib/keepsakes/styles";
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
      const reserved = await reserveCapture(eventId, sessionId, crypto.randomUUID(), null);
      if (reserved.kind !== "reserved") throw new Error(`expected reserved, got ${reserved.kind}`);
      await captureStorage.put(reserved.capture.storage_path, photos[i], "image/jpeg");
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
    const pending = await reserveCapture(event.id, session, crypto.randomUUID(), null);
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
    expect((await reserveCapture(event.id, session, crypto.randomUUID(), null)).kind).toBe("frames_exhausted");
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

  it("refuses Single-photo and unknown style ids, sharing off and media deletion; works once expired (D29)", async () => {
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
    expect((await makeFullSetKeepsake(event.event_token!, session, "signature")).kind).toBe("ok");
    await update(event.id, { hosted_until: null, media_deleted_at: new Date().toISOString() });
    expect((await makeFullSetKeepsake(event.event_token!, session, "signature")).kind).toBe("not_found");
  }, 60_000);

  it("on a Free event, makes the Full Set only in the signature style (criterion 84)", async () => {
    const event = await openEvent({ plan: "free" });
    const session = await guest(event.id);
    await commitMany(event.id, session);
    for (const { id } of FULL_SET_STYLES) {
      const outcome = await makeFullSetKeepsake(event.event_token!, session, id);
      expect(outcome.kind).toBe(id === PRESELECTED_FULL_SET_STYLE ? "ok" : "not_found");
    }
  }, 60_000);

  it("works after capture closes and before reveal; writes nothing; originals and derivatives stay byte-identical", async () => {
    const event = await openEvent();
    const session = await guest(event.id);
    const captures = await commitMany(event.id, session);
    const download = async (path: string) => (await captureStorage.get(path))!;
    const before = await Promise.all(captures.flatMap((c) => [c.storage_path, c.display_path!, c.thumbnail_path!]).map(download));
    const rowsBefore = (await supabase.from("captures").select().eq("event_id", event.id).order("id")).data;
    const listing = async () =>
      (await Promise.all(captures.map((c) => captureStorage.list(c.storage_path.slice(0, c.storage_path.lastIndexOf("/"))))))
        .map((paths) => paths.map((p) => p.slice(p.lastIndexOf("/") + 1)).sort().join(","));
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

  it("previews (never makes) a partial set only while capture is open and five are still reachable (D29)", async () => {
    const event = await openEvent();
    const session = await guest(event.id);
    expect(await isFullSetPreviewable(event, session)).toBe(true);
    const captures = await commitMany(event.id, session, 3);
    expect(await isFullSetPreviewable(event, session)).toBe(true);
    // A preview never authorizes an export: the Full Set route still refuses three photos.
    expect((await makeFullSetKeepsake(event.event_token!, session, "signature")).kind).toBe("not_found");

    // A hidden photo can still be unhidden, so the preview stays; a deleted one never returns.
    await moderateCapture(hostId, event.id, captures[0].id, "hide");
    expect(await isFullSetPreviewable(event, session)).toBe(true);
    await moderateCapture(hostId, event.id, captures[0].id, "delete");
    expect(await isFullSetPreviewable(event, session)).toBe(false);

    const other = await guest(event.id);
    await commitMany(event.id, other, 2);
    expect(await isFullSetPreviewable({ ...event, sharing_enabled: false }, other)).toBe(false);
    const closed = await update(event.id, { capture_closed_at: new Date().toISOString() });
    expect(await isFullSetPreviewable(closed, other)).toBe(false);
  }, 120_000);

  it("is never previewable once all five are kept: it is simply available", async () => {
    const event = await openEvent();
    const session = await guest(event.id);
    await commitMany(event.id, session);
    expect(await isFullSetPreviewable(event, session)).toBe(false);
    expect(await getFullSetAvailability(event, session)).not.toBeNull();
  }, 120_000);

  describe("the host's Full Set of one guest (D29)", () => {
    it("lists only eligible sessions and makes the same five, in the same order, as the guest gets", async () => {
      const event = await openEvent();
      const full = await guest(event.id);
      const partial = await guest(event.id);
      const captures = await commitMany(event.id, full);
      await commitMany(event.id, partial, 2);

      const sets = await listHostFullSets(hostId, event.id);
      expect(sets).toEqual({ [full]: captures.map((c) => c.id) });

      const outcome = await makeHostFullSetKeepsake(hostId, event.id, full, "signature");
      if (outcome.kind !== "ok") throw new Error(`expected ok, got ${outcome.kind}`);
      expect(await signatureOrder(outcome.bytes)).toEqual([0, 1, 2, 3, 4]);
      expect((await makeHostFullSetKeepsake(hostId, event.id, partial, "signature")).kind).toBe("not_found");
    }, 120_000);

    it("follows moderation and plan, ignores the guest sharing setting, and works after expiry", async () => {
      const event = await openEvent({ plan: "free", sharing_enabled: false });
      const session = await guest(event.id);
      const captures = await commitMany(event.id, session);
      expect((await makeHostFullSetKeepsake(hostId, event.id, session, "signature")).kind).toBe("ok");
      const other = FULL_SET_STYLES.find((s) => s.id !== PRESELECTED_FULL_SET_STYLE)!.id;
      expect((await makeHostFullSetKeepsake(hostId, event.id, session, other)).kind).toBe("not_found");
      expect((await makeHostFullSetKeepsake(hostId, event.id, session, "print")).kind).toBe("not_found");

      await moderateCapture(hostId, event.id, captures[2].id, "hide");
      expect(await listHostFullSets(hostId, event.id)).toEqual({});
      expect((await makeHostFullSetKeepsake(hostId, event.id, session, "signature")).kind).toBe("not_found");
      await moderateCapture(hostId, event.id, captures[2].id, "unhide");

      await update(event.id, { hosted_until: new Date(Date.now() - 1000).toISOString() });
      expect((await makeHostFullSetKeepsake(hostId, event.id, session, "signature")).kind).toBe("ok");
      await update(event.id, { media_deleted_at: new Date().toISOString() });
      expect((await makeHostFullSetKeepsake(hostId, event.id, session, "signature")).kind).toBe("not_found");
      expect(await listHostFullSets(hostId, event.id)).toBeNull();
    }, 120_000);

    it("admits owner and support (logged once per guest per 30 minutes); another host gets not-found", async () => {
      const event = await openEvent();
      const session = await guest(event.id);
      await commitMany(event.id, session);
      const others: string[] = [];
      try {
        const ids: Record<"host" | "operator", string> = { host: "", operator: "" };
        for (const role of ["host", "operator"] as const) {
          const { data, error } = await supabase.auth.admin.createUser({
            email: `fullset-${role}-${crypto.randomUUID()}@example.test`,
            password: crypto.randomUUID(),
            email_confirm: true,
          });
          if (error) throw error;
          others.push(data.user.id);
          ids[role] = data.user.id;
        }
        await grantOperator(ids.operator);

        expect(await listHostFullSets(ids.host, event.id)).toBeNull();
        expect((await makeHostFullSetKeepsake(ids.host, event.id, session, "signature")).kind).toBe("not_found");

        expect(Object.keys((await listHostFullSets(ids.operator, event.id)) ?? {})).toEqual([session]);
        expect((await makeHostFullSetKeepsake(ids.operator, event.id, session, "signature")).kind).toBe("ok");
        expect((await makeHostFullSetKeepsake(ids.operator, event.id, session, "grid")).kind).toBe("ok");
        const { data: entries, error } = await supabase
          .from("support_actions")
          .select("action, new_value")
          .eq("event_id", event.id);
        if (error) throw error;
        expect(entries).toEqual([{ action: "keepsake_made", new_value: { guest_session_id: session, style: "signature" } }]);

        // The owner's own keepsakes are never logged.
        expect((await makeHostFullSetKeepsake(hostId, event.id, session, "signature")).kind).toBe("ok");
        const { count } = await supabase.from("support_actions").select("id", { count: "exact", head: true }).eq("event_id", event.id);
        expect(count).toBe(1);
        expect((await makeHostFullSetKeepsake(hostId, event.id, "not-a-uuid", "signature")).kind).toBe("not_found");
      } finally {
        await supabase.from("events").delete().eq("id", event.id);
        for (const id of others) {
          await supabase.from("operators").delete().eq("user_id", id);
          await supabase.auth.admin.deleteUser(id);
        }
      }
    }, 120_000);
  });
});
