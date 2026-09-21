"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Realtime is polling for MVP (decision D9): counts and newly arriving captures refresh on
 * an interval rather than over a realtime transport. router.refresh() re-runs this route's
 * server components, so a new capture or moderation change made elsewhere shows up here
 * without the host having to reload the page.
 */
export function DashboardPoller({ intervalMs = 8000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);

  return null;
}
