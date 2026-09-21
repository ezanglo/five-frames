import type { EventRow } from "@/lib/db/types";

/**
 * Derived from timestamps, not stored (decision D8): correct the instant a deadline
 * elapses, even if no cron job has run. `pending_payment` isn't derivable yet — it
 * depends on the `payments` table introduced in Slice 6 — so it's absent here; every
 * event without `activated_at` reads as `draft` until then.
 */
export type EventLifecycleState =
  | "draft"
  | "active"
  | "capture_open"
  | "capture_closed"
  | "expired"
  | "archived";

export function deriveEventLifecycleState(
  event: EventRow,
  now: Date = new Date(),
): EventLifecycleState {
  const t = now.getTime();

  if (event.grace_until && t >= Date.parse(event.grace_until)) {
    return "archived";
  }

  if (event.hosted_until && t >= Date.parse(event.hosted_until)) {
    return "expired";
  }

  if (!event.activated_at) {
    return "draft";
  }

  if (event.capture_closed_at) {
    return "capture_closed";
  }

  if (
    event.safety_net_closes_at &&
    t >= Date.parse(event.safety_net_closes_at)
  ) {
    return "capture_closed";
  }

  if (event.capture_opened_at) {
    return "capture_open";
  }

  return "active";
}

export const EVENT_LIFECYCLE_STATE_LABEL: Record<EventLifecycleState, string> = {
  draft: "Draft",
  active: "Active",
  capture_open: "Capture open",
  capture_closed: "Capture closed",
  expired: "Expired",
  archived: "Archived",
};

/** Product invariant 6: capture is possible only while this is true. */
export function isCaptureOpen(
  event: EventRow,
  now: Date = new Date(),
): boolean {
  return deriveEventLifecycleState(event, now) === "capture_open";
}

/**
 * Whether the host may open (or reopen) capture right now (product.md §7.2): the event
 * must be activated and not past the automatic safety-net close, which is terminal.
 */
export function canOpenCapture(event: EventRow, now: Date = new Date()): boolean {
  const state = deriveEventLifecycleState(event, now);
  if (state === "capture_open") return true;
  if (state !== "active" && state !== "capture_closed") return false;
  if (
    state === "capture_closed" &&
    event.safety_net_closes_at &&
    now.getTime() >= Date.parse(event.safety_net_closes_at)
  ) {
    return false;
  }
  return true;
}
