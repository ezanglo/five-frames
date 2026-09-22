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
 * Whether the event has a still-`pending` provider payment attempt. `startProviderCheckout`
 * (lib/dal/payments.ts) reuses that same attempt's PayMongo Checkout Session rather than
 * creating a second live one, so this is purely informational for the UI ("you already
 * have a payment in progress") — it never signals a double-charge risk, because there
 * isn't one: continuing always resolves to the same session, never a new charge.
 */
export function hasPendingProviderPayment(
  payment: { provider_status: string | null } | null | undefined,
): boolean {
  return payment?.provider_status === "pending";
}

export const REFUND_POLICY_COPY =
  "Refundable on request before you first open guest capture, minus any processing fees " +
  "already incurred. Once capture is opened, the event charge is non-refundable except in " +
  "exceptional cases handled manually.";
