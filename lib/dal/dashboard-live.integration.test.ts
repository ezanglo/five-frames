import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service-client";
import { generateLinkToken } from "@/lib/auth/link-tokens";
import { createDraftEvent } from "@/lib/dal/events";
import { createGuestSession } from "@/lib/dal/guest-sessions";
import { getDashboardVersion } from "@/lib/dal/dashboard-live";
import type { HostSession } from "@/lib/auth/host-session";
import type { EventRow } from "@/lib/db/types";

/**
 * Live host-dashboard stream (decision D21) against the real dev Postgres: the route only
 * streams for the signed-in owner, answers everything else with the same refusal, sends an
 * opaque version rather than dashboard data, notices a real guest join and a time-derived
 * reveal, and a reconnect after a missed change starts from the current version. Nothing here
 * writes except the test fixtures.
 */

let currentHost: HostSession | null = null;
vi.mock("@/lib/auth/host-session", () => ({
  getAuthenticatedHost: async () => currentHost,
  requireHost: async () => {
    if (!currentHost) throw new Error("redirect");
    return currentHost;
  },
}));

const { GET } = await import("@/app/(host)/events/[eventId]/live/route");

type Opened = {
  status: number;
  contentType: string | null;
  /** Resolves with the next `version` data, or null if the stream ended first. */
  nextVersion: (timeoutMs?: number) => Promise<string | null>;
  raw: () => string;
  close: () => Promise<void>;
};

async function open(eventId: string): Promise<Opened> {
  const abort = new AbortController();
  const request = new NextRequest(`http://localhost:3000/events/${eventId}/live`, { signal: abort.signal });
  const response = await GET(request, { params: Promise.resolve({ eventId }) });
  let buffer = "";
  let consumed = 0;
  const reader = response.body?.getReader();
  const decoder = new TextDecoder();

  async function nextVersion(timeoutMs = 15_000): Promise<string | null> {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const match = /event: version\ndata: (.*)\n\n/.exec(buffer.slice(consumed));
      if (match) {
        consumed += match.index + match[0].length;
        return match[1];
      }
      if (!reader || Date.now() > deadline) return null;
      const chunk = await Promise.race([
        reader.read(),
        new Promise<null>((r) => setTimeout(() => r(null), Math.max(1, deadline - Date.now()))),
      ]);
      if (!chunk) return null;
      if (chunk.done) return null;
      buffer += decoder.decode(chunk.value, { stream: true });
    }
  }

  return {
    status: response.status,
    contentType: response.headers.get("content-type"),
    nextVersion,
    raw: () => buffer,
    close: async () => {
      abort.abort();
      await reader?.cancel().catch(() => {});
    },
  };
}

describe("dashboard live stream (real Postgres)", { timeout: 120_000 }, () => {
  const supabase = createServiceClient();
  const suffix = crypto.randomUUID();
  let hostA: HostSession;
  let hostB: HostSession;

  beforeAll(async () => {
    const made: HostSession[] = [];
    for (const label of ["a", "b"]) {
      const email = `live-host-${label}-${suffix}@example.test`;
      const { data, error } = await supabase.auth.admin.createUser({
        email,
        password: crypto.randomUUID(),
        email_confirm: true,
      });
      if (error) throw error;
      made.push({ id: data.user.id, email, name: null });
    }
    [hostA, hostB] = made;
  });

  afterAll(async () => {
    currentHost = null;
    if (hostA) await supabase.auth.admin.deleteUser(hostA.id);
    if (hostB) await supabase.auth.admin.deleteUser(hostB.id);
  });

  async function activatedEvent(patch: Record<string, unknown> = {}): Promise<EventRow> {
    const event = await createDraftEvent(hostA.id, `Live ${crypto.randomUUID().slice(0, 8)}`);
    const { data, error } = await supabase
      .from("events")
      .update({
        activated_at: new Date().toISOString(),
        event_token: generateLinkToken(),
        gallery_token: generateLinkToken(),
        capture_opened_at: new Date().toISOString(),
        ...patch,
      })
      .eq("id", event.id)
      .select()
      .single();
    if (error) throw error;
    return data as EventRow;
  }

  it("refuses a signed-out request, another host, an unknown id and a malformed id alike", async () => {
    const event = await activatedEvent();

    currentHost = null;
    expect((await open(event.id)).status).toBe(401);

    currentHost = hostB;
    const other = await open(event.id);
    expect(other.status).toBe(404);
    expect(other.contentType).not.toContain("text/event-stream");

    expect((await open(crypto.randomUUID())).status).toBe(404);
    expect((await open("not-an-id")).status).toBe(404);
    expect((await open("../../api/cron")).status).toBe(404);
  });

  it("streams an opaque version to the owner, matching what the page renders", async () => {
    const event = await activatedEvent();
    currentHost = hostA;
    const stream = await open(event.id);
    try {
      expect(stream.status).toBe(200);
      expect(stream.contentType).toContain("text/event-stream");
      const first = await stream.nextVersion();
      expect(first).toBe(await getDashboardVersion(hostA.id, event.id));
      expect(first).toMatch(/^[A-Za-z0-9_-]{16}$/);
      // No dashboard data rides on the stream: no name, counts, tokens or ids.
      const raw = stream.raw();
      expect(raw).not.toContain(event.name);
      expect(raw).not.toContain(event.event_token!);
      expect(raw).not.toContain(event.id);
      expect(raw).toContain("retry: ");
    } finally {
      await stream.close();
    }
  });

  it("a real guest join produces a new version on the open stream", async () => {
    const event = await activatedEvent();
    currentHost = hostA;
    const stream = await open(event.id);
    try {
      const before = await stream.nextVersion();
      const joined = await createGuestSession(event.id, "Live test guest");
      expect(joined.kind).toBe("joined");
      const after = await stream.nextVersion();
      expect(after).not.toBeNull();
      expect(after).not.toBe(before);
      expect(after).toBe(await getDashboardVersion(hostA.id, event.id));
    } finally {
      await stream.close();
    }
  });

  it("notices a custom reveal time passing with no write at all", async () => {
    const event = await activatedEvent({
      reveal_mode: "custom",
      reveal_at: new Date(Date.now() + 1_500).toISOString(),
    });
    const now = new Date();
    const before = await getDashboardVersion(hostA.id, event.id, now);
    const later = await getDashboardVersion(hostA.id, event.id, new Date(now.getTime() + 5_000));
    expect(later).not.toBe(before);
  });

  it("a reconnect after a missed change starts from the current version, so nothing is lost", async () => {
    const event = await activatedEvent();
    currentHost = hostA;
    const first = await open(event.id);
    const seen = await first.nextVersion();
    await first.close();

    // A change lands while the dashboard is disconnected.
    await createGuestSession(event.id, "Joined while offline");

    const second = await open(event.id);
    try {
      const resumed = await second.nextVersion();
      expect(resumed).not.toBe(seen);
      expect(resumed).toBe(await getDashboardVersion(hostA.id, event.id));
    } finally {
      await second.close();
    }
  });

  it("the stream stops once the host no longer owns the event", async () => {
    const event = await activatedEvent();
    currentHost = hostA;
    const stream = await open(event.id);
    await stream.nextVersion();
    const { error } = await supabase.from("events").update({ host_id: hostB.id }).eq("id", event.id);
    if (error) throw error;
    // The next server read finds no owned event and ends the stream without another version.
    expect(await stream.nextVersion(10_000)).toBeNull();
    await stream.close();
    await supabase.from("events").update({ host_id: hostA.id }).eq("id", event.id);
  });
});
