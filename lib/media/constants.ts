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

/**
 * Supabase Storage accepts signed (`x-signature`) TUS uploads only under this suffix of the
 * resumable endpoint. The bare endpoint expects a JWT bearer, and rejects an x-signature-only
 * request with `Invalid Compact JWS` (NET-02; supabase/storage `src/http/routes/tus`,
 * `SIGNED_URL_SUFFIX`).
 */
export const SIGNED_TUS_PATH_SUFFIX = "/sign";
