import "server-only";

import {
  THEME_PREFIX,
  deleteKeys,
  getObject,
  headObject,
  listKeys,
  presignGet,
  presignPut,
  putObject,
} from "@/lib/storage/r2";

/**
 * Theme images under the private bucket's `theme/` prefix (architecture §7a, §7h, decision D19),
 * kept apart from `captures/` so theme media can never be mistaken for, counted with, or
 * downloaded as a capture. Flat, one folder per event: `{event_id}/{upload_id}.upload` (raw,
 * transient) and `{event_id}/{upload_id}.{jpg|png}` (the normalized image). Paths returned and
 * stored (`events.theme_image_path`) are without the prefix; it is added here. Every path is
 * built by the server from an owned event id and a server-generated UUID; the browser never
 * chooses one. Nothing here checks access — callers in lib/dal/ do that first, and a signed URL
 * is only ever the result of that check.
 */
const key = (path: string) => `${THEME_PREFIX}${path}`;

export function themeRawPath(eventId: string, uploadId: string): string {
  return `${eventId}/${uploadId}.upload`;
}

export function themeImagePath(eventId: string, uploadId: string, extension: "jpg" | "png"): string {
  return `${eventId}/${uploadId}.${extension}`;
}

/**
 * Presigned PUT for exactly one raw path, with the declared type and exact length signed in, so
 * R2 refuses any other file (the limits the old bucket settings enforced). Commit re-validates
 * the actual bytes.
 */
export async function createThemeSignedUpload(
  path: string,
  declared: { sizeBytes: number; contentType: string },
) {
  return presignPut(key(path), {
    contentType: declared.contentType,
    contentLength: declared.sizeBytes,
    expiresInSeconds: 60 * 60,
  });
}

/** Downloads an object's bytes, or null when it doesn't exist. */
export async function downloadThemeObject(path: string): Promise<Buffer | null> {
  return getObject(key(path));
}

export async function uploadThemeObject(path: string, bytes: Buffer, contentType: string) {
  await putObject(key(path), bytes, contentType);
}

export async function themeObjectExists(path: string): Promise<boolean> {
  return (await headObject(key(path))) !== null;
}

/** Every object in one event's folder, as paths without the prefix. */
export async function listThemeFolder(eventId: string): Promise<string[]> {
  if (!/^[0-9a-f-]{36}$/i.test(eventId)) throw new Error("invalid event id");
  const keys = await listKeys(key(`${eventId}/`));
  return keys.map((k) => k.slice(THEME_PREFIX.length));
}

/** Removing an already-absent object is a no-op, which keeps prune and D18 deletion rerunnable. */
export async function removeThemeObjects(paths: string[]): Promise<void> {
  await deleteKeys(paths.map(key));
}

/** Short-lived signed read URL. Callers mint one only after their surface's own access check. */
export async function createThemeSignedReadUrl(
  path: string,
  expiresInSeconds = 60 * 30,
): Promise<string | null> {
  try {
    return await presignGet(key(path), { ttlSeconds: expiresInSeconds });
  } catch {
    return null;
  }
}
