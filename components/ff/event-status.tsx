import type { EventRow } from "@/lib/db/types";
import { deriveEventLifecycleState, isGalleryRevealed } from "@/lib/events/lifecycle";
import { StatusPill, type PillIcon } from "./pill";

/**
 * Event status badge (DS03 "Event status badges"): Draft → Upcoming → Open → Closed →
 * Revealed, derived purely from the accepted lifecycle (decision D8) — never a stored status.
 * "Upcoming" is the paid/active state before the host opens capture; "Revealed" is a closed
 * event whose gallery reveal has taken effect.
 */
export type EventStatusKey =
  | "draft"
  | "upcoming"
  | "open"
  | "closed"
  | "revealed"
  | "expired"
  | "archived";

export function eventStatusKey(event: EventRow, now: Date = new Date()): EventStatusKey {
  const state = deriveEventLifecycleState(event, now);
  switch (state) {
    case "draft":
      return "draft";
    case "active":
      return "upcoming";
    case "capture_open":
      return "open";
    case "capture_closed":
      return isGalleryRevealed(event, now) ? "revealed" : "closed";
    case "expired":
      return "expired";
    case "archived":
      return "archived";
  }
}

const STATUS: Record<
  EventStatusKey,
  { light: string; onPhoto: string; icon: PillIcon; tint?: boolean }
> = {
  draft: { light: "Draft", onPhoto: "Draft · Not activated", icon: "draft" },
  upcoming: { light: "Upcoming", onPhoto: "Ready · Capture not open", icon: "clock" },
  open: { light: "Open · Live now", onPhoto: "Open · Capture is live", icon: "live" },
  closed: { light: "Closed", onPhoto: "Capture closed", icon: "lock" },
  revealed: {
    light: "Gallery revealed",
    onPhoto: "Capture closed · Gallery revealed",
    icon: "check",
    tint: true,
  },
  expired: { light: "Expired", onPhoto: "Hosting expired · Downloads open", icon: "clock" },
  archived: { light: "Archived", onPhoto: "Archived", icon: "lock" },
};

export function EventStatusBadge({
  status,
  onPhoto,
  size,
}: {
  status: EventStatusKey;
  onPhoto?: boolean;
  size?: "sm" | "md";
}) {
  const s = STATUS[status];
  const icon = onPhoto && status === "revealed" ? "revealed-dot" : s.icon;
  return (
    <StatusPill
      size={size}
      tone={onPhoto ? "frosted" : s.tint ? "tint" : "light"}
      icon={icon}
    >
      {onPhoto ? s.onPhoto : s.light}
    </StatusPill>
  );
}
