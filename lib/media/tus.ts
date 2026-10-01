import { defaultOptions, type UploadOptions } from "tus-js-client";
import { TUS_CHUNK_SIZE_BYTES } from "@/lib/media/constants";

/**
 * TUS options for a guest's direct-to-storage resumable upload (D7). The only credential is the
 * per-object token from `createSignedUploadUrl`, in `x-signature`, sent to the signed endpoint
 * (`SIGNED_TUS_PATH_SUFFIX`). No Supabase client, anon key or session reaches the browser.
 *
 * Shared by the guest capture client and the real-storage integration test, so the test proves
 * the exact auth material the browser sends.
 */
export function signedTusUploadOptions(params: {
  endpoint: string;
  token: string;
  bucket: string;
  objectName: string;
  contentType: string;
}): UploadOptions {
  return {
    endpoint: params.endpoint,
    retryDelays: [0, 1000, 3000, 5000],
    chunkSize: TUS_CHUNK_SIZE_BYTES,
    headers: { "x-signature": params.token, "x-upsert": "true" },
    metadata: {
      bucketName: params.bucket,
      objectName: params.objectName,
      contentType: params.contentType,
      cacheControl: "3600",
    },
    // A stored upload resumes only for this same reservation's object. The default fingerprint
    // (file name/type/size/mtime + endpoint) would otherwise resume an earlier reservation's
    // upload — a different object — whenever the guest picks the same file again.
    fingerprint: async (file, options) =>
      `${await defaultOptions.fingerprint(file, options)}-${params.objectName}`,
    removeFingerprintOnSuccess: true,
  };
}
