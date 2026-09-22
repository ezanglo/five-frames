/**
 * Event pricing (product.md §15). No secrets here, so this has no `server-only` import —
 * both the checkout confirmation page (server component) and the DAL read it.
 *
 * The launch price hypothesis is ₱999/event; the post-validation target (₱1,490) is a
 * later business decision (product.md §19), not implemented as a second tier — there is
 * exactly one price in code today, and moving it is a one-constant change, not a pricing
 * system.
 */

export const EVENT_PRICE_PHP = 999;
export const EVENT_PRICE_CENTAVOS = EVENT_PRICE_PHP * 100;
export const CURRENCY = "PHP";

/**
 * We do not pass PayMongo's processing fee on to the host (`pass_on_fees: false` in the
 * checkout session request) — the disclosed price is the full amount charged, with no
 * separate fee line, which is itself the fee disclosure product.md §7.2/§15 requires.
 */
export const PASS_ON_FEES = false;

/**
 * How long a still-`pending` provider payment is treated as "likely still confirming" in
 * the checkout UI (discourage a second real charge) versus "probably abandoned, safe to
 * retry." This is a UI heuristic only — it never gates `startProviderCheckout` itself,
 * which stays retryable at any time; it exists because a second completed checkout is a
 * second real PayMongo charge, not something our idempotent `activateEvent` guard
 * prevents (that guard stops double *activation*, not double *charging*).
 */
export const PENDING_PAYMENT_GRACE_MINUTES = 10;

/**
 * Pure (default-`now`-parameterized, matching the lib/events/lifecycle.ts pattern) so
 * server components can call it without a literal `Date.now()`/`new Date()` in their
 * render body — the React compiler's purity check flags that even in a server component.
 */
export function isPaymentLikelyStillConfirming(
  payment: { provider_status: string | null; created_at: string } | null | undefined,
  now: Date = new Date(),
): boolean {
  return getPendingPaymentState(payment, now).isLikelyStillConfirming;
}

export function getPendingPaymentState(
  payment: { provider_status: string | null; created_at: string } | null | undefined,
  now: Date = new Date(),
): { isPending: boolean; isLikelyStillConfirming: boolean } {
  if (payment?.provider_status !== "pending") {
    return { isPending: false, isLikelyStillConfirming: false };
  }
  const minutesSincePending = (now.getTime() - Date.parse(payment.created_at)) / 60_000;
  return {
    isPending: true,
    isLikelyStillConfirming: minutesSincePending < PENDING_PAYMENT_GRACE_MINUTES,
  };
}

export const REFUND_POLICY_COPY =
  "Refundable on request before you first open guest capture, minus any processing fees " +
  "already incurred. Once capture is opened, the event charge is non-refundable except in " +
  "exceptional cases handled manually.";
