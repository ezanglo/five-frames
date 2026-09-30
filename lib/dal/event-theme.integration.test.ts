import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServiceClient } from "@/lib/supabase/service-client";
import { createDraftEvent, getEventForHost, updateEventConfig } from "@/lib/dal/events";
import {
  beginThemeImageUpload,
  commitThemeImageUpload,
  getEventThemeForGallery,
  getEventThemeForGuest,
  getEventThemeForHost,
  removeThemeImage,
} from "@/lib/dal/event-theme";
import { getOperatorEventDetail, listEventsForOperator } from "@/lib/dal/operator-events";
import { permanentlyDeleteEventMedia } from "@/lib/dal/lifecycle";
import { EVENT_THEME_BUCKET } from "@/lib/theme/image";
import type { EventRow } from "@/lib/db/types";

/**
 * Runs against the real linked dev Postgres and the real private `event-theme` bucket
 * (architecture §11, roadmap Slice 15). The ownership predicate, the server-built paths and the
 * prune are the security and cleanup boundaries here, so they are proven for real: another host
 * can't set, read or remove a theme; replace/remove leave exactly the current object (or none);
 * refused uploads leave the previous image; the locked gallery and the Operator Console never
 * get theme media; and D18 permanent deletion empties the folder.
 */
describe("event theme image", { timeout: 60_000 }, () => {
  const supabase = createServiceClient();
  const bucket = supabase.storage.from(EVENT_THEME_BUCKET);
  const suffix = crypto.randomUUID();
  const eventIds: string[] = [];
  let hostAId: string;
  let hostBId: string;

  beforeAll(async () => {
    for (const label of ["a", "b"] as const) {
      const { data, error } = await supabase.auth.admin.createUser({
        email: `theme-host-${label}-${suffix}@example.test`,
        password: crypto.randomUUID(),
        email_confirm: true,
      });
      if (error) throw error;
      if (label === "a") hostAId = data.user.id;
      else hostBId = data.user.id;
    }
  });

  afterAll(async () => {
    for (const eventId of eventIds) {
      const objects = await folder(eventId);
      if (objects.length) await bucket.remove(objects);
    }
    if (hostAId) await supabase.auth.admin.deleteUser(hostAId);
    if (hostBId) await supabase.auth.admin.deleteUser(hostBId);
  });

  async function newEvent(hostId = hostAId): Promise<EventRow> {
    const event = await createDraftEvent(hostId, `Theme event ${crypto.randomUUID()}`);
    eventIds.push(event.id);
    return event;
  }

  async function folder(eventId: string): Promise<string[]> {
    const { data, error } = await bucket.list(eventId, { limit: 100 });
    if (error) throw error;
    return (data ?? []).filter((o) => o.id).map((o) => `${eventId}/${o.name}`);
  }

  async function photo(width = 2000, height = 1400, color = "#c87a3c") {
    return sharp({ create: { width, height, channels: 3, background: color } }).jpeg().toBuffer();
  }

  /** What the browser does: begin, PUT to the signed URL, commit. */
  async function upload(
    eventId: string,
    bytes: Buffer,
    contentType = "image/jpeg",
    hostId = hostAId,
  ) {
    const begun = await beginThemeImageUpload(hostId, eventId, {
      sizeBytes: bytes.length,
      contentType,
    });
    if (begun.kind !== "ready") return { begun, committed: null };
    const put = await fetch(begun.signedUrl, {
      method: "PUT",
      body: new Uint8Array(bytes),
      headers: { "content-type": contentType },
    });
    expect(put.ok).toBe(true);
    const committed = await commitThemeImageUpload(hostId, eventId, begun.uploadId);
    return { begun, committed };
  }

  async function row(eventId: string) {
    const event = await getEventForHost(hostAId, eventId);
    if (!event) throw new Error("event missing");
    return event;
  }

  it("saves a normalized image as the only object in the event's folder, readable by its owner", async () => {
    const event = await newEvent();
    const { committed } = await upload(event.id, await photo());
    expect(committed?.kind).toBe("saved");

    const saved = await row(event.id);
    expect(saved.theme_image_path).toMatch(new RegExp(`^${event.id}/[0-9a-f-]{36}\\.jpg$`));
    expect(await folder(event.id)).toEqual([saved.theme_image_path]);

    const theme = await getEventThemeForHost(hostAId, event.id);
    expect(theme?.imageUrl).toContain("/storage/v1/object/sign/");
    const res = await fetch(theme!.imageUrl!);
    expect(res.ok).toBe(true);
    expect(res.headers.get("content-type")).toBe("image/jpeg");
  });

  it("replacing leaves only the new image; removing leaves nothing and returns to no image", async () => {
    const event = await newEvent();
    await upload(event.id, await photo(2000, 1400, "#112233"));
    const first = (await row(event.id)).theme_image_path;
    const firstUrl = (await getEventThemeForHost(hostAId, event.id))!.imageUrl!;

    await upload(event.id, await photo(1800, 1800, "#445566"));
    const second = (await row(event.id)).theme_image_path;
    expect(second).not.toBe(first);
    expect(await folder(event.id)).toEqual([second]);
    // The old object was pruned, so a URL minted for it stops resolving now, not just at expiry.
    expect((await fetch(firstUrl)).ok).toBe(false);

    expect(await removeThemeImage(hostAId, event.id)).toEqual({ kind: "removed" });
    expect((await row(event.id)).theme_image_path).toBeNull();
    expect(await folder(event.id)).toEqual([]);
    expect((await getEventThemeForHost(hostAId, event.id))?.imageUrl).toBeNull();
  });

  it("a refused replacement keeps the previous image and discards its own upload", async () => {
    const event = await newEvent();
    await upload(event.id, await photo());
    const before = (await row(event.id)).theme_image_path;

    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="900" height="900"/>');
    const spoofed = await upload(event.id, svg, "image/png");
    expect(spoofed.committed).toEqual({ kind: "refused", reason: "unsupported" });

    const tiny = await upload(event.id, await photo(700, 400));
    expect(tiny.committed).toEqual({ kind: "refused", reason: "too_small" });

    expect((await row(event.id)).theme_image_path).toBe(before);
    expect(await folder(event.id)).toEqual([before]);
  });

  it("refuses SVG and oversized sources before any upload capability exists", async () => {
    const event = await newEvent();
    expect(
      await beginThemeImageUpload(hostAId, event.id, { sizeBytes: 1000, contentType: "image/svg+xml" }),
    ).toEqual({ kind: "refused", reason: "unsupported" });
    expect(
      await beginThemeImageUpload(hostAId, event.id, { sizeBytes: 1000, contentType: "image/gif" }),
    ).toEqual({ kind: "refused", reason: "unsupported" });
    expect(
      await beginThemeImageUpload(hostAId, event.id, {
        sizeBytes: 15 * 1024 * 1024 + 1,
        contentType: "image/jpeg",
      }),
    ).toEqual({ kind: "refused", reason: "too_large" });
  });

  it("Storage itself refuses an over-limit body or a disallowed type on the signed URL", async () => {
    const event = await newEvent();
    const begun = await beginThemeImageUpload(hostAId, event.id, {
      sizeBytes: 1000,
      contentType: "image/jpeg",
    });
    if (begun.kind !== "ready") throw new Error("expected ready");

    const oversized = await fetch(begun.signedUrl, {
      method: "PUT",
      body: new Uint8Array(15 * 1024 * 1024 + 1024),
      headers: { "content-type": "image/jpeg" },
    });
    expect(oversized.ok).toBe(false);

    const svg = await fetch(begun.signedUrl, {
      method: "PUT",
      body: "<svg xmlns='http://www.w3.org/2000/svg'/>",
      headers: { "content-type": "image/svg+xml" },
    });
    expect(svg.ok).toBe(false);

    expect(await commitThemeImageUpload(hostAId, event.id, begun.uploadId)).toEqual({
      kind: "refused",
      reason: "missing",
    });
    expect((await row(event.id)).theme_image_path).toBeNull();
  });

  it("another host can't begin, commit, remove or read this event's theme", async () => {
    const event = await newEvent();
    await upload(event.id, await photo());
    const path = (await row(event.id)).theme_image_path;

    expect(
      await beginThemeImageUpload(hostBId, event.id, { sizeBytes: 1000, contentType: "image/jpeg" }),
    ).toEqual({ kind: "not_found" });
    expect(await removeThemeImage(hostBId, event.id)).toEqual({ kind: "not_found" });
    expect(await getEventThemeForHost(hostBId, event.id)).toBeNull();

    // Host A's valid upload id, committed by host B against host A's event: refused.
    const begun = await beginThemeImageUpload(hostAId, event.id, {
      sizeBytes: 1000,
      contentType: "image/jpeg",
    });
    if (begun.kind !== "ready") throw new Error("expected ready");
    await fetch(begun.signedUrl, {
      method: "PUT",
      body: new Uint8Array(await photo()),
      headers: { "content-type": "image/jpeg" },
    });
    expect(await commitThemeImageUpload(hostBId, event.id, begun.uploadId)).toEqual({
      kind: "not_found",
    });

    // …and host B committing it against their own event can't reach host A's folder.
    const eventB = await newEvent(hostBId);
    expect(await commitThemeImageUpload(hostBId, eventB.id, begun.uploadId)).toEqual({
      kind: "refused",
      reason: "missing",
    });
    expect((await getEventForHost(hostBId, eventB.id))?.theme_image_path).toBeNull();
    expect((await row(event.id)).theme_image_path).toBe(path);
  });

  it("refuses a malformed upload id instead of building a path from it", async () => {
    const event = await newEvent();
    expect(await commitThemeImageUpload(hostAId, event.id, "../other-event/x")).toEqual({
      kind: "refused",
      reason: "missing",
    });
  });

  it("the database refuses a theme path outside the event's own folder", async () => {
    const event = await newEvent();
    const { error } = await supabase
      .from("events")
      .update({ theme_image_path: `${crypto.randomUUID()}/stolen.jpg` })
      .eq("id", event.id);
    expect(error?.message).toMatch(/events_theme_image_path_scoped/);
  });

  it("theme changes never touch payment, activation, tokens or lifecycle", async () => {
    const event = await newEvent();
    const now = new Date().toISOString();
    const { data: activated, error } = await supabase
      .from("events")
      .update({
        activated_at: now,
        event_token: `evt-${crypto.randomUUID()}`,
        gallery_token: `gal-${crypto.randomUUID()}`,
        capture_opened_at: now,
        safety_net_closes_at: new Date(Date.now() + 86_400_000).toISOString(),
        hosted_until: new Date(Date.now() + 30 * 86_400_000).toISOString(),
        grace_until: new Date(Date.now() + 60 * 86_400_000).toISOString(),
      })
      .eq("id", event.id)
      .select()
      .single();
    if (error) throw error;

    const untouched = (e: EventRow) => ({
      activated_at: e.activated_at,
      activating_payment_id: e.activating_payment_id,
      event_token: e.event_token,
      gallery_token: e.gallery_token,
      capture_opened_at: e.capture_opened_at,
      capture_closed_at: e.capture_closed_at,
      safety_net_closes_at: e.safety_net_closes_at,
      hosted_until: e.hosted_until,
      grace_until: e.grace_until,
      media_deleted_at: e.media_deleted_at,
      guest_session_count: e.guest_session_count,
    });
    const before = untouched(activated as EventRow);

    await upload(event.id, await photo());
    await updateEventConfig(hostAId, event.id, { accentColor: "teal", hashtag: "#Santos" });
    await upload(event.id, await photo(1900, 1900, "#abcdef"));
    await removeThemeImage(hostAId, event.id);

    const after = await row(event.id);
    expect(untouched(after)).toEqual(before);
    expect(after.accent_color).toBe("teal");
    expect(after.hashtag).toBe("Santos");
  });

  it("guests reach the image only through the current event token of an activated event", async () => {
    const event = await newEvent();
    await upload(event.id, await photo());
    const token = `evt-${crypto.randomUUID()}`;

    // Draft: no token exists, and even a guessed one resolves to nothing.
    expect(await getEventThemeForGuest(token)).toBeNull();

    await supabase
      .from("events")
      .update({ activated_at: new Date().toISOString(), event_token: token })
      .eq("id", event.id);
    const guest = await getEventThemeForGuest(token);
    expect(guest?.imageUrl).toContain("/storage/v1/object/sign/");

    // Capture closed: the theme still shows (it isn't the capture gate).
    await supabase
      .from("events")
      .update({ capture_opened_at: new Date().toISOString(), capture_closed_at: new Date().toISOString() })
      .eq("id", event.id);
    expect((await getEventThemeForGuest(token))?.imageUrl).toBeTruthy();

    // Rotated token: the old one resolves to nothing.
    await supabase.from("events").update({ event_token: `evt-${crypto.randomUUID()}` }).eq("id", event.id);
    expect(await getEventThemeForGuest(token)).toBeNull();
  });

  it("the locked or private gallery gets no theme at all; the granted gallery does", async () => {
    const event = await newEvent();
    await upload(event.id, await photo());
    const galleryToken = `gal-${crypto.randomUUID()}`;
    await supabase
      .from("events")
      .update({
        activated_at: new Date().toISOString(),
        gallery_token: galleryToken,
        reveal_mode: "after_event",
        visibility: "anyone_with_link",
      })
      .eq("id", event.id);

    // Not yet revealed (capture hasn't ended).
    expect(await getEventThemeForGallery(galleryToken)).toBeNull();

    // Revealed, but "only me".
    await supabase
      .from("events")
      .update({ reveal_mode: "immediate", visibility: "only_me" })
      .eq("id", event.id);
    expect(await getEventThemeForGallery(galleryToken)).toBeNull();

    // Revealed to link holders: granted.
    await supabase.from("events").update({ visibility: "anyone_with_link" }).eq("id", event.id);
    const granted = await getEventThemeForGallery(galleryToken);
    expect(granted?.imageUrl).toContain("/storage/v1/object/sign/");

    expect(await getEventThemeForGallery(`gal-${crypto.randomUUID()}`)).toBeNull();
  });

  it("the Operator Console never receives the theme image path", async () => {
    const event = await newEvent();
    await upload(event.id, await photo());
    expect((await row(event.id)).theme_image_path).not.toBeNull();

    const detail = await getOperatorEventDetail(event.id);
    expect(detail?.event.theme_image_path).toBeNull();
    const listed = (await listEventsForOperator(event.name)).find((e) => e.id === event.id);
    expect(listed?.theme_image_path).toBeNull();
    expect(JSON.stringify(detail)).not.toContain(EVENT_THEME_BUCKET);
  });

  it("refuses theme image changes once the event has expired", async () => {
    const event = await newEvent();
    await supabase
      .from("events")
      .update({
        activated_at: new Date(Date.now() - 400 * 86_400_000).toISOString(),
        hosted_until: new Date(Date.now() - 86_400_000).toISOString(),
        grace_until: new Date(Date.now() + 29 * 86_400_000).toISOString(),
      })
      .eq("id", event.id);
    expect(
      await beginThemeImageUpload(hostAId, event.id, { sizeBytes: 1000, contentType: "image/jpeg" }),
    ).toEqual({ kind: "not_editable" });
    expect(await removeThemeImage(hostAId, event.id)).toEqual({ kind: "not_editable" });
  });

  it("D18 permanent deletion removes every theme object and clears the pointer, and reruns safely", async () => {
    const event = await newEvent();
    await upload(event.id, await photo());
    // A leftover raw upload from an abandoned attempt.
    const begun = await beginThemeImageUpload(hostAId, event.id, {
      sizeBytes: 1000,
      contentType: "image/jpeg",
    });
    if (begun.kind !== "ready") throw new Error("expected ready");
    await fetch(begun.signedUrl, {
      method: "PUT",
      body: new Uint8Array(await photo()),
      headers: { "content-type": "image/jpeg" },
    });
    expect((await folder(event.id)).length).toBe(2);

    await supabase
      .from("events")
      .update({
        activated_at: new Date(Date.now() - 400 * 86_400_000).toISOString(),
        hosted_until: new Date(Date.now() - 40 * 86_400_000).toISOString(),
        grace_until: new Date(Date.now() - 86_400_000).toISOString(),
      })
      .eq("id", event.id);

    const result = await permanentlyDeleteEventMedia(event.id);
    expect(result.outcome).toBe("deleted");
    expect(await folder(event.id)).toEqual([]);
    const after = await row(event.id);
    expect(after.theme_image_path).toBeNull();
    expect(after.media_deleted_at).not.toBeNull();

    expect((await permanentlyDeleteEventMedia(event.id)).outcome).toBe("already_deleted");
    expect(
      await beginThemeImageUpload(hostAId, event.id, { sizeBytes: 1000, contentType: "image/jpeg" }),
    ).toEqual({ kind: "not_editable" });
  });

  it("round-trips accent and hashtag: set, reload, edit, clear back to the default event", async () => {
    const event = await newEvent();
    expect(event.accent_color).toBe("violet");
    expect(event.hashtag).toBeNull();
    expect(event.theme_image_path).toBeNull();

    await updateEventConfig(hostAId, event.id, { accentColor: "marigold", hashtag: "#DaniTurns40" });
    let reloaded = await row(event.id);
    expect([reloaded.accent_color, reloaded.hashtag]).toEqual(["marigold", "DaniTurns40"]);
    expect(await getEventThemeForHost(hostAId, event.id)).toEqual({
      accent: "marigold",
      hashtag: "DaniTurns40",
      imageUrl: null,
    });

    await updateEventConfig(hostAId, event.id, { accentColor: "ocean", hashtag: "AñaYJosé" });
    reloaded = await row(event.id);
    expect([reloaded.accent_color, reloaded.hashtag]).toEqual(["ocean", "AñaYJosé"]);

    await updateEventConfig(hostAId, event.id, { accentColor: "violet", hashtag: "" });
    reloaded = await row(event.id);
    expect([reloaded.accent_color, reloaded.hashtag]).toEqual(["violet", null]);
  });

  it("refuses an invalid hashtag or an unknown accent on write, leaving the row unchanged", async () => {
    const event = await newEvent();
    await updateEventConfig(hostAId, event.id, { hashtag: "Kept" });
    await expect(updateEventConfig(hostAId, event.id, { hashtag: "has spaces" })).rejects.toThrow(
      /spaces/,
    );
    await expect(updateEventConfig(hostAId, event.id, { accentColor: "#ff0000" })).rejects.toThrow();
    const reloaded = await row(event.id);
    expect([reloaded.hashtag, reloaded.accent_color]).toEqual(["Kept", "violet"]);

    // The database backstop refuses a raw write that skips the DAL.
    const { error } = await supabase.from("events").update({ hashtag: "#two words" }).eq("id", event.id);
    expect(error).not.toBeNull();
  });
});
