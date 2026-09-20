/**
 * Converts a `<input type="datetime-local">` value (a timezone-less wall-clock string,
 * e.g. "2027-01-24T00:00") into the UTC instant it represents *in the given IANA
 * timezone* — not the server process's own timezone, which `new Date(string)` would
 * otherwise use. DST-aware via Intl, no date library needed.
 */
export function zonedDateTimeLocalToUtcIso(
  dateTimeLocal: string,
  timeZone: string,
): string {
  const [datePart, timePart] = dateTimeLocal.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);

  const utcGuess = Date.UTC(year, month - 1, day, hour, minute);
  const offset = tzOffsetMillis(new Date(utcGuess), timeZone);

  return new Date(utcGuess - offset).toISOString();
}

/** The inverse: formats a UTC instant as a wall-clock string in the given timezone. */
export function utcIsoToZonedDateTimeLocal(
  isoUtc: string,
  timeZone: string,
): string {
  const dtf = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = partsMap(dtf.formatToParts(new Date(isoUtc)));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

function tzOffsetMillis(date: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const p = partsMap(dtf.formatToParts(date));
  const asUtc = Date.UTC(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    Number(p.hour) % 24,
    Number(p.minute),
    Number(p.second),
  );
  return asUtc - date.getTime();
}

function partsMap(parts: Intl.DateTimeFormatPart[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== "literal") map[part.type] = part.value;
  }
  return map;
}
