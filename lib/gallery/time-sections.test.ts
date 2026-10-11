import { describe, expect, it } from "vitest";
import { assignTimeSections, groupBySection, sectionFor, spansMoreThanOneDay } from "./time-sections";

/**
 * Time sections (product.md §7.5, criteria 79–80; architecture §11 "Time sections"). Labels are
 * compared with plain spaces: newer ICU puts a narrow no-break space before "AM"/"PM".
 */

const plain = (label: string) => label.replace(/ /g, " ");
const labels = (createdAts: string[], timeZone: string) =>
  assignTimeSections(createdAts, timeZone).map((s) => plain(s.label));
const keys = (createdAts: string[], timeZone: string) =>
  assignTimeSections(createdAts, timeZone).map((s) => s.key);

describe("time sections", () => {
  it("buckets by the local hour in the event's own timezone, not the server's", () => {
    // New York in October is UTC−4: 19:05, 19:55 and 20:00 local.
    const at = ["2026-10-17T23:05:00Z", "2026-10-17T23:55:00Z", "2026-10-18T00:00:00Z"];
    expect(labels(at, "America/New_York")).toEqual(["7 PM", "7 PM", "8 PM"]);
    const [a, b, c] = keys(at, "America/New_York");
    expect(a).toBe(b);
    expect(c).not.toBe(a);
    // The key is the local hour's start, as a UTC instant.
    expect(Number(a)).toBe(Date.parse("2026-10-17T23:00:00Z"));
  });

  it("splits photos either side of local midnight and then shows the day", () => {
    // Los Angeles (UTC−7): Fri 11:50 PM and Sat 12:10 AM.
    const at = ["2026-10-17T06:50:00Z", "2026-10-17T07:10:00Z"];
    const sections = assignTimeSections(at, "America/Los_Angeles");
    expect(sections[0].key).not.toBe(sections[1].key);
    expect(sections.map((s) => plain(s.label))).toEqual(["Fri, 11 PM", "Sat, 12 AM"]);
  });

  it("decides the day from local days, not UTC days", () => {
    // Manila (UTC+8): 7:30 AM and 9 AM on one local day, on two different UTC days.
    const sameLocalDay = ["2026-10-16T23:30:00Z", "2026-10-17T01:00:00Z"];
    expect(spansMoreThanOneDay(sameLocalDay, "Asia/Manila")).toBe(false);
    expect(labels(sameLocalDay, "Asia/Manila")).toEqual(["7 AM", "9 AM"]);

    // One UTC day, two local days: 3:30 PM and 4:30 PM UTC are 11:30 PM and 12:30 AM in Manila.
    const twoLocalDays = ["2026-10-17T15:30:00Z", "2026-10-17T16:30:00Z"];
    expect(spansMoreThanOneDay(twoLocalDays, "Asia/Manila")).toBe(true);
    expect(labels(twoLocalDays, "Asia/Manila")).toEqual(["Sat, 11 PM", "Sun, 12 AM"]);
  });

  it("shows the day on every section once the gallery spans two days, whatever the order", () => {
    const at = ["2026-10-17T12:00:00Z", "2026-10-18T12:00:00Z", "2026-10-17T13:00:00Z"];
    expect(spansMoreThanOneDay(at, "UTC")).toBe(true);
    expect(labels(at, "UTC")).toEqual(["Sat, 12 PM", "Sun, 12 PM", "Sat, 1 PM"]);
    expect(spansMoreThanOneDay(["2026-10-17T12:00:00Z"], "UTC")).toBe(false);
    expect(spansMoreThanOneDay([], "UTC")).toBe(false);
  });

  it("gives a repeated DST hour two sections", () => {
    // New York falls back on 2026-11-01 at 2 AM EDT: 1:30 AM happens twice.
    const at = ["2026-11-01T04:30:00Z", "2026-11-01T05:30:00Z", "2026-11-01T06:30:00Z"];
    expect(labels(at, "America/New_York")).toEqual(["12 AM", "1 AM", "1 AM"]);
    expect(new Set(keys(at, "America/New_York")).size).toBe(3);
    expect(Number(keys(at, "America/New_York")[2])).toBe(Date.parse("2026-11-01T06:00:00Z"));
  });

  it("handles a half-hour offset zone", () => {
    // Kolkata (UTC+5:30): 7:10 PM and 7:50 PM local share the hour that starts at 13:30 UTC.
    const at = ["2026-10-17T13:40:00Z", "2026-10-17T14:20:00Z"];
    const [a, b] = keys(at, "Asia/Kolkata");
    expect(a).toBe(b);
    expect(Number(a)).toBe(Date.parse("2026-10-17T13:30:00Z"));
    expect(labels(at, "Asia/Kolkata")).toEqual(["7 PM", "7 PM"]);
  });

  it("keeps sub-second precision out of the key", () => {
    const withMs = sectionFor("2026-10-17T23:05:12.987Z", "America/New_York", false);
    expect(Number(withMs.key)).toBe(Date.parse("2026-10-17T23:00:00Z"));
  });
});

describe("grouping the gallery into sections", () => {
  // In gallery order (created_at ascending), Manila time.
  const createdAts = [
    "2026-10-17T11:02:00Z", // 7 PM
    "2026-10-17T11:40:00Z", // 7 PM
    "2026-10-17T11:59:59Z", // 7 PM
    "2026-10-17T12:00:00Z", // 8 PM
    "2026-10-17T14:15:00Z", // 10 PM (no photos at 9 PM)
    "2026-10-17T14:45:00Z", // 10 PM
  ];
  const sections = assignTimeSections(createdAts, "Asia/Manila");
  const items = createdAts.map((_, i) => ({ id: `c${i}`, section: sections[i] }));

  it("forms one contiguous group per hour that has photos, and none for empty hours", () => {
    const groups = groupBySection(items);
    expect(groups.map((g) => plain(g.label))).toEqual(["7 PM", "8 PM", "10 PM"]);
    expect(groups.map((g) => g.items.map((i) => i.id))).toEqual([["c0", "c1", "c2"], ["c3"], ["c4", "c5"]]);
    expect(groups.map((g) => g.start)).toEqual([0, 3, 4]);
    expect(new Set(groups.map((g) => g.key)).size).toBe(groups.length);
    // Same items, same order: sections only add labels between them.
    expect(groups.flatMap((g) => g.items)).toEqual(items);
  });

  it("only appends when more of the list is shown", () => {
    for (let shown = 1; shown < items.length; shown++) {
      const before = groupBySection(items.slice(0, shown));
      const after = groupBySection(items.slice(0, shown + 1));
      before.forEach((group, g) => {
        expect(after[g].key).toBe(group.key);
        expect(after[g].start).toBe(group.start);
        expect(after[g].items.slice(0, group.items.length)).toEqual(group.items);
        // Only the last group may grow.
        if (g < before.length - 1) expect(after[g].items).toEqual(group.items);
      });
    }
  });
});
