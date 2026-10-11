import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServiceClient } from "@/lib/supabase/service-client";
import {
  changeEventSettings,
  closeCapture,
  createDraftEvent,
  openCapture,
  revokeGalleryToken,
  rotateEventToken,
  setEventPlan,
  updateEventConfig,
} from "@/lib/dal/events";
import { createGuestSession } from "@/lib/dal/guest-sessions";
import { grantOperator } from "@/lib/dal/operators";
import {
  activateFreeEvent,
  getLatestPaymentForEvent,
  startProviderCheckout,
} from "@/lib/dal/payments";
import {
  getEventCaptureStats,
  listCapturesForEventHost,
  listOriginalDownloadUrlsForEventHost,
  moderateCapture,
} from "@/lib/dal/captures";
import { getEventAccess } from "@/lib/dal/event-access";
import {
  listSupportActionsForEvent,
  listSupportActionsForOperator,
} from "@/lib/dal/support-actions";
import { getDashboardVersion } from "@/lib/dal/dashboard-live";
import { getSignageDownload } from "@/lib/dal/signage";
import { utcIsoToZonedDateTimeLocal, zonedDateTimeLocalToUtcIso } from "@/lib/events/timezone";
import type { EventRow, SupportActionRow } from "@/lib/db/types";

/**
 * Operator support access (D27, product.md §5.1.3, criteria 89–93; architecture §5b) against the
 * real linked dev Postgres. The counterexamples run for real: an account without a grant, an
 * operator on their own event, every owner-only DAL path called as support, the SQL functions
 * called directly with columns no action admits, a change that fails (no entry may remain),
 * concurrent photo views, and the service role trying to edit or delete the log.
 */
