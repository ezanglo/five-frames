import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServiceClient } from "@/lib/supabase/service-client";
import { generateLinkToken } from "@/lib/auth/link-tokens";
import { createDraftEvent, getEventForHost, revokeEventToken, rotateEventToken } from "@/lib/dal/events";
import { beginThemeImageUpload, commitThemeImageUpload } from "@/lib/dal/event-theme";
import { getSignageDownload, getSignagePreview } from "@/lib/dal/signage";
import { SIGNAGE_FORMATS } from "@/lib/media/signage-formats";
import { deriveAccentRoles } from "@/lib/theme/accents";
import { EVENT_THEME_BUCKET } from "@/lib/theme/image";
import { decodeSvgQr } from "@/test/qr-decode";
import type { EventRow } from "@/lib/db/types";

/**
 * Signage authorization and token safety against the real dev Postgres and the private
 * `event-theme` bucket (roadmap Slice 17; product.md §10.1, §11.3, criteria 42, 49–53;
 * architecture §7c). Draft previews work and carry no token; Draft downloads refuse; activated
 * downloads encode exactly the capture link; another host gets nothing; the theme image is read
 * server-side and embedded, never linked; theme changes never move the QR; rotating or revoking
 * the link changes what future signage carries; nothing here writes.
 */

const ORIGIN = "http://localhost:3000";
const PLACEHOLDER = 'fill="#F5F4F8"';

