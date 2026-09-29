/**
 * Presentation formatting for event-local dates and times. Every function takes the event's
 * own IANA timezone explicitly — never the server's or the browser's — matching the rule in
 * lib/events/timezone.ts. Pure and dependency-free, so it is safe on server and client alike.
 */

/** "Sat, Oct 18" from an `event_date` ("YYYY-MM-DD", a calendar date with no instant). */
export function formatEventDate(
  eventDate: string | null,
  options: { year?: boolean } = {},
): string | null {
  if (!eventDate) return null;
  const [year, month, day] = eventDate.split("-").map(Number);
  if (!year || !month || !day) return null;
  // A calendar date has no timezone of its own: format it as a UTC date so no offset can
  // shift it onto a neighbouring day.
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: options.year ? "numeric" : undefined,
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

/** "2:46 PM" for an instant, in the event's timezone. */
export function formatEventTime(iso: string | null, timeZone: string): string | null {
  if (!iso) return null;
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  }).format(new Date(iso));
}

/** "Sat, Oct 18 · 2:46 PM" for an instant, in the event's timezone. */
export function formatEventDateTime(iso: string | null, timeZone: string): string | null {
  if (!iso) return null;
  const date = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone,
  }).format(new Date(iso));
  return `${date} · ${formatEventTime(iso, timeZone)}`;
}

/** Remaining time as whole units, for countdowns. Never negative. */
export function splitDuration(ms: number): {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
} {
  const total = Math.max(0, Math.floor(ms / 1000));
  return {
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  };
}

/** First word of a display name, for greetings ("Hi, Sam!"). */
export function firstName(name: string | null | undefined): string | null {
  const first = name?.trim().split(/\s+/)[0];
  return first ? first : null;
}
