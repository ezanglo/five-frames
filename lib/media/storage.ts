import "server-only";

import sharp from "sharp";
import {
  CAPTURES_PREFIX,
  IMMUTABLE_CACHE_CONTROL,
  deleteKeys,
  deletePrefix,
  getObject,
  headObject,
  presignGet,
  presignPut,
  putObject,
  type PresignedPut,
} from "@/lib/storage/r2";
import { CAPTURE_MAX_BYTES, CAPTURE_MIME_TYPES } from "@/lib/media/constants";

/**
 * Photo originals and derivatives under the private bucket's `captures/` prefix (architecture
 * §7, §7h, invariant 8). Capture rows store paths without the prefix
 * (`{event}/{session}/{reserve_key}/original`); it is added here, at the storage edge. No object
 * is ever public: every read is a short-lived presigned URL minted after an access check, and
 * the only browser write is a presigned PUT for one reserved object key.
 */
const key = (path: string) => `${CAPTURES_PREFIX}${path}`;

const ACCEPTED_MIME_TYPES: ReadonlySet<string> = new Set(CAPTURE_MIME_TYPES);

/**
 * A guest-supplied description of the file about to be uploaded. Only a fast, calm refusal:
 * the presigned URL then binds the exact type and length, and commit verifies the stored object.
 */
export function isAcceptableCaptureFile(declared: { sizeBytes: number; contentType: string }): boolean {
  return (
    Number.isInteger(declared.sizeBytes) &&
    declared.sizeBytes > 0 &&
    declared.sizeBytes <= CAPTURE_MAX_BYTES &&
    ACCEPTED_MIME_TYPES.has(declared.contentType)
  );
}

/**
 * Upload authorization for exactly one reserved object (D7/D26): a single presigned PUT with the
 * declared type and exact length signed in. A failed or interrupted upload is restarted from the
 * start by Retry, which overwrites the same key; nothing about it is resumable, and nothing
 * needs to be (the frame is consumed only at commit). It proves only "you may write these bytes
 * here", never that the slot is still yours — commit re-checks that.
 */
export async function createCaptureUpload(
  path: string,
  declared: { sizeBytes: number; contentType: string },
): Promise<PresignedPut> {
  return presignPut(key(path), {
    contentType: declared.contentType,
    contentLength: declared.sizeBytes,
    cacheControl: IMMUTABLE_CACHE_CONTROL,
    expiresInSeconds: 60 * 60,
  });
}

export type UploadedObjectCheck =
  | { exists: true; mimeType: string; sizeBytes: number }
  | { exists: false };

/**
 * Commit-time verification (architecture §6 step 3): confirms the object the guest was
 * authorized to upload to actually exists and looks like an image, before the frame is
 * ever consumed. Upload authorization alone never implies a slot was safely filled.
 */
export async function verifyUploadedObject(path: string): Promise<UploadedObjectCheck> {
  const head = await headObject(key(path));
  if (!head) return { exists: false };
  if (!ACCEPTED_MIME_TYPES.has(head.contentType)) return { exists: false };
  if (head.sizeBytes <= 0 || head.sizeBytes > CAPTURE_MAX_BYTES) return { exists: false };
  return { exists: true, mimeType: head.contentType, sizeBytes: head.sizeBytes };
}

export type Derivatives = {
  displayPath: string;
  thumbnailPath: string;
  /** Pixel size of the display derivative as written (already upright), for gallery layouts. */
  displayWidth: number;
  displayHeight: number;
};

/**
 * Generates display and thumbnail derivatives from the committed original and writes them
 * as separate objects (invariant 10: the original itself is never modified or overwritten).
 */
export async function generateDerivatives(originalPath: string): Promise<Derivatives> {
  const originalBuffer = await getObject(key(originalPath));
  if (!originalBuffer) throw new Error("capture original not found");

  const image = sharp(originalBuffer).rotate();

  const [display, thumbnailBuffer] = await Promise.all([
    image.clone().resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer({ resolveWithObject: true }),
    image.clone().resize({ width: 400, height: 400, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 75 }).toBuffer(),
  ]);

  const basePath = originalPath.replace(/\/original$/, "");
  const displayPath = `${basePath}/display`;
  const thumbnailPath = `${basePath}/thumbnail`;

  await Promise.all([
    putObject(key(displayPath), display.data, "image/jpeg"),
    putObject(key(thumbnailPath), thumbnailBuffer, "image/jpeg"),
  ]);

  return {
    displayPath,
    thumbnailPath,
    displayWidth: display.info.width,
    displayHeight: display.info.height,
  };
}

/**
 * Reads one object's bytes for a server-side derived output (keepsakes read display
 * derivatives). Never used on an original, and never writes. Null when the object is missing.
 */
export async function downloadCaptureObject(path: string): Promise<Buffer | null> {
  return getObject(key(path));
}

/**
 * Permanently removes objects (retention/deletion, product.md §15.2). Deleting an absent object
 * succeeds, so a retry after a partial failure is a harmless no-op.
 */
export async function deleteObjects(paths: string[]): Promise<void> {
  await deleteKeys(paths.map(key));
}

/**
 * Every object under one event's capture folder, including orphans a row no longer points at
 * (an upload whose reservation lapsed). D18 permanent deletion runs this after deleting the
 * rows' own paths.
 */
export async function deleteEventCaptureFolder(eventId: string): Promise<number> {
  if (!/^[0-9a-f-]{36}$/i.test(eventId)) throw new Error("invalid event id");
  return deletePrefix(key(`${eventId}/`));
}

/**
 * Presigned read URL, minted only after the caller has already done its own access check.
 * Pass `downloadFilename` for a URL that must actually save a file rather than navigate the
 * browser to it: the response itself carries `Content-Disposition: attachment` (the HTML
 * `download` attribute is ignored for a cross-origin URL like this one).
 */
export async function createSignedReadUrl(
  path: string,
  expiresInSeconds = 60 * 10,
  downloadFilename?: string,
): Promise<string> {
  return presignGet(key(path), { ttlSeconds: expiresInSeconds, downloadFilename });
}
