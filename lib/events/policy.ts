/**
 * Launch-policy hypotheses for event lifecycle timing (product.md §7.3, §15.2). These are
 * explicitly **not** product invariants like the five-frame allowance (§12.12) — product.md
 * itself calls out the exact durations as launch policy parameters ("expected 48–72 hours",
 * "exact duration is a launch policy decision") rather than fixed forever. They live here,
 * named and in one place, so a future pricing/retention policy change is a one-line edit
 * instead of a hunt through DAL functions — not because any of this is user-configurable yet.
 */

/** product.md §7.3: automatic capture safety-net close, "expected 48–72 hours" after the
 *  event's configured date. The upper bound is used — the safer failure direction, since a
 *  close that fires too early would refuse a guest who is still legitimately capturing. */
export const SAFETY_NET_CLOSE_HOURS = 72;

/** product.md §15.2: "~12 months" of hosted gallery access from activation. */
export const HOSTED_ACCESS_DAYS = 365;

/** product.md §15.2: "~30 days" grace period after expiry, downloads still available. */
export const GRACE_PERIOD_DAYS = 30;

/** How far ahead of expiry the host sees an in-product warning. product.md only requires
 *  "warned in advance", without a specific lead time — chosen so a host still has a full
 *  ordinary grace-period's worth of runway to act after first seeing the warning. */
export const EXPIRY_WARNING_DAYS_BEFORE = 30;

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

export function addHours(iso: string, hours: number): string {
  return new Date(Date.parse(iso) + hours * HOUR_MS).toISOString();
}

export function addDays(iso: string, days: number): string {
  return new Date(Date.parse(iso) + days * DAY_MS).toISOString();
}
