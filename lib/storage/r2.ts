import "server-only";

import {
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * The one storage module (decision D26, architecture §7h). Every byte of media — capture
 * originals and derivatives under `captures/`, theme images under `theme/` — lives in one private
 * Cloudflare R2 bucket per environment, reached only through the S3 API endpoint with
 * server-held credentials. No public bucket access, no custom domain, no CDN.
 *
 * Nothing here checks access. Callers in lib/dal/ do that first; a presigned URL is only ever
 * the result of that check, never a substitute for it. The R2 credentials are read here and
 * nowhere else, and never cross to the browser — only per-object presigned URLs do.
 */

export const CAPTURES_PREFIX = "captures/";
export const THEME_PREFIX = "theme/";

/**
 * Originals and derivatives are never modified (invariant 10), and theme images are written once
 * under a fresh UUID, so every object can be cached by the viewer's browser for as long as its
 * URL stays the same. `private` keeps shared caches out of it.
 */
export const IMMUTABLE_CACHE_CONTROL = "private, max-age=31536000, immutable";

let client: S3Client | null = null;
let bucketName: string | null = null;

function config(): { s3: S3Client; bucket: string } {
  if (!client || !bucketName) {
    const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = process.env;
    if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET) {
      throw new Error("R2 storage is not configured (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET)");
    }
    client = new S3Client({
      region: "auto",
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
      // Newer SDKs add CRC32 checksums to every request by default. A presigned PUT would then
      // demand a checksum header the browser can't produce, so checksums are sent only when an
      // operation requires one (DeleteObjects' Content-MD5 equivalent).
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    });
    bucketName = R2_BUCKET;
  }
  return { s3: client, bucket: bucketName };
}

function isNotFound(error: unknown): boolean {
  return (
    error instanceof S3ServiceException &&
    (error.name === "NotFound" || error.name === "NoSuchKey" || error.$metadata.httpStatusCode === 404)
  );
}

/** RFC 6266 attachment header that survives non-ASCII names (guest display names). */
export function attachmentDisposition(filename: string): string {
  const ascii = filename.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

/**
 * Presigned GET, signed on a fixed time window so the same object gets the same URL for a while
 * and the browser reuses its cached copy instead of refetching on every page load (§7h). The
 * window is half the TTL, and the URL lives TTL past the window's start plus one window, so a
 * URL is always valid for at least `ttlSeconds` after it is handed out and at most 1.5× that.
 */
export async function presignGet(
  key: string,
  options: { ttlSeconds: number; downloadFilename?: string },
): Promise<string> {
  const { s3, bucket } = config();
  const windowMs = Math.max(1, Math.floor(options.ttlSeconds / 2)) * 1000;
  const windowStart = Math.floor(Date.now() / windowMs) * windowMs;
  return getSignedUrl(
    s3,
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      ResponseContentDisposition: options.downloadFilename
        ? attachmentDisposition(options.downloadFilename)
        : undefined,
    }),
    { expiresIn: options.ttlSeconds + windowMs / 1000, signingDate: new Date(windowStart) },
  );
}

export type PresignedPut = {
  url: string;
  /** Exactly the headers the browser must send. Each one is part of the signature. */
  headers: Record<string, string>;
};

/**
 * Presigned PUT for exactly one object key (the D7 trust shape on R2). The content type, the
 * exact byte length and the cache policy are signed, so R2 itself refuses a different file
 * type, any other size, or a different key (403) — the upload-time limits Supabase Storage's
 * bucket settings used to enforce. The browser can't set `content-length`; it sends the file's
 * real length, which must equal the declared one.
 */
export async function presignPut(
  key: string,
  options: { contentType: string; contentLength: number; expiresInSeconds: number; cacheControl?: string },
): Promise<PresignedPut> {
  const { s3, bucket } = config();
  const signable = new Set(["content-type", "content-length"]);
  if (options.cacheControl) signable.add("cache-control");
  const url = await getSignedUrl(
    s3,
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: options.contentType,
      ContentLength: options.contentLength,
      CacheControl: options.cacheControl,
    }),
    { expiresIn: options.expiresInSeconds, signableHeaders: signable },
  );
  const headers: Record<string, string> = { "content-type": options.contentType };
  if (options.cacheControl) headers["cache-control"] = options.cacheControl;
  return { url, headers };
}

export type ObjectHead = { contentType: string; sizeBytes: number };

export async function headObject(key: string): Promise<ObjectHead | null> {
  const { s3, bucket } = config();
  try {
    const head = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return { contentType: head.ContentType ?? "", sizeBytes: head.ContentLength ?? 0 };
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
}

/** An object's bytes, or null when it doesn't exist. */
export async function getObject(key: string): Promise<Buffer | null> {
  const { s3, bucket } = config();
  try {
    const object = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    if (!object.Body) return null;
    return Buffer.from(await object.Body.transformToByteArray());
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
}

export async function putObject(
  key: string,
  bytes: Buffer,
  contentType: string,
  cacheControl: string = IMMUTABLE_CACHE_CONTROL,
): Promise<void> {
  const { s3, bucket } = config();
  await s3.send(
    new PutObjectCommand({ Bucket: bucket, Key: key, Body: bytes, ContentType: contentType, CacheControl: cacheControl }),
  );
}

/** Every key under a prefix. */
export async function listKeys(prefix: string): Promise<string[]> {
  const { s3, bucket } = config();
  const keys: string[] = [];
  let token: string | undefined;
  do {
    const page = await s3.send(
      new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken: token }),
    );
    for (const object of page.Contents ?? []) if (object.Key) keys.push(object.Key);
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
  return keys;
}

/**
 * Deletes keys in batches of 1,000 (the S3 limit). Deleting an absent key succeeds, so a rerun
 * after a partial failure is a harmless no-op — what keeps theme prune and D18 deletion
 * rerunnable. Any per-key error fails the call.
 */
export async function deleteKeys(keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  const { s3, bucket } = config();
  for (let i = 0; i < keys.length; i += 1000) {
    const result = await s3.send(
      new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: { Objects: keys.slice(i, i + 1000).map((Key) => ({ Key })), Quiet: true },
      }),
    );
    if (result.Errors?.length) {
      const first = result.Errors[0];
      throw new Error(`R2 delete failed for ${result.Errors.length} object(s): ${first.Code} ${first.Key}`);
    }
  }
}

/** List, then batch delete (D18 permanent deletion, theme prune). */
export async function deletePrefix(prefix: string): Promise<number> {
  if (!prefix.endsWith("/")) throw new Error("deletePrefix needs a folder prefix ending in '/'");
  const keys = await listKeys(prefix);
  await deleteKeys(keys);
  return keys.length;
}
