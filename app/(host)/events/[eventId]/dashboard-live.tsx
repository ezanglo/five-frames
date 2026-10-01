"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DASHBOARD_LIVE,
  pollIntervalMs,
  reopenDelayMs,
  shouldBackOff,
  shouldRefreshForVersion,
} from "@/lib/events/dashboard-live";

/**
 * Live dashboard updates (decision D21, which supersedes D9's polling-only posture). A native
 * EventSource listens to this app's own `/events/[eventId]/live` stream, which sends only an
 * opaque version; when it changes, `router.refresh()` re-runs the page's server components, so
 * every number shown is read from the server, never derived from a message. No Supabase client
 * exists in the browser.
 *
 * Polling stays underneath: every `fallbackMs` while the stream isn't delivering, and every
 * minute as reconciliation while it is. A hidden tab closes the stream and pauses polling;
 * coming back refreshes once and reconnects. Nothing here announces to assistive technology.
 */
export function DashboardLive({
  eventId,
  version,
  fallbackMs = 8000,
}: {
  eventId: string;
  /** getDashboardVersion() as of this server render. */
  version: string;
  fallbackMs?: number;
}) {
  const router = useRouter();
  const seen = useRef(version);
  const lastRefreshAt = useRef(0);
  const pendingRefresh = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [streaming, setStreaming] = useState(false);

  // A server render is authoritative: adopt the version it was rendered at.
  useEffect(() => {
    seen.current = version;
  }, [version]);

  // Coalesce bursts (several commits in a few seconds) into one refresh. When a refresh's own
  // request fails at the network level, Next falls back to a full browser navigation, which
  // offline lands on the browser's error page and never recovers. So a background refresh runs
  // only after a tiny probe shows the app is reachable; otherwise this tick is skipped and the
  // next poll, the stream or the `online` event tries again.
  const requestRefresh = useCallback(() => {
    if (pendingRefresh.current) return;
    const wait = Math.max(0, lastRefreshAt.current + DASHBOARD_LIVE.refreshMinGapMs - Date.now());
    pendingRefresh.current = setTimeout(async () => {
      lastRefreshAt.current = Date.now();
      const reachable =
        navigator.onLine !== false &&
        (await fetch(`/events/${encodeURIComponent(eventId)}/live`, {
          method: "HEAD",
          cache: "no-store",
          signal: AbortSignal.timeout(DASHBOARD_LIVE.probeTimeoutMs),
        }).then(
          () => true,
          () => false,
        ));
      pendingRefresh.current = null;
      if (reachable) router.refresh();
    }, wait);
  }, [router, eventId]);

  useEffect(
    () => () => {
      if (pendingRefresh.current) clearTimeout(pendingRefresh.current);
    },
    [],
  );

  // The stream.
  useEffect(() => {
    if (typeof EventSource === "undefined") return;
    let source: EventSource | null = null;
    let reopenTimer: ReturnType<typeof setTimeout> | undefined;
    let attempt = 0;
    let failures = 0;

    const open = () => {
      if (source || document.visibilityState === "hidden") return;
      const es = new EventSource(`/events/${encodeURIComponent(eventId)}/live`);
      source = es;
      es.onopen = () => {
        attempt = 0;
        failures = 0;
        setStreaming(true);
      };
      es.addEventListener("version", (message) => {
        const incoming = (message as MessageEvent<string>).data;
        if (shouldRefreshForVersion(seen.current, incoming)) {
          seen.current = incoming;
          requestRefresh();
        }
      });
      es.onerror = () => {
        setStreaming(false);
        failures++;
        // A stream that simply ended (lifetime) reconnects by itself after the server's `retry`
        // delay and opens again. One the browser closed for good (a non-200 answer, e.g. signed
        // out), or one that keeps failing without opening, is stopped and reopened later with a
        // capped backoff, so a dead network or a blocked route never retries every few seconds.
        if (source === es && shouldBackOff(es.readyState === EventSource.CLOSED, failures)) {
          es.close();
          source = null;
          failures = 0;
          reopenTimer = setTimeout(open, reopenDelayMs(attempt++));
        }
      };
    };

    const close = () => {
      clearTimeout(reopenTimer);
      source?.close();
      source = null;
      setStreaming(false);
    };

    const resume = () => {
      requestRefresh();
      open();
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") close();
      else resume();
    };

    open();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", resume);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", resume);
      close();
    };
  }, [eventId, requestRefresh]);

  // The fallback and reconciliation poll.
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState !== "hidden") requestRefresh();
    }, pollIntervalMs(streaming, fallbackMs));
    return () => clearInterval(id);
  }, [streaming, fallbackMs, requestRefresh]);

  return null;
}
