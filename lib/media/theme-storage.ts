import "server-only";

import { createServiceClient } from "@/lib/supabase/service-client";
import { EVENT_THEME_BUCKET } from "@/lib/theme/image";

/**
 * The private `event-theme` bucket (architecture §7a, decision D19). Flat, one folder per event:
 * `{event_id}/{upload_id}.upload` (raw, transient) and `{event_id}/{upload_id}.{jpg|png}` (the
 * normalized image). Every path is built by the server from an owned event id and a
 * server-generated UUID; the browser never chooses one. Nothing here checks access — callers in
 * lib/dal/ do that first, and a signed URL is only ever the result of that check.
 */

const bucket = () => createServiceClient().storage.from(EVENT_THEME_BUCKET);

export function themeRawPath(eventId: string, uploadId: string): string {
  return `${eventId}/${uploadId}.upload`;
}

export function themeImagePath(eventId: string, uploadId: string, extension: "jpg" | "png"): string {
  return `${eventId}/${uploadId}.${extension}`;
}

/** Signed upload capability for exactly one raw path (the D7 mechanism). */
export async function createThemeSignedUpload(path: string) {
  const { data, error } = await bucket().createSignedUploadUrl(path);
  if (error) throw error;
  return { signedUrl: data.signedUrl, token: data.token };
}

/** Downloads an object's bytes, or null when it doesn't exist. */
export async function downloadThemeObject(path: string): Promise<Buffer | null> {
  const { data, error } = await bucket().download(path);
  if (error) {
    const status = (error as { status?: number; statusCode?: string | number }).status;
    const statusCode = (error as { statusCode?: string | number }).statusCode;
    if (status === 400 || status === 404 || String(statusCode) === "404" || /not.?found/i.test(error.message)) {
      return null;
    }
    throw error;
  }
  return Buffer.from(await data.arrayBuffer());
}

export async function uploadThemeObject(path: string, bytes: Buffer, contentType: string) {
  const { error } = await bucket().upload(path, bytes, { contentType, upsert: true });
  if (error) throw error;
}

export async function themeObjectExists(path: string): Promise<boolean> {
  const { data, error } = await bucket().exists(path);
  if (error) return false;
  return data;
}

/** Every object name in one event's folder, as full paths. */
export async function listThemeFolder(eventId: string): Promise<string[]> {
  const paths: string[] = [];
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await bucket().list(eventId, { limit: 100, offset });
    if (error) throw error;
    for (const item of data ?? []) {
      if (item.name && item.id) paths.push(`${eventId}/${item.name}`);
    }
    if (!data || data.length < 100) return paths;
  }
}

/** Removing an already-absent object is a no-op, which keeps prune and D18 deletion rerunnable. */
export async function removeThemeObjects(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  const { error } = await bucket().remove(paths);
  if (error) throw error;
}

/** Short-lived signed read URL. Callers mint one only after their surface's own access check. */
export async function createThemeSignedReadUrl(
  path: string,
  expiresInSeconds = 60 * 30,
): Promise<string | null> {
  const { data, error } = await bucket().createSignedUrl(path, expiresInSeconds);
  if (error) return null;
  return data.signedUrl;
}
