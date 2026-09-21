/**
 * Shared between server (lib/media/storage.ts) and the guest capture client component, so
 * this file has no `server-only` import and no secrets.
 */

export const CAPTURES_BUCKET = "captures";

/**
 * Supabase's own recommendation for switching from a standard upload to the resumable (TUS)
 * path — same value as the protocol's fixed chunk size (decision D7).
 */
export const RESUMABLE_UPLOAD_THRESHOLD_BYTES = 6 * 1024 * 1024;
export const TUS_CHUNK_SIZE_BYTES = 6 * 1024 * 1024;
