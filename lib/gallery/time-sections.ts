import { formatEventHour } from "@/lib/events/format";
import { zonedDateKey, zonedHourStartUtcMs } from "@/lib/events/timezone";

/**
 * Time sections in the revealed gallery (product.md §7.5, D24, architecture §7d "Time
 * sections"). One section per local hour that has photos, by `captures.created_at` (the
 * gallery's own order key, so every section is contiguous) in the event's timezone. Presentation
 * only: this labels a list that is already authorized, filtered and ordered, and never changes it.
 * Computed on the server, so the client receives finished labels and never a photo's time.
 */

export type TimeSection = {
  /** The local hour's start as a UTC epoch-ms string. A repeated DST hour gets two keys. */
  key: string;
  /** "7 PM", or "Sat, 7 PM" when the gallery's photos span more than one local day. */
  label: string;
};

/** Whether the earliest and latest instants fall on different local calendar days. */
export function spansMoreThanOneDay(createdAts: readonly string[], timeZone: string): boolean {
  if (createdAts.length < 2) return false;
  let min = createdAts[0];
  let max = createdAts[0];
  for (const at of createdAts) {
    if (Date.parse(at) < Date.parse(min)) min = at;
    if (Date.parse(at) > Date.parse(max)) max = at;
  }
  return zonedDateKey(min, timeZone) !== zonedDateKey(max, timeZone);
}

export function sectionFor(createdAt: string, timeZone: string, withDay: boolean): TimeSection {
  const start = zonedHourStartUtcMs(Date.parse(createdAt), timeZone);
  return {
    key: String(start),
    label: formatEventHour(new Date(start).toISOString(), timeZone, { day: withDay }),
  };
}

/** A section for each instant, with the day shown or not decided once for the whole gallery. */
export function assignTimeSections(createdAts: readonly string[], timeZone: string): TimeSection[] {
  const withDay = spansMoreThanOneDay(createdAts, timeZone);
  return createdAts.map((at) => sectionFor(at, timeZone, withDay));
}

export type SectionGroup<T> = TimeSection & {
  /** Index of the group's first item in the whole list. */
  start: number;
  items: T[];
};

/**
 * Consecutive items with the same section key, in the order given. Grouping a longer prefix of
 * the same list only appends to the last group or adds new ones after it ("Show more").
 */
export function groupBySection<T extends { section: TimeSection }>(items: readonly T[]): SectionGroup<T>[] {
  const groups: SectionGroup<T>[] = [];
  items.forEach((item, index) => {
    const last = groups.at(-1);
    if (last && last.key === item.section.key) last.items.push(item);
    else groups.push({ ...item.section, start: index, items: [item] });
  });
  return groups;
}