describe("operator support access", { timeout: 120_000 }, () => {
  const supabase = createServiceClient();
  const suffix = crypto.randomUUID();
  const userIds: string[] = [];
  let operatorId: string;
  let operatorEmail: string;
  let strangerId: string;

  async function createUser(label: string): Promise<{ id: string; email: string }> {
    const email = `support-${label}-${crypto.randomUUID().slice(0, 8)}-${suffix}@example.test`;
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password: crypto.randomUUID(),
      email_confirm: true,
    });
    if (error) throw error;
    userIds.push(data.user.id);
    return { id: data.user.id, email };
  }

  beforeAll(async () => {
    const operator = await createUser("operator");
    operatorId = operator.id;
    operatorEmail = operator.email;
    await grantOperator(operatorId);
    strangerId = (await createUser("stranger")).id;
  });

  afterAll(async () => {
    // Hosts first: their events (and so the log rows naming the operator) go with them.
    for (const id of [...userIds].reverse()) await supabase.auth.admin.deleteUser(id);
  });

  async function activeEvent(): Promise<{ hostId: string; event: EventRow }> {
    const hostId = (await createUser("host")).id;
    const draft = await createDraftEvent(hostId, `Support ${crypto.randomUUID().slice(0, 8)}`);
    const result = await activateFreeEvent(hostId, draft.id);
    if (result.outcome !== "activated") throw new Error(`Free activation: ${result.outcome}`);
    return { hostId, event: result.event };
  }

  async function readEvent(eventId: string): Promise<EventRow> {
    const { data, error } = await supabase.from("events").select().eq("id", eventId).single();
    if (error) throw error;
    return data as EventRow;
  }

  async function log(eventId: string): Promise<SupportActionRow[]> {
    const { data, error } = await supabase
      .from("support_actions")
      .select()
      .eq("event_id", eventId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return data as SupportActionRow[];
  }

  /** A committed capture row, seeded directly (no bytes are needed to sign or moderate it). */
  async function committedCapture(eventId: string, options: { thumbnail?: boolean } = {}) {
    const joined = await createGuestSession(eventId, "Guest");
    if (joined.kind !== "joined") throw new Error("join refused");
    const path = `${eventId}/${joined.session.id}/${crypto.randomUUID()}`;
    const { data, error } = await supabase
      .from("captures")
      .insert({
        guest_session_id: joined.session.id,
        event_id: eventId,
        slot_index: 0,
        reserve_key: crypto.randomUUID(),
        status: "committed",
        storage_path: `${path}.jpg`,
        display_path: options.thumbnail === false ? null : `${path}-display.jpg`,
        thumbnail_path: options.thumbnail === false ? null : `${path}-thumb.jpg`,
        mime_type: "image/jpeg",
        expires_at: new Date(Date.now() + 60_000).toISOString(),
        committed_at: new Date().toISOString(),
      })
      .select("id, storage_path")
      .single();
    if (error) throw error;
    return data as { id: string; storage_path: string };
  }

  describe("getEventAccess (criterion 89)", () => {
    it("is owner for the host, support for an operator, and nothing for anyone else", async () => {
      const { hostId, event } = await activeEvent();
      expect((await getEventAccess(hostId, event.id))?.role).toBe("owner");
      expect((await getEventAccess(operatorId, event.id))?.role).toBe("support");
      expect(await getEventAccess(strangerId, event.id)).toBeNull();
      expect(await getEventAccess(operatorId, crypto.randomUUID())).toBeNull();
      expect(await getEventAccess(operatorId, "not-a-uuid")).toBeNull();
    });

    it("is owner on the operator's own event, and the owner's changes are not logged", async () => {
      const draft = await createDraftEvent(operatorId, "Operator's own");
      expect((await getEventAccess(operatorId, draft.id))?.role).toBe("owner");
      await changeEventSettings(operatorId, draft.id, { name: "Renamed by its owner" });
      expect((await readEvent(draft.id)).name).toBe("Renamed by its owner");
      expect(await log(draft.id)).toHaveLength(0);
      await supabase.from("events").delete().eq("id", draft.id);
    });

    it("reads the grant fresh: a revoked operator reaches nothing", async () => {
      const { event } = await activeEvent();
      const revoked = (await createUser("revoked")).id;
      await grantOperator(revoked);
      expect((await getEventAccess(revoked, event.id))?.role).toBe("support");
      await supabase.from("operators").delete().eq("user_id", revoked);
      expect(await getEventAccess(revoked, event.id)).toBeNull();
      expect(await getDashboardVersion(revoked, event.id)).toBeNull();
    });
  });

  describe("support changes (criteria 90, 92)", () => {
    it("applies a settings change exactly like the host's and logs old and new values", async () => {
      const { event } = await activeEvent();
      const updated = await changeEventSettings(operatorId, event.id, {
        name: "Fixed by support",
        hashtag: "#SupportFix",
        visibility: "only_me",
      });
      expect(updated?.name).toBe("Fixed by support");
      expect(updated?.hashtag).toBe("SupportFix"); // normalized, as the host's save does

      const entries = await log(event.id);
      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({
        operator_id: operatorId,
        action: "settings_changed",
        old_value: { name: event.name, hashtag: event.hashtag, visibility: event.visibility },
        new_value: { name: "Fixed by support", hashtag: "SupportFix", visibility: "only_me" },
      });
    });

    it("round-trips a reveal time across a day boundary in the event's timezone", async () => {
      const { event } = await activeEvent();
      // 06:30 on 1 Dec in Manila is 22:30 on 30 Nov in UTC.
      const revealAt = zonedDateTimeLocalToUtcIso("2026-12-01T06:30", "Asia/Manila");
      expect(revealAt).toBe("2026-11-30T22:30:00.000Z");
      await changeEventSettings(operatorId, event.id, {
        timezone: "Asia/Manila",
        revealMode: "custom",
        revealAt,
      });
      const stored = await readEvent(event.id);
      expect(new Date(stored.reveal_at!).toISOString()).toBe("2026-11-30T22:30:00.000Z");
      expect(utcIsoToZonedDateTimeLocal(stored.reveal_at!, stored.timezone)).toBe("2026-12-01T06:30");
    });

    it("refuses an invalid value, and leaves neither a change nor an entry", async () => {
      const { event } = await activeEvent();
      await expect(
        changeEventSettings(operatorId, event.id, { accentColor: "url(javascript:alert(1))" }),
      ).rejects.toThrow();
      // Past the TS validation, straight at the SQL function: the bad enum aborts the whole
      // transaction, including the entry it would have written.
      const direct = await supabase.rpc("support_update_event", {
        p_operator_id: operatorId,
        p_event_id: event.id,
        p_action: "settings_changed",
        p_patch: { name: "Should not stick", visibility: "everyone" },
      });
      expect(direct.error).not.toBeNull();
      expect((await readEvent(event.id)).name).toBe(event.name);
      expect(await log(event.id)).toHaveLength(0);
    });

    it("opens and closes capture, rotates and turns off links, never logging a token", async () => {
      const { event } = await activeEvent();
      expect((await openCapture(operatorId, event.id))?.capture_opened_at).not.toBeNull();
      expect((await closeCapture(operatorId, event.id))?.capture_closed_at).not.toBeNull();
      const rotated = await rotateEventToken(operatorId, event.id);
      expect(rotated?.event_token).not.toBe(event.event_token);
      expect((await revokeGalleryToken(operatorId, event.id))?.gallery_token).toBeNull();

      const entries = await log(event.id);
      expect(entries.map((entry) => entry.action)).toEqual([
        "capture_opened",
        "capture_closed",
        "capture_link_rotated",
        "gallery_link_turned_off",
      ]);
      const serialized = JSON.stringify(entries);
      expect(serialized).not.toContain(event.event_token!);
      expect(serialized).not.toContain(rotated!.event_token!);
      expect(serialized).not.toContain(event.gallery_token!);
      expect(entries[3]).toMatchObject({
        old_value: { gallery_token: true },
        new_value: { gallery_token: false },
      });
    });

    it("hides and unhides a photo, logging each, and changes nothing else on it", async () => {
      const { event } = await activeEvent();
      const capture = await committedCapture(event.id);
      expect(await moderateCapture(operatorId, event.id, capture.id, "hide")).toBe(true);
      expect(await moderateCapture(operatorId, event.id, capture.id, "hide")).toBe(true); // no-op
      expect(await moderateCapture(operatorId, event.id, capture.id, "unhide")).toBe(true);
      const { data: row } = await supabase.from("captures").select().eq("id", capture.id).single();
      expect(row).toMatchObject({ hidden_at: null, deleted_at: null, favorited_at: null, status: "committed" });
      expect((await log(event.id)).map((entry) => entry.action)).toEqual(["photo_hidden", "photo_unhidden"]);
    });
  });

  describe("owner-only paths refuse support (criterion 91)", () => {
    it("refuses delete and favorite, and leaves the capture untouched", async () => {
      const { event } = await activeEvent();
      const capture = await committedCapture(event.id);
      expect(await moderateCapture(operatorId, event.id, capture.id, "delete")).toBe(false);
      expect(await moderateCapture(operatorId, event.id, capture.id, "favorite")).toBe(false);
      const { data: row } = await supabase.from("captures").select().eq("id", capture.id).single();
      expect(row).toMatchObject({ deleted_at: null, favorited_at: null });
      expect(await log(event.id)).toHaveLength(0);
    });

    it("refuses plan, payment, checkout and original downloads", async () => {
      const hostId = (await createUser("draft-host")).id;
      const draft = await createDraftEvent(hostId, "Draft for support");
      expect(await setEventPlan(operatorId, draft.id, "free")).toBeNull();
      expect(await setEventPlan(operatorId, draft.id, "intimate")).toBeNull();
      expect((await activateFreeEvent(operatorId, draft.id)).outcome).toBe("not_found");
      expect(await startProviderCheckout(operatorId, draft.id, "http://localhost:3000")).toBeNull();
      expect(await getLatestPaymentForEvent(operatorId, draft.id)).toBeNull();
      expect(await updateEventConfig(operatorId, draft.id, { name: "Wizard is owner-only" })).toBeNull();
      const stored = await readEvent(draft.id);
      expect(stored).toMatchObject({ plan: null, activated_at: null, name: "Draft for support" });

      const { event } = await activeEvent();
      await committedCapture(event.id);
      expect(await listOriginalDownloadUrlsForEventHost(operatorId, event.id, 0)).toBeNull();
    });

    it("refuses columns no action admits, an unknown action, and a non-operator, in SQL", async () => {
      const { event } = await activeEvent();
      const attempts = [
        { p_action: "settings_changed", p_patch: { plan: "premium" } },
        { p_action: "settings_changed", p_patch: { activated_at: new Date().toISOString() } },
        { p_action: "settings_changed", p_patch: { guest_session_cap: 999 } },
        { p_action: "settings_changed", p_patch: { host_id: operatorId } },
        { p_action: "capture_opened", p_patch: { name: "wrong action for this column" } },
        { p_action: "plan_changed", p_patch: {} },
      ];
      for (const attempt of attempts) {
        const { error } = await supabase.rpc("support_update_event", {
          p_operator_id: operatorId,
          p_event_id: event.id,
          ...attempt,
        });
        expect(error?.code).toBe("P0007");
      }
      const notOperator = await supabase.rpc("support_update_event", {
        p_operator_id: strangerId,
        p_event_id: event.id,
        p_action: "settings_changed",
        p_patch: { name: "x" },
      });
      expect(notOperator.error?.message).toBe("not_operator");
      expect(await log(event.id)).toHaveLength(0);
      expect(await readEvent(event.id)).toMatchObject({ plan: event.plan, host_id: event.host_id });
    });

    it("refuses support SQL on the operator's own event", async () => {
      const draft = await createDraftEvent(operatorId, "Own event, SQL");
      const { error } = await supabase.rpc("support_update_event", {
        p_operator_id: operatorId,
        p_event_id: draft.id,
        p_action: "settings_changed",
        p_patch: { name: "x" },
      });
      expect(error?.message).toBe("owns_event");
      await supabase.from("events").delete().eq("id", draft.id);
    });

    it("refuses everything to an account without a grant", async () => {
      const { event } = await activeEvent();
      expect(await changeEventSettings(strangerId, event.id, { name: "x" })).toBeNull();
      expect(await openCapture(strangerId, event.id)).toBeNull();
      expect(await listCapturesForEventHost(strangerId, event.id)).toBeNull();
      expect(await getEventCaptureStats(strangerId, event.id)).toBeNull();
      expect(await listSupportActionsForEvent(strangerId, event.id)).toBeNull();
      expect(await getSignageDownload(strangerId, event.id, "digital", "http://localhost:3000")).toBeNull();
    });
  });

  describe("photo views (criterion 92, display derivatives only)", () => {
    it("signs thumbnails only, never an original, and leaves out a capture with no thumbnail", async () => {
      const { event } = await activeEvent();
      const withThumb = await committedCapture(event.id);
      await committedCapture(event.id, { thumbnail: false });
      const list = await listCapturesForEventHost(operatorId, event.id);
      expect(list).toHaveLength(1);
      expect(list![0].id).toBe(withThumb.id);
      expect(list![0].downloadUrl).toBeNull();
      expect(list![0].thumbnailUrl).toContain("-thumb.jpg");
      expect(list![0].thumbnailUrl).not.toContain(encodeURIComponent(withThumb.storage_path));

      // The owner still gets both, including the original.
      const owner = await listCapturesForEventHost(event.host_id, event.id);
      expect(owner).toHaveLength(2);
      expect(owner!.every((capture) => capture.downloadUrl !== null)).toBe(true);
    });

    it("logs one view per operator, event and 30 minutes, even under concurrent loads", async () => {
      const { event } = await activeEvent();
      await committedCapture(event.id);
      await Promise.all(Array.from({ length: 6 }, () => listCapturesForEventHost(operatorId, event.id)));
      await listCapturesForEventHost(operatorId, event.id);
      const views = (await log(event.id)).filter((entry) => entry.action === "photos_viewed");
      expect(views).toHaveLength(1);
      // The owner viewing photos is not support, and is never logged.
      await listCapturesForEventHost(event.host_id, event.id);
      expect(await log(event.id)).toHaveLength(1);
    });

    it("logs a signage download", async () => {
      const { event } = await activeEvent();
      expect(await getSignageDownload(operatorId, event.id, "digital", "http://localhost:3000")).not.toBeNull();
      expect((await log(event.id)).map((entry) => entry.action)).toEqual(["signage_downloaded"]);
    });
  });

  describe("the log (criteria 92, 93)", () => {
    it("is shown to the host without the operator, and to the Console with the operator", async () => {
      const { hostId, event } = await activeEvent();
      await openCapture(operatorId, event.id);
      await closeCapture(operatorId, event.id);

      const hostView = await listSupportActionsForEvent(hostId, event.id);
      expect(hostView!.map((entry) => entry.action)).toEqual(["capture_closed", "capture_opened"]);
      expect(JSON.stringify(hostView)).not.toContain(operatorId);
      expect(JSON.stringify(hostView)).not.toContain(operatorEmail);

      const consoleView = await listSupportActionsForOperator(event.id);
      expect(consoleView.map((entry) => entry.action)).toEqual(["capture_closed", "capture_opened"]);
      expect(consoleView[0].operatorEmail).toBe(operatorEmail);
    });

    it("can't be edited or deleted, even by the service role", async () => {
      const { event } = await activeEvent();
      await openCapture(operatorId, event.id);
      const [entry] = await log(event.id);

      const edit = await supabase.from("support_actions").update({ action: "capture_closed" }).eq("id", entry.id);
      expect(edit.error).not.toBeNull();
      const removal = await supabase.from("support_actions").delete().eq("id", entry.id);
      expect(removal.error).not.toBeNull();
      expect(await log(event.id)).toEqual([entry]);
    });
  });
});
