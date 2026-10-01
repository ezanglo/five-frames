/**
 * One Keep or Retry press: reserve → upload → commit (architecture §6). Network-free, so the
 * retry semantics are testable without a browser; the page supplies the requests.
 *
 * Every way a step can fail ends in an outcome, never a thrown error. Before this module, a
 * reserve or commit request that failed at the network rejected uncaught, and the sheet stayed
 * on "Keeping…" or "Saving…" for good (NET-02).
 *
 * Retry is safe because both requests are idempotent on the server:
 * - the reserve key is persisted before the first request and reused until the attempt commits
 *   or ends, so a reserve whose response was lost returns the same row (or `already_committed`);
 * - when only the commit failed in transit, the outcome carries the uploaded reservation, and
 *   Retry commits that same capture again. A commit that already happened returns `committed`
 *   for the same row, so a lost response still converges on exactly one capture.
 */

import type { CommitResponse, ReserveResponse } from "@/app/(guest)/e/[token]/actions";
import { ATTEMPT_COPY, type EndedReason, type UploadedReservation } from "./attempt";

/**
 * How long a reserve or commit request may run before the guest gets Retry. Generous for a weak
 * connection (commit also makes the photo's derivatives server-side). It only bounds the wait:
 * the request isn't cancelled, and Retry is idempotent whether or not it landed. Next runs
 * server actions one at a time, so a Retry can still wait behind a stalled request; it then
 * times out again rather than spinning forever.
 */
export const KEEP_REQUEST_TIMEOUT_MS = 60_000;

type Reserved = Extract<ReserveResponse, { kind: "reserved" }>;
export type CommittedReply = Extract<CommitResponse, { kind: "committed" }>;

export type KeepDeps = {
  /** The persisted reserve key for this attempt, if one exists. */
  pendingKey: () => string | null;
  /** Mint a fresh key and persist it before it is ever sent (D6). */
  rememberNewKey: () => string;
  reserve: (reserveKey: string) => Promise<ReserveResponse>;
  upload: (reserved: Reserved) => Promise<void>;
  commit: (captureId: string) => Promise<CommitResponse>;
  onStep: (phase: "reserving" | "uploading" | "committing") => void;
  timeoutMs?: number;
};

export type KeepOutcome =
  | { kind: "committed"; captureId: string; slotIndex: number; reply: CommittedReply }
  | { kind: "ended"; reason: EndedReason }
  | { kind: "retryable"; error: string; uploaded: UploadedReservation | null };

function retryable(error: string, uploaded: UploadedReservation | null = null): KeepOutcome {
  return { kind: "retryable", error, uploaded };
}

function withTimeout<T>(request: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("request timed out")), ms);
  });
  return Promise.race([request, timeout]).finally(() => clearTimeout(timer));
}

/**
 * Runs one Keep/Retry. `uploaded` is the previous outcome's uploaded reservation: when present,
 * reserve and upload are skipped and only the commit is retried.
 */
export async function keepPhoto(
  deps: KeepDeps,
  uploaded: UploadedReservation | null,
): Promise<KeepOutcome> {
  const timeoutMs = deps.timeoutMs ?? KEEP_REQUEST_TIMEOUT_MS;
  let target = uploaded;

  if (!target) {
    deps.onStep("reserving");
    const key = deps.pendingKey() ?? deps.rememberNewKey();

    let reserved: ReserveResponse;
    try {
      reserved = await withTimeout(deps.reserve(key), timeoutMs);
    } catch {
      // The request may or may not have reached the server. The key stays, so Retry gets the
      // same reservation back, never a second one.
      return retryable(ATTEMPT_COPY.connectionLost);
    }

    switch (reserved.kind) {
      case "frames_exhausted":
      case "capture_not_open":
      case "expired":
        return { kind: "ended", reason: reserved.kind };
      case "not_joined":
        return retryable(ATTEMPT_COPY.notJoined);
      case "reserved":
        deps.onStep("uploading");
        try {
          await deps.upload(reserved);
        } catch {
          return retryable(ATTEMPT_COPY.uploadFailed);
        }
        target = { captureId: reserved.captureId, slotIndex: reserved.slotIndex };
        break;
      case "already_committed":
        target = { captureId: reserved.captureId, slotIndex: reserved.slotIndex };
        break;
    }
  }

  deps.onStep("committing");
  let committed: CommitResponse;
  try {
    committed = await withTimeout(deps.commit(target.captureId), timeoutMs);
  } catch {
    // The photo is in Storage. Retry re-commits this same capture; if this commit did land,
    // the server answers `committed` for the same row.
    return retryable(ATTEMPT_COPY.connectionLost, target);
  }

  switch (committed.kind) {
    case "committed":
      return { kind: "committed", ...target, reply: committed };
    case "not_uploaded":
      // Storage doesn't have the bytes yet: Retry reserves the same key again and re-uploads.
      return retryable(ATTEMPT_COPY.notUploaded);
    case "expired":
    case "capture_not_open":
      return { kind: "ended", reason: committed.kind };
    default:
      return retryable(ATTEMPT_COPY.unknown);
  }
}
