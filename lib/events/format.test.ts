import { describe, expect, it } from "vitest";
import {
  firstName,
  formatEventDate,
  formatEventDateTime,
  formatEventTime,
  splitDuration,
} from "./format";

describe("event presentation formatting", () => {
  it("formats a calendar event_date without shifting it across a day boundary", () => {
    // A calendar date must render as itself regardless of any timezone offset.
    expect(formatEventDate("2026-10-18")).toBe("Sun, Oct 18");
    expect(formatEventDate("2026-01-01", { year: true })).toBe("Thu, Jan 1, 2026");
    expect(formatEventDate(null)).toBeNull();
  });

  it("formats an instant in the event's own timezone, crossing a day boundary", () => {
    // 2026-10-18T17:30Z is 01:30 on Oct 19 in Manila (UTC+8) but 10:30 on Oct 18 in LA.
    expect(formatEventTime("2026-10-18T17:30:00.000Z", "Asia/Manila")).toBe("1:30 AM");
    expect(formatEventTime("2026-10-18T17:30:00.000Z", "America/Los_Angeles")).toBe("10:30 AM");
    expect(formatEventDateTime("2026-12-31T17:30:00.000Z", "Asia/Manila", { year: true })).toBe(
      "Fri, Jan 1, 2027 · 1:30 AM",
    );
    expect(
      formatEventDateTime("2026-12-31T17:30:00.000Z", "America/Los_Angeles", { year: true }),
    ).toBe("Thu, Dec 31, 2026 · 9:30 AM");
  });

  it("splits a duration into non-negative units", () => {
    expect(splitDuration(((26 * 60 + 5) * 60 + 7) * 1000)).toEqual({
      days: 1,
      hours: 2,
      minutes: 5,
      seconds: 7,
    });
    expect(splitDuration(-5000)).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  });

  it("takes the first word of a display name", () => {
    expect(firstName("  Sam Cruz ")).toBe("Sam");
    expect(firstName("")).toBeNull();
  });
});
