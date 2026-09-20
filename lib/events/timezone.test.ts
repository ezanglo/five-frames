import { describe, expect, it } from "vitest";
import {
  utcIsoToZonedDateTimeLocal,
  zonedDateTimeLocalToUtcIso,
} from "./timezone";

describe("zonedDateTimeLocalToUtcIso", () => {
  it("interprets the wall-clock string in the given timezone, not the process timezone", () => {
    // Asia/Manila is UTC+8 with no DST.
    expect(zonedDateTimeLocalToUtcIso("2027-01-24T00:00", "Asia/Manila")).toBe(
      "2027-01-23T16:00:00.000Z",
    );
  });

  it("round-trips through utcIsoToZonedDateTimeLocal", () => {
    const local = "2027-06-15T09:30";
    const utc = zonedDateTimeLocalToUtcIso(local, "America/New_York");
    expect(utcIsoToZonedDateTimeLocal(utc, "America/New_York")).toBe(local);
  });

  it("accounts for daylight saving in the target timezone", () => {
    // New York is UTC-5 in January (EST) and UTC-4 in July (EDT).
    expect(
      zonedDateTimeLocalToUtcIso("2027-01-15T12:00", "America/New_York"),
    ).toBe("2027-01-15T17:00:00.000Z");
    expect(
      zonedDateTimeLocalToUtcIso("2027-07-15T12:00", "America/New_York"),
    ).toBe("2027-07-15T16:00:00.000Z");
  });
});

describe("utcIsoToZonedDateTimeLocal", () => {
  it("renders a UTC instant as wall-clock time in the given timezone", () => {
    expect(
      utcIsoToZonedDateTimeLocal("2027-01-23T16:00:00.000Z", "Asia/Manila"),
    ).toBe("2027-01-24T00:00");
  });
});
