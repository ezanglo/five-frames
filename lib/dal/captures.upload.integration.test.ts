import { afterAll, beforeAll, describe, expect, it } from "vitest";
import sharp from "sharp";
import { createServiceClient } from "@/lib/supabase/service-client";
import { createDraftEvent } from "@/lib/dal/events";
import { createGuestSession } from "@/lib/dal/guest-sessions";
import { commitCapture, reserveCapture } from "@/lib/dal/captures";
import { createSignedReadUrl, deleteEventCaptureFolder, verifyUploadedObject } from "@/lib/media/storage";
import { CAPTURE_MAX_BYTES } from "@/lib/media/constants";
import { captureStorage } from "@/test/storage";

/**
 * The guest upload against the real dev R2 bucket (D26, architecture §7h). Every upload here is
 * the browser's own request: one `fetch` PUT to the presigned URL from reserve, with exactly the
 * headers reserve returned. These are the checks the old bucket settings and TUS test covered:
 * the URL writes only its own key, only the declared type and size, a failed upload is safely
 * restarted, and commit still refuses anything it can't verify.
 */
describe("guest upload against real R2 (reserve → presigned PUT → commit)", { timeout: 60_000 }, () => {
  const supabase = createServiceClient();
  const suffix = crypto.randomUUID();
  const eventIds: string[] = [];
  let hostId: string;
  let largeJpeg: Buffer;

  beforeAll(async () => {
    const { data, error } = await supabase.auth.admin.createUser({
      email: `upload-host-${suffix}@example.test`,
      password: crypto.randomUUID(),
      email_confirm: true,
    });
    if (error) throw error;
    hostId = data.user.id;

    // Random noise barely compresses: a 2400×2400 JPEG is well above the old 6 MB TUS threshold,
    // which is the size class that used to need a separate upload path.
    const side = 2400;
    const noise = Buffer.alloc(side * side * 3);
    for (let i = 0; i < noise.length; i += 1) noise[i] = Math.floor(Math.random() * 256);
    largeJpeg = await sharp(noise, { raw: { width: side, height: side, channels: 3 } })
      .jpeg({ quality: 100 })
      .toBuffer();
  });

  afterAll(async () => {
    for (const eventId of eventIds) await deleteEventCaptureFolder(eventId);
    if (hostId) await supabase.auth.admin.deleteUser(hostId);
  });

  async function openEventWithGuest() {
    const event = await createDraftEvent(hostId, `Upload test ${crypto.randomUUID()}`);
    eventIds.push(event.id);
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("events")
      .update({
        activated_at: now,
        capture_opened_at: now,
        safety_net_closes_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      })
      .eq("id", event.id);
    if (error) throw error;
    const joined = await createGuestSession(event.id, "Upload guest");
    if (joined.kind !== "joined") throw new Error("expected joined");
    return { eventId: event.id, sessionId: joined.session.id };
  }

  const jpegFile = (bytes: Buffer) => ({ sizeBytes: bytes.length, contentType: "image/jpeg" });

  async function put(upload: { url: string; headers: Record<string, string> }, body: Buffer | string, headers = upload.headers) {
    return fetch(upload.url, { method: "PUT", body: typeof body === "string" ? body : new Uint8Array(body), headers });
  }

  it("a large photo uploads in one PUT and commits, with derivatives and long private caching", async () => {
    const { eventId, sessionId } = await openEventWithGuest();
    const reserved = await reserveCapture(eventId, sessionId, crypto.randomUUID(), jpegFile(largeJpeg));
    if (reserved.kind !== "reserved" || !reserved.upload) throw new Error("expected an upload");
    expect(largeJpeg.length).toBeGreaterThan(6 * 1024 * 1024);
    expect(reserved.upload.url).not.toMatch(/supabase/);

    expect((await put(reserved.upload, largeJpeg)).status).toBe(200);

    const committed = await commitCapture(eventId, sessionId, reserved.capture.id, null);
    expect(committed.kind).toBe("committed");
    if (committed.kind !== "committed") return;
    expect(committed.capture.mime_type).toBe("image/jpeg");
    expect((await captureStorage.get(committed.capture.storage_path))!.equals(largeJpeg)).toBe(true);

    const read = await fetch(await createSignedReadUrl(committed.capture.display_path!));
    expect(read.status).toBe(200);
    expect(read.headers.get("cache-control")).toBe("private, max-age=31536000, immutable");
    // The guest's upload carried the same policy, because it was signed into the PUT.
    expect((await fetch(await createSignedReadUrl(committed.capture.storage_path))).headers.get("cache-control")).toBe(
      "private, max-age=31536000, immutable",
    );
  });

  it("R2 refuses a body of another size, another type, or an unsigned header set; nothing is stored", async () => {
    const { eventId, sessionId } = await openEventWithGuest();
    const photo = await sharp({ create: { width: 60, height: 40, channels: 3, background: "#336699" } }).jpeg().toBuffer();
    const reserved = await reserveCapture(eventId, sessionId, crypto.randomUUID(), jpegFile(photo));
    if (reserved.kind !== "reserved" || !reserved.upload) throw new Error("expected an upload");

    expect((await put(reserved.upload, Buffer.concat([photo, Buffer.alloc(1024)]))).status).toBe(403);
    expect((await put(reserved.upload, photo, { ...reserved.upload.headers, "content-type": "image/svg+xml" })).status).toBe(403);
    expect((await put(reserved.upload, photo, { "content-type": "image/jpeg" })).status).toBe(403);
    expect(await captureStorage.exists(reserved.capture.storage_path)).toBe(false);
    expect(await commitCapture(eventId, sessionId, reserved.capture.id, null)).toEqual({ kind: "not_uploaded" });
  });

  it("a presigned URL writes only its own reservation's key", async () => {
    const { eventId, sessionId } = await openEventWithGuest();
    const photo = await sharp({ create: { width: 30, height: 30, channels: 3, background: "#aa3300" } }).jpeg().toBuffer();
    const a = await reserveCapture(eventId, sessionId, crypto.randomUUID(), jpegFile(photo));
    const b = await reserveCapture(eventId, sessionId, crypto.randomUUID(), jpegFile(photo));
    if (a.kind !== "reserved" || b.kind !== "reserved" || !a.upload) throw new Error("expected uploads");

    // Point A's signed URL at B's object: the signature covers the path, so R2 refuses it.
    const forged = new URL(a.upload.url);
    forged.pathname = forged.pathname.replace(a.capture.storage_path, b.capture.storage_path);
    expect(forged.pathname).toContain(b.capture.storage_path);
    expect((await put({ url: forged.toString(), headers: a.upload.headers }, photo)).status).toBe(403);
    expect(await captureStorage.exists(b.capture.storage_path)).toBe(false);
  });

  it("a failed upload is restarted whole under the same key: one row, one frame, one object", async () => {
    const { eventId, sessionId } = await openEventWithGuest();
    const photo = await sharp({ create: { width: 80, height: 60, channels: 3, background: "#228844" } }).jpeg().toBuffer();
    const key = crypto.randomUUID();

    // First attempt: the upload never lands (a truncated body stands in for a dropped connection).
    const first = await reserveCapture(eventId, sessionId, key, jpegFile(photo));
    if (first.kind !== "reserved" || !first.upload) throw new Error("expected an upload");
    expect((await put(first.upload, photo.subarray(0, photo.length - 10))).ok).toBe(false);
    expect(await commitCapture(eventId, sessionId, first.capture.id, null)).toEqual({ kind: "not_uploaded" });

    // Retry: the same key reserves the same row and a fresh URL for the same object.
    const retry = await reserveCapture(eventId, sessionId, key, jpegFile(photo));
    if (retry.kind !== "reserved" || !retry.upload) throw new Error("expected an upload");
    expect(retry.capture.id).toBe(first.capture.id);
    expect(retry.capture.storage_path).toBe(first.capture.storage_path);
    expect((await put(retry.upload, photo)).status).toBe(200);
    // A duplicate PUT of the same file (double-sent retry) overwrites the same object harmlessly.
    expect((await put(retry.upload, photo)).status).toBe(200);

    expect((await commitCapture(eventId, sessionId, first.capture.id, null)).kind).toBe("committed");
    const { data: rows } = await supabase.from("captures").select("id, status").eq("guest_session_id", sessionId);
    expect(rows).toEqual([{ id: first.capture.id, status: "committed" }]);
    const base = first.capture.storage_path.replace(/\/original$/, "");
    expect((await captureStorage.list(base)).sort()).toEqual([`${base}/display`, `${base}/original`, `${base}/thumbnail`]);
  });

  it("an unusable file is refused before any slot is touched", async () => {
    const { eventId, sessionId } = await openEventWithGuest();
    for (const declared of [
      { sizeBytes: 1000, contentType: "image/svg+xml" },
      { sizeBytes: 1000, contentType: "" },
      { sizeBytes: 0, contentType: "image/jpeg" },
      { sizeBytes: CAPTURE_MAX_BYTES + 1, contentType: "image/jpeg" },
      { sizeBytes: Number.NaN, contentType: "image/jpeg" },
    ]) {
      expect(await reserveCapture(eventId, sessionId, crypto.randomUUID(), declared)).toEqual({ kind: "unsupported_file" });
    }
    const { data: rows } = await supabase.from("captures").select("id").eq("guest_session_id", sessionId);
    expect(rows).toEqual([]);
  });

  it("the page-load probe learns the row's state and gets no upload authorization", async () => {
    const { eventId, sessionId } = await openEventWithGuest();
    const key = crypto.randomUUID();
    const reserved = await reserveCapture(eventId, sessionId, key, { sizeBytes: 100, contentType: "image/png" });
    const probe = await reserveCapture(eventId, sessionId, key, null);
    if (reserved.kind !== "reserved" || probe.kind !== "reserved") throw new Error("expected reserved");
    expect(probe.capture.id).toBe(reserved.capture.id);
    expect(probe.upload).toBeNull();
  });

  it("an upload under a lapsed reservation lands but is never committed, and D18 prefix deletion removes it", async () => {
    const { eventId, sessionId } = await openEventWithGuest();
    const photo = await sharp({ create: { width: 20, height: 20, channels: 3, background: "#111111" } }).jpeg().toBuffer();
    const reserved = await reserveCapture(eventId, sessionId, crypto.randomUUID(), jpegFile(photo));
    if (reserved.kind !== "reserved" || !reserved.upload) throw new Error("expected an upload");
    await supabase.from("captures").update({ expires_at: new Date(Date.now() - 1000).toISOString() }).eq("id", reserved.capture.id);

    // Upload authorization outlives the reservation; that is safe only because commit refuses.
    expect((await put(reserved.upload, photo)).status).toBe(200);
    expect(await commitCapture(eventId, sessionId, reserved.capture.id, null)).toEqual({ kind: "expired" });

    expect(await deleteEventCaptureFolder(eventId)).toBe(1);
    expect(await captureStorage.exists(reserved.capture.storage_path)).toBe(false);
  });

  it("commit refuses a stored object that isn't an accepted image type", async () => {
    const { eventId, sessionId } = await openEventWithGuest();
    const reserved = await reserveCapture(eventId, sessionId, crypto.randomUUID(), null);
    if (reserved.kind !== "reserved") throw new Error("expected reserved");
    // Only the server could write this (the presigned PUT can't), but commit checks regardless.
    await captureStorage.put(reserved.capture.storage_path, Buffer.from("<html></html>"), "text/html");
    expect(await verifyUploadedObject(reserved.capture.storage_path)).toEqual({ exists: false });
    expect(await commitCapture(eventId, sessionId, reserved.capture.id, null)).toEqual({ kind: "not_uploaded" });
  });
});

