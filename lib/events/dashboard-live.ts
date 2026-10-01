/**
 * Timing and client decisions for live host-dashboard updates (decision D21, architecture §9).
 * Pure and DOM-free, so the route and the client component share one set of numbers and the
 * decisions are unit-testable without a browser.
 *
 * Correctness never depends on any of this: every refresh re-reads the page on the server, and
 * polling keeps running underneath the stream.
 */

export const DASHBOARD_LIVE = {
  /** How often the stream re-reads the authoritative version on the server. */
  serverPollMs: 3_000,
  /** Comment line sent when nothing else was written for this long. */
  heartbeatMs: 25_000,
  /**
   * The stream ends itself before the route's `maxDuration` (300 s), with jitter so dashboards
   * opened together don't reconnect together.
   */
  lifetimeMs: 240_000,
  lifetimeJitterMs: 30_000,
  /** EventSource's reconnect delay after the stream ends or drops. */
  retryMs: 3_000,
  /** Reconciliation poll while the stream is healthy. */
  reconcileMs: 60_000,
  /**
   * Failed connection attempts (no open in between) after which the client stops the browser's
   * own fixed-interval retry and switches to the capped backoff below.
   */
  failuresBeforeBackoff: 3,
  /** Reopen delays after the browser gives up on the stream (non-200, or repeated failures). */
  reopenBaseMs: 15_000,
  reopenMaxMs: 300_000,
  /** A background refresh is skipped when the connectivity probe takes longer than this. */
  probeTimeoutMs: 5_000,
  /** Refreshes are coalesced to at most one per this window. */
  refreshMinGapMs: 1_000,
} as const;

/** Maximum route duration in seconds; must stay above lifetime + jitter. */
export const DASHBOARD_LIVE_MAX_DURATION_S = 300;

export function streamLifetimeMs(random: number = Math.random()): number {
  return DASHBOARD_LIVE.lifetimeMs + Math.floor(random * DASHBOARD_LIVE.lifetimeJitterMs);
}

/**
 * A version message asks for a refresh only when it differs from what the page last rendered
 * or last asked for. Duplicate, replayed or reordered messages cause at most an extra refresh,
 * never a wrong number: nothing is counted from messages.
 */
export function shouldRefreshForVersion(current: string | null, incoming: string): boolean {
  return incoming.length > 0 && incoming !== current;
}

/** Fallback poll interval: aggressive only while the stream isn't delivering. */
export function pollIntervalMs(streaming: boolean, fallbackMs: number): number {
  return streaming ? Math.max(DASHBOARD_LIVE.reconcileMs, fallbackMs) : fallbackMs;
}

/**
 * Whether to stop the current EventSource and reopen later with backoff: the browser closed it
 * for good (a non-200 answer), or it keeps failing without ever opening (network down, blocked).
 * A stream that ends normally opens again on the browser's first retry, resetting the count.
 */
export function shouldBackOff(closed: boolean, failuresSinceOpen: number): boolean {
  return closed || failuresSinceOpen >= DASHBOARD_LIVE.failuresBeforeBackoff;
}

/** Capped exponential delay before reopening a stream the browser closed for good. */
export function reopenDelayMs(attempt: number): number {
  const delay = DASHBOARD_LIVE.reopenBaseMs * 2 ** Math.max(0, attempt);
  return Math.min(delay, DASHBOARD_LIVE.reopenMaxMs);
}
