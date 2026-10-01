import { describe, expect, it } from "vitest";
import {
  DASHBOARD_LIVE,
  DASHBOARD_LIVE_MAX_DURATION_S,
  pollIntervalMs,
  reopenDelayMs,
  shouldBackOff,
  shouldRefreshForVersion,
  streamLifetimeMs,
} from "@/lib/events/dashboard-live";
import { readFileSync } from "node:fs";
import path from "node:path";
import { HEAD, maxDuration } from "@/app/(host)/events/[eventId]/live/route";

/** The client component's code, without comments. */
const CLIENT = readFileSync(
  path.resolve(import.meta.dirname, "../../app/(host)/events/[eventId]/dashboard-live.tsx"),
  "utf-8",
).replace(/\/\*[\s\S]*?\*\/|^\s*\/\/.*$/gm, "");

describe("dashboard live timing and decisions (D21)", () => {
  it("ends every stream before the route's maxDuration, jitter included", () => {
    expect(maxDuration).toBe(DASHBOARD_LIVE_MAX_DURATION_S);
    expect(streamLifetimeMs(0.999_999)).toBeLessThan(DASHBOARD_LIVE_MAX_DURATION_S * 1000 - 10_000);
    expect(streamLifetimeMs(0)).toBe(DASHBOARD_LIVE.lifetimeMs);
  });

  it("refreshes only for a new, non-empty version", () => {
    expect(shouldRefreshForVersion("a", "a")).toBe(false);
    expect(shouldRefreshForVersion("a", "b")).toBe(true);
    expect(shouldRefreshForVersion(null, "b")).toBe(true);
    expect(shouldRefreshForVersion("a", "")).toBe(false);
  });

  it("duplicate or replayed signals collapse: the same message twice asks once", () => {
    let seen: string | null = "v1";
    let refreshes = 0;
    for (const incoming of ["v2", "v2", "v2", "v3", "v3"]) {
      if (shouldRefreshForVersion(seen, incoming)) {
        seen = incoming;
        refreshes++;
      }
    }
    expect(refreshes).toBe(2);
  });

  it("polls fast only while the stream isn't delivering", () => {
    expect(pollIntervalMs(false, 8000)).toBe(8000);
    expect(pollIntervalMs(true, 8000)).toBe(DASHBOARD_LIVE.reconcileMs);
    expect(pollIntervalMs(true, 120_000)).toBe(120_000);
  });

  it("stops the browser's fixed retry after repeated failures without an open", () => {
    expect(shouldBackOff(false, 1)).toBe(false);
    expect(shouldBackOff(false, DASHBOARD_LIVE.failuresBeforeBackoff - 1)).toBe(false);
    expect(shouldBackOff(false, DASHBOARD_LIVE.failuresBeforeBackoff)).toBe(true);
    expect(shouldBackOff(true, 1)).toBe(true);
  });

  it("backs off reopening a closed stream, capped, so it can't storm", () => {
    expect(reopenDelayMs(0)).toBe(DASHBOARD_LIVE.reopenBaseMs);
    expect(reopenDelayMs(1)).toBe(DASHBOARD_LIVE.reopenBaseMs * 2);
    expect(reopenDelayMs(50)).toBe(DASHBOARD_LIVE.reopenMaxMs);
    expect(DASHBOARD_LIVE.retryMs).toBeGreaterThanOrEqual(1000);
  });

  // Regression (Slice 18 Preview check): a background refresh fired while offline made Next fall
  // back to a full navigation, stranding the dashboard on the browser's offline error page.
  it("only refreshes after the reachability probe succeeds", () => {
    const calls = CLIENT.match(/router\.refresh\(\)/g) ?? [];
    expect(calls).toHaveLength(1);
    expect(CLIENT).toMatch(/if \(reachable\) router\.refresh\(\);/);
    expect(CLIENT).toMatch(/method: "HEAD"/);
    expect(CLIENT).toMatch(/navigator\.onLine !== false/);
  });

  it("the probe answers 204 with no body and reads nothing", async () => {
    const response = HEAD();
    expect(response.status).toBe(204);
    expect(response.body).toBeNull();
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
});
