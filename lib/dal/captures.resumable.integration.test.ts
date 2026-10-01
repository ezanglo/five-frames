import { afterAll, beforeAll, describe, expect, it } from "vitest";
import sharp from "sharp";
import * as tus from "tus-js-client";
import { createServiceClient } from "@/lib/supabase/service-client";
import { createDraftEvent } from "@/lib/dal/events";
import { createGuestSession } from "@/lib/dal/guest-sessions";
import { commitCapture, reserveCapture } from "@/lib/dal/captures";
import {
  CAPTURES_BUCKET,
  RESUMABLE_UPLOAD_THRESHOLD_BYTES,
  TUS_CHUNK_SIZE_BYTES,
} from "@/lib/media/constants";
import { signedTusUploadOptions } from "@/lib/media/tus";

/**
 * The resumable (TUS) path against the real dev Storage bucket (NET-02, decision D7). Photos at
 * or above the 6 MB threshold take this path, so a broken auth contract here makes every large
 * photo impossible to keep. The uploads use `signedTusUploadOptions`, the same options the
 * guest's browser sends: the endpoint and the per-object `x-signature` token from reserve, and
 * nothing else.
 */
describe("resumable upload against real Storage (reserve → TUS → commit)", () => {
  const supabase = createServiceClient();
  const suffix = crypto.randomUUID();
  let hostId: string;
  let largeJpeg: Buffer;
  const uploadedPaths: string[] = [];

  beforeAll(async () => {
    const { data, error } = await supabase.auth.admin.createUser({
      email: `resumable-host-${suffix}@example.test`,
      password: crypto.randomUUID(),
      email_confirm: true,
    });
    if (error) throw error;
    hostId = data.user.id;

    // Random noise barely compresses, so a 2400×2400 JPEG is comfortably above 6 MB and spans
    // two TUS chunks.
    const side = 2400;
    const noise = Buffer.alloc(side * side * 3);
    for (let i = 0; i < noise.length; i += 1) noise[i] = Math.floor(Math.random() * 256);
    largeJpeg = await sharp(noise, { raw: { width: side, height: side, channels: 3 } })
      .jpeg({ quality: 100 })
      .toBuffer();
  });

  afterAll(async () => {
    for (const path of uploadedPaths) {
      const base = path.replace(/\/original$/, "");
      await supabase.storage
        .from(CAPTURES_BUCKET)
        .remove([`${base}/original`, `${base}/display`, `${base}/thumbnail`]);
    }
    if (hostId) await supabase.auth.admin.deleteUser(hostId);
  });

  async function createOpenEventWithGuest() {
    const event = await createDraftEvent(hostId, `Resumable test ${crypto.randomUUID()}`);
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
    const joined = await createGuestSession(event.id, "Resumable guest");
    if (joined.kind !== "joined") throw new Error("expected joined");
    return { eventId: event.id, sessionId: joined.session.id };
  }

  async function committedCount(sessionId: string) {
    const { count, error } = await supabase
      .from("captures")
      .select("id", { count: "exact", head: true })
      .eq("guest_session_id", sessionId)
      .eq("status", "committed");
    if (error) throw error;
    return count ?? 0;
  }

  /**
   * Runs one TUS upload with the browser's options. `stopAfterFirstChunk` aborts once the first
   * chunk is accepted, the way a dropped connection leaves a partial upload.
   */
  function runTus(
    reserved: Extract<Awaited<ReturnType<typeof reserveCapture>>, { kind: "reserved" }>,
    options: { token?: string; uploadUrl?: string; stopAfterFirstChunk?: boolean } = {},
  ): Promise<{ completed: boolean; uploadUrl: string | null; bytesAccepted: number }> {
    return new Promise((resolve, reject) => {
      let bytesAccepted = 0;
      const upload: tus.Upload = new tus.Upload(largeJpeg, {
        ...signedTusUploadOptions({
          endpoint: reserved.resumableEndpoint,
          token: options.token ?? reserved.uploadToken,
          bucket: CAPTURES_BUCKET,
          objectName: reserved.capture.storage_path,
          contentType: "image/jpeg",
        }),
        retryDelays: [],
        uploadSize: largeJpeg.length,
        uploadUrl: options.uploadUrl ?? null,
        onChunkComplete: (_size, accepted) => {
          bytesAccepted = accepted;
          if (options.stopAfterFirstChunk) {
            upload
              .abort()
              .then(() => resolve({ completed: false, uploadUrl: upload.url, bytesAccepted }));
          }
        },
        onError: (error) => reject(error),
        onSuccess: () => resolve({ completed: true, uploadUrl: upload.url, bytesAccepted }),
      });
      upload.start();
    });
  }

  it("uses a photo above the resumable threshold", () => {
    expect(largeJpeg.length).toBeGreaterThanOrEqual(RESUMABLE_UPLOAD_THRESHOLD_BYTES);
    expect(largeJpeg.length).toBeGreaterThan(TUS_CHUNK_SIZE_BYTES);
  });

  it("reserve hands out Storage's signed TUS endpoint, which accepts the x-signature token", async () => {
    const { eventId, sessionId } = await createOpenEventWithGuest();
    const reserved = await reserveCapture(eventId, sessionId, crypto.randomUUID());
    expect(reserved.kind).toBe("reserved");
    if (reserved.kind !== "reserved") return;

    expect(new URL(reserved.resumableEndpoint).pathname).toBe("/storage/v1/upload/resumable/sign");

    // The TUS create request is where NET-02 failed (400 "Invalid Compact JWS"). It must now
    // create the upload, and the first chunk must be accepted.
    uploadedPaths.push(reserved.capture.storage_path);
    const partial = await runTus(reserved, { stopAfterFirstChunk: true });
    expect(partial.uploadUrl).toMatch(/\/storage\/v1\/upload\/resumable\/sign\//);
    expect(partial.bytesAccepted).toBe(TUS_CHUNK_SIZE_BYTES);
  }, 120_000);

  it("an interrupted ≥6 MB upload resumes on retry and commits exactly one capture", async () => {
    const { eventId, sessionId } = await createOpenEventWithGuest();
    const key = crypto.randomUUID();

    const first = await reserveCapture(eventId, sessionId, key);
    expect(first.kind).toBe("reserved");
    if (first.kind !== "reserved") return;
    uploadedPaths.push(first.capture.storage_path);

    const partial = await runTus(first, { stopAfterFirstChunk: true });
    expect(partial.completed).toBe(false);

    // Half an upload is not a kept photo: commit refuses and no frame is consumed.
    expect((await commitCapture(eventId, sessionId, first.capture.id, null)).kind).toBe(
      "not_uploaded",
    );
    expect(await committedCount(sessionId)).toBe(0);

    // Retry: the same reserve key returns the same row and slot with a fresh token, and the
    // upload continues from the stored offset rather than starting a second object.
    const retried = await reserveCapture(eventId, sessionId, key);
    expect(retried.kind).toBe("reserved");
    if (retried.kind !== "reserved") return;
    expect(retried.capture.id).toBe(first.capture.id);
    expect(retried.capture.slot_index).toBe(first.capture.slot_index);

    const resumed = await runTus(retried, { uploadUrl: partial.uploadUrl! });
    expect(resumed.completed).toBe(true);
    expect(resumed.uploadUrl).toBe(partial.uploadUrl);

    const committed = await commitCapture(eventId, sessionId, retried.capture.id, null);
    expect(committed.kind).toBe("committed");
    if (committed.kind !== "committed") return;
    expect(committed.capture.mime_type).toBe("image/jpeg");

    // A duplicate commit from a client retry is the same capture, not a second one.
    expect((await commitCapture(eventId, sessionId, retried.capture.id, null)).kind).toBe(
      "committed",
    );
    expect(await committedCount(sessionId)).toBe(1);
  }, 180_000);

  it("a failed resumable upload never consumes a frame", async () => {
    const { eventId, sessionId } = await createOpenEventWithGuest();
    const key = crypto.randomUUID();
    const reserved = await reserveCapture(eventId, sessionId, key);
    expect(reserved.kind).toBe("reserved");
    if (reserved.kind !== "reserved") return;

    // A token for a different object can't authorize this one.
    const other = await reserveCapture(eventId, sessionId, crypto.randomUUID());
    if (other.kind !== "reserved") throw new Error("expected reserved");
    await expect(runTus(reserved, { token: other.uploadToken })).rejects.toThrow();

    expect((await commitCapture(eventId, sessionId, reserved.capture.id, null)).kind).toBe(
      "not_uploaded",
    );
    expect(await committedCount(sessionId)).toBe(0);

    // Once both abandoned reservations lapse, all five frames are free again.
    const { error } = await supabase
      .from("captures")
      .update({ expires_at: new Date(Date.now() - 1000).toISOString() })
      .eq("guest_session_id", sessionId)
      .eq("status", "pending");
    if (error) throw error;

    const fresh = await Promise.all(
      Array.from({ length: 5 }, () => reserveCapture(eventId, sessionId, crypto.randomUUID())),
    );
    expect(fresh.filter((r) => r.kind === "reserved")).toHaveLength(5);
  }, 120_000);
});