describe("presigned reads (§7h browser caching)", { timeout: 30_000 }, () => {
  const path = `${crypto.randomUUID()}/r2-read-test/original`;

  beforeAll(async () => {
    await captureStorage.put(path, Buffer.from("bytes"), "image/jpeg");
  });
  afterAll(async () => {
    await captureStorage.remove([path]);
  });

  it("returns the same URL within a time window, so the browser can reuse its cached copy", async () => {
    const [first, second] = [await createSignedReadUrl(path), await createSignedReadUrl(path)];
    expect(second).toBe(first);
    const params = new URL(first).searchParams;
    // Valid for at least the requested TTL from now, at most 1.5× it.
    const signedAt = Date.parse(params.get("X-Amz-Date")!.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/, "$1-$2-$3T$4:$5:$6Z"));
    const expiresAt = signedAt + Number(params.get("X-Amz-Expires")) * 1000;
    expect(expiresAt - Date.now()).toBeGreaterThanOrEqual(600_000 - 5_000);
    expect(expiresAt - signedAt).toBe(900_000);
    expect((await fetch(first)).status).toBe(200);
  });

  it("a download URL answers as an attachment under its name, including non-ASCII names", async () => {
    const response = await fetch(await createSignedReadUrl(path, 600, "0001-José.jpg"));
    expect(response.status).toBe(200);
    const disposition = response.headers.get("content-disposition") ?? "";
    expect(disposition).toMatch(/^attachment;/);
    expect(disposition).toContain(`filename*=UTF-8''${encodeURIComponent("0001-José.jpg")}`);
  });

  it("a tampered or unsigned URL is refused", async () => {
    const url = new URL(await createSignedReadUrl(path));
    url.searchParams.set("X-Amz-Signature", "0".repeat(64));
    expect((await fetch(url)).status).toBe(403);
    const bare = new URL(url);
    bare.search = "";
    expect((await fetch(bare)).ok).toBe(false);
  });
});
