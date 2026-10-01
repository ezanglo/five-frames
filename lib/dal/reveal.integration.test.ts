import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServiceClient } from "@/lib/supabase/service-client";
import { createDraftEvent, getEventForHost, updateEventConfig } from "@/lib/dal/events";
import { isGalleryOpenToLinkHolders, isGalleryRevealed } from "@/lib/events/lifecycle";
import { utcIsoToZonedDateTimeLocal, zonedDateTimeLocalToUtcIso } from "@/lib/events/timezone";

/**
 * Custom gallery reveal time, full round trip against the real dev Postgres (product.md §7.4;
 * verified in Slice 18). The host types a wall-clock time in the event's own timezone; the
 * save converts it exactly as `parseAfterParty` does, the DAL persists `reveal_at`, and a reload
 * shows the same wall-clock value. The case crosses a day boundary: 07:30 on 21 Nov in Manila is
 * 23:30 on 20 Nov in UTC.
 */
describe("custom reveal round trip (real Postgres)", { timeout: 60_000 }, () => {
  const supabase = createServiceClient();
  let hostId: string;

  beforeAll(async () => {
    const { data, error } = await supabase.auth.admin.createUser({
      email: `reveal-host-${crypto.randomUUID()}@example.test`,
      password: crypto.randomUUID(),
      email_confirm: true,
    });
    if (error) throw error;
    hostId = data.user.id;
  });

  afterAll(async () => {
    if (hostId) await supabase.auth.admin.deleteUser(hostId);
  });

  it("persists reveal_at in UTC and reloads the same event-local time", async () => {
    const event = await createDraftEvent(hostId, "Reveal round trip");
    const typed = "2026-11-21T07:30";
    await updateEventConfig(hostId, event.id, {
      timezone: "Asia/Manila",
      revealMode: "custom",
      revealAt: zonedDateTimeLocalToUtcIso(typed, "Asia/Manila"),
      visibility: "anyone_with_link",
    });

    const saved = (await getEventForHost(hostId, event.id))!;
    expect(saved.reveal_mode).toBe("custom");
    expect(new Date(saved.reveal_at!).toISOString()).toBe("2026-11-20T23:30:00.000Z");
    expect(utcIsoToZonedDateTimeLocal(saved.reveal_at!, saved.timezone)).toBe(typed);

    // Editing another field leaves the stored instant alone.
    await updateEventConfig(hostId, event.id, { name: "Reveal round trip (renamed)" });
    const edited = (await getEventForHost(hostId, event.id))!;
    expect(edited.reveal_at).toBe(saved.reveal_at);

    // Gated on activation, then on the instant; "only me" still wins.
    const before = new Date("2026-11-20T23:29:59.000Z");
    const at = new Date("2026-11-20T23:30:00.000Z");
    expect(isGalleryRevealed(edited, at)).toBe(false);
    const activated = { ...edited, activated_at: "2026-11-01T00:00:00.000Z" };
    expect(isGalleryRevealed(activated, before)).toBe(false);
    expect(isGalleryOpenToLinkHolders(activated, at)).toBe(true);
    expect(isGalleryOpenToLinkHolders({ ...activated, visibility: "only_me" }, at)).toBe(false);

    // Switching back to "after the event" clears the time.
    await updateEventConfig(hostId, event.id, { revealMode: "after_event", revealAt: null });
    const cleared = (await getEventForHost(hostId, event.id))!;
    expect(cleared.reveal_mode).toBe("after_event");
    expect(cleared.reveal_at).toBeNull();
  });
});
