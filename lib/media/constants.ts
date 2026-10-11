/**
 * Shared between server (lib/media/storage.ts) and the guest capture client component, so
 * this file has no `server-only` import and no secrets.
 */

/**
 * Upload limits for a capture original (architecture §7h). Supabase Storage's `captures` bucket
 * used to enforce these at upload; on R2 the presigned PUT signs the declared type and exact
 * length instead, and commit re-checks the stored object. HEIC/HEIF are still accepted at upload
 * and fail at derivative processing (product.md §14, a tracked follow-up).
 */
export const CAPTURE_MAX_BYTES = 50 * 1024 * 1024;
export const CAPTURE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
] as const;
