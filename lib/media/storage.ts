import "server-only";

import sharp from "sharp";
import { createServiceClient } from "@/lib/supabase/service-client";

/**
 * Private bucket for photo originals and derivatives (architecture §7, invariant 8). No
 * object here is ever public; every read is a short-lived signed URL minted after an
 * access check, and every write from a guest browser happens through a signed upload URL
 * scoped to one specific path — the one narrow exception to "the browser never touches
 * Supabase directly" (D3/D4).
 */
const BUCKET = "captures";

const ACCEPTED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

/**
 * Mints a time-limited signed upload URL for one specific object path (D7). The browser
 * PUTs its file bytes directly to this URL — no Supabase client or key ever reaches it,
 * only a bare URL capability for exactly this path.
 */
export async function createSignedUploadUrl(path: string): Promise<string> {
  const supabase = createServiceClient();
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUploadUrl(path, { upsert: true });

  if (error) throw error;
  return data.signedUrl;
}

export type UploadedObjectCheck =
  | { exists: true; mimeType: string; sizeBytes: number }
  | { exists: false };

/**
 * Commit-time verification (architecture §6 step 3): confirms the object the guest was
 * authorized to upload to actually exists and looks like an image, before the frame is
 * ever consumed. Upload authorization alone never implies a slot was safely filled.
 */
export async function verifyUploadedObject(
  path: string,
): Promise<UploadedObjectCheck> {
  const supabase = createServiceClient();
  const lastSlash = path.lastIndexOf("/");
  const folder = path.slice(0, lastSlash);
  const fileName = path.slice(lastSlash + 1);

  const { data, error } = await supabase.storage.from(BUCKET).list(folder, {
    search: fileName,
  });

  if (error) throw error;
  const entry = data?.find((item) => item.name === fileName);
  if (!entry || !entry.metadata) return { exists: false };

  const mimeType = String(entry.metadata.mimetype ?? "");
  if (!ACCEPTED_MIME_TYPES.has(mimeType)) return { exists: false };

  return { exists: true, mimeType, sizeBytes: Number(entry.metadata.size ?? 0) };
}

export type Derivatives = {
  displayPath: string;
  thumbnailPath: string;
};

/**
 * Generates display and thumbnail derivatives from the committed original and writes them
 * as separate objects (invariant 10: the original itself is never modified or overwritten).
 * HEIC/HEIF originals are decoded by sharp's libvips build and re-encoded as JPEG, since
 * HEIC has poor cross-browser display support — the original bytes are untouched either way.
 */
export async function generateDerivatives(
  originalPath: string,
): Promise<Derivatives> {
  const supabase = createServiceClient();
  const { data: blob, error: downloadError } = await supabase.storage
    .from(BUCKET)
    .download(originalPath);
  if (downloadError) throw downloadError;

  const originalBuffer = Buffer.from(await blob.arrayBuffer());
  const image = sharp(originalBuffer).rotate();

  const [displayBuffer, thumbnailBuffer] = await Promise.all([
    image.clone().resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer(),
    image.clone().resize({ width: 400, height: 400, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 75 }).toBuffer(),
  ]);

  const basePath = originalPath.replace(/\/original$/, "");
  const displayPath = `${basePath}/display`;
  const thumbnailPath = `${basePath}/thumbnail`;

  const [displayUpload, thumbnailUpload] = await Promise.all([
    supabase.storage
      .from(BUCKET)
      .upload(displayPath, displayBuffer, { contentType: "image/jpeg", upsert: true }),
    supabase.storage
      .from(BUCKET)
      .upload(thumbnailPath, thumbnailBuffer, { contentType: "image/jpeg", upsert: true }),
  ]);

  if (displayUpload.error) throw displayUpload.error;
  if (thumbnailUpload.error) throw thumbnailUpload.error;

  return { displayPath, thumbnailPath };
}

/** Signed read URL, minted only after the caller has already done its own access check. */
export async function createSignedReadUrl(
  path: string,
  expiresInSeconds = 60 * 10,
): Promise<string> {
  const supabase = createServiceClient();
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, expiresInSeconds);

  if (error) throw error;
  return data.signedUrl;
}
