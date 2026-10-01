import { NextResponse, type NextRequest } from "next/server";
import { getAuthenticatedHost } from "@/lib/auth/host-session";
import { getDashboardVersion } from "@/lib/dal/dashboard-live";
import { DASHBOARD_LIVE, streamLifetimeMs } from "@/lib/events/dashboard-live";
import { createVersionStream } from "@/lib/http/sse";

/**
 * Live host-dashboard signal (decision D21, architecture §9): a Server-Sent Events stream of an
 * opaque dashboard version for one event the signed-in host owns. The browser talks only to
 * this app; Supabase stays behind the DAL. The server re-reads the version every few seconds
 * (server-side polling) and sends it only when it changes; the dashboard then refreshes from
 * the server. Polling keeps running as the fallback, so nothing depends on this stream.
 */

// Must stay above DASHBOARD_LIVE.lifetimeMs + lifetimeJitterMs (the stream ends itself first).
export const maxDuration = 300;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const { eventId } = await params;
  const host = await getAuthenticatedHost();
  if (!host) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: noStore });
  }
  // Same generic not-found for a malformed id, a missing event and another host's event.
  const first = UUID.test(eventId) ? await getDashboardVersion(host.id, eventId) : null;
  if (first === null) {
    return NextResponse.json({ error: "Not found" }, { status: 404, headers: noStore });
  }

  const stream = createVersionStream({
    read: () => getDashboardVersion(host.id, eventId),
    first,
    pollMs: DASHBOARD_LIVE.serverPollMs,
    heartbeatMs: DASHBOARD_LIVE.heartbeatMs,
    lifetimeMs: streamLifetimeMs(),
    retryMs: DASHBOARD_LIVE.retryMs,
    signal: request.signal,
    onError: (error) =>
      console.warn("dashboard.live read failed", error instanceof Error ? error.message : error),
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "private, no-cache, no-store, no-transform",
      "X-Accel-Buffering": "no",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

/**
 * A connectivity probe for the dashboard's background refreshes: any answer means the app is
 * reachable. It reads nothing and checks nothing, so it reveals nothing about the event.
 */
export function HEAD() {
  return new Response(null, { status: 204, headers: noStore });
}

const noStore = { "Cache-Control": "private, no-store" };