describe("signage (real Postgres + Storage)", { timeout: 120_000 }, () => {
  const supabase = createServiceClient();
  const bucket = supabase.storage.from(EVENT_THEME_BUCKET);
  const suffix = crypto.randomUUID();
  const eventIds: string[] = [];
  let hostAId: string;
  let hostBId: string;

  beforeAll(async () => {
    for (const label of ["a", "b"] as const) {
      const { data, error } = await supabase.auth.admin.createUser({
        email: `signage-host-${label}-${suffix}@example.test`,
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
      const { data } = await bucket.list(eventId, { limit: 100 });
      const objects = (data ?? []).filter((o) => o.id).map((o) => `${eventId}/${o.name}`);
      if (objects.length) await bucket.remove(objects);
    }
    if (hostAId) await supabase.auth.admin.deleteUser(hostAId);
    if (hostBId) await supabase.auth.admin.deleteUser(hostBId);
  });

  async function update(eventId: string, patch: Record<string, unknown>): Promise<EventRow> {
    const { data, error } = await supabase.from("events").update(patch).eq("id", eventId).select().single();
    if (error) throw error;
    return data as EventRow;
  }

  async function draft(): Promise<EventRow> {
    const event = await createDraftEvent(hostAId, `Signage event ${crypto.randomUUID().slice(0, 8)}`);
    eventIds.push(event.id);
    return update(event.id, { event_date: "2026-11-21", hashtag: "SignageTest", accent_color: "marigold" });
  }

  async function activated(): Promise<EventRow> {
    const event = await draft();
    return update(event.id, {
      activated_at: new Date().toISOString(),
      event_token: generateLinkToken(),
      gallery_token: generateLinkToken(),
    });
  }

  async function withThemeImage(event: EventRow): Promise<EventRow> {
    const bytes = await sharp({ create: { width: 1800, height: 1200, channels: 3, background: "#b3542a" } })
      .jpeg()
      .toBuffer();
    const begun = await beginThemeImageUpload(hostAId, event.id, { sizeBytes: bytes.length, contentType: "image/jpeg" });
    if (begun.kind !== "ready") throw new Error(`begin: ${begun.kind}`);
    const put = await fetch(begun.signedUrl, { method: "PUT", body: new Uint8Array(bytes), headers: { "content-type": "image/jpeg" } });
    expect(put.ok).toBe(true);
    const committed = await commitThemeImageUpload(hostAId, event.id, begun.uploadId);
    expect(committed.kind).toBe("saved");
    return (await getEventForHost(hostAId, event.id))!;
  }

  /** Everything a response carries that could admit someone, besides the QR itself. */
  function expectNoSecrets(svg: string, event: EventRow) {
    if (event.event_token) expect(svg).not.toContain(event.event_token);
    if (event.gallery_token) expect(svg).not.toContain(event.gallery_token);
    expect(svg).not.toContain(event.id);
    expect(svg).not.toMatch(/supabase|\/storage\/v1|token=/i);
  }

  it("Draft: every format previews with the placeholder, downloads refuse, and nothing is minted", async () => {
    const event = await draft();
    for (const format of SIGNAGE_FORMATS) {
      expect(await getSignageDownload(hostAId, event.id, format, ORIGIN)).toBeNull();
      const svg = await getSignagePreview(hostAId, event.id, format, ORIGIN);
      expect(svg).toContain(PLACEHOLDER);
      expect(svg).not.toContain(`${ORIGIN}/e/`);
      expect(await decodeSvgQr(svg!)).toBeNull();
      expectNoSecrets(svg!, event);
    }
    const after = (await getEventForHost(hostAId, event.id))!;
    expect(after.activated_at).toBeNull();
    expect(after.event_token).toBeNull();
    expect(after.gallery_token).toBeNull();
    expect(after.updated_at).toBe(event.updated_at);
  });

  it("an unactivated row that somehow holds a token still previews without it and can't download", async () => {
    const event = await draft();
    const corrupt = await update(event.id, { event_token: generateLinkToken() });
    for (const format of SIGNAGE_FORMATS) {
      expect(await getSignageDownload(hostAId, event.id, format, ORIGIN)).toBeNull();
      const svg = (await getSignagePreview(hostAId, event.id, format, ORIGIN))!;
      expect(svg).not.toContain(corrupt.event_token!);
      expect(svg).toContain(PLACEHOLDER);
      expect(await decodeSvgQr(svg)).toBeNull();
    }
  });

  it("activated: every download and preview decodes to exactly {origin}/e/{event_token}", async () => {
    const event = await activated();
    const captureUrl = `${ORIGIN}/e/${event.event_token}`;
    for (const format of SIGNAGE_FORMATS) {
      const download = (await getSignageDownload(hostAId, event.id, format, ORIGIN))!;
      expect(download.filename).toBe(`${event.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${format}.svg`);
      expect(await decodeSvgQr(download.svg)).toBe(captureUrl);
      expect(download.svg).not.toContain(PLACEHOLDER);
      expect(download.svg).not.toContain(event.gallery_token!);
      const preview = (await getSignagePreview(hostAId, event.id, format, ORIGIN))!;
      expect(await decodeSvgQr(preview)).toBe(captureUrl);
    }
  });

  it("another host can neither download nor preview", async () => {
    const draftEvent = await draft();
    const live = await activated();
    for (const format of SIGNAGE_FORMATS) {
      for (const event of [draftEvent, live]) {
        expect(await getSignageDownload(hostBId, event.id, format, ORIGIN)).toBeNull();
        expect(await getSignagePreview(hostBId, event.id, format, ORIGIN)).toBeNull();
      }
    }
  });

  it("unknown formats refuse", async () => {
    const event = await activated();
    for (const format of ["", "QR", "poster.svg", "../qr", "flyer"]) {
      expect(await getSignageDownload(hostAId, event.id, format, ORIGIN)).toBeNull();
      expect(await getSignagePreview(hostAId, event.id, format, ORIGIN)).toBeNull();
    }
  });

  it("the theme image is read server-side and embedded, on the field formats only", async () => {
    const event = await withThemeImage(await activated());
    expect(event.theme_image_path).toBeTruthy();
    for (const format of SIGNAGE_FORMATS) {
      const { svg } = (await getSignageDownload(hostAId, event.id, format, ORIGIN))!;
      const preview = (await getSignagePreview(hostAId, event.id, format, ORIGIN))!;
      for (const out of [svg, preview]) {
        expectNoSecrets(out, event);
        expect(out).not.toContain(event.theme_image_path!);
        if (format === "qr") expect(out).not.toContain("<image ");
        else expect(out).toMatch(/<image href="data:image\/jpeg;base64,/);
      }
      expect(await decodeSvgQr(svg)).toBe(`${ORIGIN}/e/${event.event_token}`);
    }
    // Host B still gets nothing, image or not.
    expect(await getSignageDownload(hostBId, event.id, "poster", ORIGIN)).toBeNull();
  });

  it("theme changes change the look, never the destination; previews apply only valid unsaved choices", async () => {
    const event = await activated();
    const captureUrl = `${ORIGIN}/e/${event.event_token}`;
    const before = (await getSignageDownload(hostAId, event.id, "table-card", ORIGIN))!.svg;

    await update(event.id, { accent_color: "teal", hashtag: "Changed" });
    const themed = await withThemeImage((await getEventForHost(hostAId, event.id))!);
    const after = (await getSignageDownload(hostAId, themed.id, "table-card", ORIGIN))!.svg;
    expect(after).not.toBe(before);
    expect(after).toContain(`fill="${deriveAccentRoles("teal").fill}"`);
    expect(await decodeSvgQr(before)).toBe(captureUrl);
    expect(await decodeSvgQr(after)).toBe(captureUrl);

    const rose = (await getSignagePreview(hostAId, event.id, "qr", ORIGIN, { accent: "rose", hashtag: "" }))!;
    expect(rose).toContain(`fill="${deriveAccentRoles("rose").fill}"`);
    const bogus = (await getSignagePreview(hostAId, event.id, "qr", ORIGIN, { accent: "javascript:alert(1)", hashtag: "not a tag!" }))!;
    expect(bogus).toContain(`fill="${deriveAccentRoles("teal").fill}"`);
    expect(bogus).not.toContain("javascript");
    expect(await decodeSvgQr(rose)).toBe(captureUrl);
    // A preview's unsaved choices are never saved.
    const row = (await getEventForHost(hostAId, event.id))!;
    expect([row.accent_color, row.hashtag]).toEqual(["teal", "Changed"]);
  });

  it("rotating the link moves future signage to the new token; revoking leaves no code to download", async () => {
    const event = await activated();
    const oldToken = event.event_token!;
    const rotated = (await rotateEventToken(hostAId, event.id))!;
    expect(rotated.event_token).not.toBe(oldToken);
    for (const format of SIGNAGE_FORMATS) {
      const { svg } = (await getSignageDownload(hostAId, event.id, format, ORIGIN))!;
      expect(await decodeSvgQr(svg)).toBe(`${ORIGIN}/e/${rotated.event_token}`);
    }

    await revokeEventToken(hostAId, event.id);
    for (const format of SIGNAGE_FORMATS) {
      expect(await getSignageDownload(hostAId, event.id, format, ORIGIN)).toBeNull();
      const preview = (await getSignagePreview(hostAId, event.id, format, ORIGIN))!;
      expect(preview).toContain(PLACEHOLDER);
      expect(preview).not.toContain(oldToken);
      expect(preview).not.toContain(rotated.event_token!);
      expect(await decodeSvgQr(preview)).toBeNull();
    }
  });

  it("previews stop once the event is no longer editable", async () => {
    const event = await activated();
    await update(event.id, { hosted_until: new Date(Date.now() - 60_000).toISOString() });
    expect(await getSignagePreview(hostAId, event.id, "qr", ORIGIN)).toBeNull();
  });
});
