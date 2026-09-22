import { describe, expect, it } from "vitest";
import {
  computeSafetyNetClosesAt,
  deriveEventLifecycleState,
  getExpiryWarning,
  hasReachedGuestCapacity,
  isCaptureOpen,
  isGalleryRevealed,
} from "./lifecycle";
import type { EventRow } from "@/lib/db/types";

function baseEvent(overrides: Partial<EventRow> = {}): EventRow {
  return {
    id: "00000000-0000-0000-0000-000000000000",
    host_id: "00000000-0000-0000-0000-000000000001",
    name: "Test Wedding",
    event_date: null,
    timezone: "Asia/Manila",
    host_message: null,
    reveal_mode: "after_event",
    reveal_at: null,
    visibility: "anyone_with_link",
    sharing_enabled: true,
    hashtag: null,
    event_token: null,
    gallery_token: null,
    activated_at: null,
    activating_payment_id: null,
    capture_opened_at: null,
    capture_closed_at: null,
    safety_net_closes_at: null,
    hosted_until: null,
    grace_until: null,
    media_deleted_at: null,
    guest_session_cap: 250,
    guest_session_count: 0,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

const NOW = new Date("2026-06-15T12:00:00.000Z");

describe("deriveEventLifecycleState", () => {
  it("is draft before activation", () => {
    expect(deriveEventLifecycleState(baseEvent(), NOW)).toBe("draft");
  });

  it("is active once activated but capture not yet opened", () => {
    const event = baseEvent({ activated_at: "2026-06-01T00:00:00.000Z" });
    expect(deriveEventLifecycleState(event, NOW)).toBe("active");
  });

  it("is capture_open once the host opens capture", () => {
    const event = baseEvent({
      activated_at: "2026-06-01T00:00:00.000Z",
      capture_opened_at: "2026-06-15T10:00:00.000Z",
    });
    expect(deriveEventLifecycleState(event, NOW)).toBe("capture_open");
    expect(isCaptureOpen(event, NOW)).toBe(true);
  });

  it("is capture_closed once the host manually closes capture", () => {
    const event = baseEvent({
      activated_at: "2026-06-01T00:00:00.000Z",
      capture_opened_at: "2026-06-15T10:00:00.000Z",
      capture_closed_at: "2026-06-15T11:00:00.000Z",
    });
    expect(deriveEventLifecycleState(event, NOW)).toBe("capture_closed");
    expect(isCaptureOpen(event, NOW)).toBe(false);
  });

  it("is capture_closed the instant the safety-net deadline elapses, with no close recorded and no cron run", () => {
    const event = baseEvent({
      activated_at: "2026-06-01T00:00:00.000Z",
      capture_opened_at: "2026-06-10T00:00:00.000Z",
      safety_net_closes_at: "2026-06-15T11:59:59.999Z",
    });
    expect(deriveEventLifecycleState(event, NOW)).toBe("capture_closed");
    expect(isCaptureOpen(event, NOW)).toBe(false);
  });

  it("is still capture_open one millisecond before the safety-net deadline", () => {
    const event = baseEvent({
      activated_at: "2026-06-01T00:00:00.000Z",
      capture_opened_at: "2026-06-10T00:00:00.000Z",
      safety_net_closes_at: "2026-06-15T12:00:00.001Z",
    });
    expect(deriveEventLifecycleState(event, NOW)).toBe("capture_open");
  });

  it("is expired once hosted_until elapses, regardless of capture state", () => {
    const event = baseEvent({
      activated_at: "2026-01-01T00:00:00.000Z",
      capture_opened_at: "2026-01-02T00:00:00.000Z",
      hosted_until: "2026-06-15T11:00:00.000Z",
    });
    expect(deriveEventLifecycleState(event, NOW)).toBe("expired");
  });

  it("is archived once the grace period elapses, even if hosted_until is also past", () => {
    const event = baseEvent({
      activated_at: "2026-01-01T00:00:00.000Z",
      hosted_until: "2026-02-01T00:00:00.000Z",
      grace_until: "2026-06-15T11:00:00.000Z",
    });
    expect(deriveEventLifecycleState(event, NOW)).toBe("archived");
  });

  it("never reports capture_open before activation, even with stale open/close timestamps", () => {
    const event = baseEvent({
      activated_at: null,
      capture_opened_at: "2026-06-01T00:00:00.000Z",
    });
    expect(deriveEventLifecycleState(event, NOW)).toBe("draft");
    expect(isCaptureOpen(event, NOW)).toBe(false);
  });
});

describe("isGalleryRevealed", () => {
  it("is never revealed before activation, regardless of reveal mode", () => {
    const event = baseEvent({ reveal_mode: "immediate" });
    expect(isGalleryRevealed(event, NOW)).toBe(false);
  });

  it("'immediate' reveals as soon as the event is activated, capture open or not", () => {
    const event = baseEvent({
      reveal_mode: "immediate",
      activated_at: "2026-06-01T00:00:00.000Z",
    });
    expect(isGalleryRevealed(event, NOW)).toBe(true);
  });

  it("'after_event' (default) is not revealed while capture is still open", () => {
    const event = baseEvent({
      reveal_mode: "after_event",
      activated_at: "2026-06-01T00:00:00.000Z",
      capture_opened_at: "2026-06-10T00:00:00.000Z",
    });
    expect(isGalleryRevealed(event, NOW)).toBe(false);
  });

  it("'after_event' reveals once capture has closed", () => {
    const event = baseEvent({
      reveal_mode: "after_event",
      activated_at: "2026-06-01T00:00:00.000Z",
      capture_opened_at: "2026-06-10T00:00:00.000Z",
      capture_closed_at: "2026-06-15T00:00:00.000Z",
    });
    expect(isGalleryRevealed(event, NOW)).toBe(true);
  });

  it("'custom' is not revealed before reveal_at", () => {
    const event = baseEvent({
      reveal_mode: "custom",
      activated_at: "2026-06-01T00:00:00.000Z",
      reveal_at: "2026-06-15T12:00:00.001Z",
    });
    expect(isGalleryRevealed(event, NOW)).toBe(false);
  });

  it("'custom' is revealed the instant reveal_at elapses", () => {
    const event = baseEvent({
      reveal_mode: "custom",
      activated_at: "2026-06-01T00:00:00.000Z",
      reveal_at: "2026-06-15T12:00:00.000Z",
    });
    expect(isGalleryRevealed(event, NOW)).toBe(true);
  });

  it("'custom' with no reveal_at set is never revealed", () => {
    const event = baseEvent({
      reveal_mode: "custom",
      activated_at: "2026-06-01T00:00:00.000Z",
      reveal_at: null,
    });
    expect(isGalleryRevealed(event, NOW)).toBe(false);
  });
});

describe("hasReachedGuestCapacity", () => {
  it("is false below the cap", () => {
    const event = baseEvent({ guest_session_cap: 250, guest_session_count: 249 });
    expect(hasReachedGuestCapacity(event)).toBe(false);
  });

  it("is true exactly at the cap", () => {
    const event = baseEvent({ guest_session_cap: 250, guest_session_count: 250 });
    expect(hasReachedGuestCapacity(event)).toBe(true);
  });

  it("is true past the cap", () => {
    const event = baseEvent({ guest_session_cap: 250, guest_session_count: 251 });
    expect(hasReachedGuestCapacity(event)).toBe(true);
  });
});

describe("computeSafetyNetClosesAt", () => {
  it("anchors to 72 hours after the end of the configured event day, in the event's timezone", () => {
    const event = baseEvent({ event_date: "2026-06-15", timezone: "Asia/Manila" });
    const openedAt = new Date("2026-06-15T08:00:00.000Z");
    // 2026-06-15T23:59 Asia/Manila (UTC+8) = 2026-06-15T15:59:00.000Z; +72h.
    expect(computeSafetyNetClosesAt(event, openedAt)).toBe("2026-06-18T15:59:00.000Z");
  });

  it("falls back to 72 hours after the capture-open instant when no event date is configured", () => {
    const event = baseEvent({ event_date: null });
    const openedAt = new Date("2026-06-15T08:00:00.000Z");
    expect(computeSafetyNetClosesAt(event, openedAt)).toBe("2026-06-18T08:00:00.000Z");
  });

  it("anchors to the capture-open instant when the event date has already long passed", () => {
    const event = baseEvent({ event_date: "2026-01-01", timezone: "Asia/Manila" });
    const openedAt = new Date("2026-06-15T08:00:00.000Z");
    expect(computeSafetyNetClosesAt(event, openedAt)).toBe("2026-06-18T08:00:00.000Z");
  });
});

describe("getExpiryWarning", () => {
  const activated = "2026-01-01T00:00:00.000Z";

  it("is null with no hosted_until set", () => {
    const event = baseEvent({ activated_at: activated });
    expect(getExpiryWarning(event, NOW)).toBeNull();
  });

  it("is null well before the warning window", () => {
    const event = baseEvent({
      activated_at: activated,
      hosted_until: "2027-06-15T12:00:00.000Z",
    });
    expect(getExpiryWarning(event, NOW)).toBeNull();
  });

  it("shows within the warning window before hosted_until", () => {
    const event = baseEvent({
      activated_at: activated,
      hosted_until: "2026-07-10T12:00:00.000Z",
    });
    const warning = getExpiryWarning(event, NOW);
    expect(warning).not.toBeNull();
    expect(warning?.daysRemaining).toBe(25);
  });

  it("is null once the event has already expired (no stale 'expiring soon' warning after the fact)", () => {
    const event = baseEvent({
      activated_at: activated,
      hosted_until: "2026-06-14T12:00:00.000Z",
    });
    expect(getExpiryWarning(event, NOW)).toBeNull();
  });

  it("is null once archived", () => {
    const event = baseEvent({
      activated_at: activated,
      hosted_until: "2026-06-01T00:00:00.000Z",
      grace_until: "2026-06-10T00:00:00.000Z",
    });
    expect(getExpiryWarning(event, NOW)).toBeNull();
  });
});
