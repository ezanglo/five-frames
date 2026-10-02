/**
 * How hosts pay for an event (product.md §7.2, decision D23). No secrets here, so this has no
 * `server-only` import — host pages, marketing copy and the server action all read it.
 *
 * - `manual`: sales-led launch. FiveFrames arranges each sale in conversation, the host pays
 *   FiveFrames directly, and an operator confirms receipt in the Operator Console. There is no
 *   "Pay online" button and the PayMongo checkout action refuses.
 * - `online`: self-service PayMongo checkout is the primary path, with manual payment kept as
 *   the FiveFrames-arranged exception (the original §7.2 shape).
 *
 * A checked-in constant rather than an env var, like the event price (lib/payments/pricing.ts):
 * switching changes host screens and public copy together, so it ships as one reviewed change
 * and every environment agrees. Turning `online` on also needs live PayMongo keys, KYC and the
 * webhook (release-validation.md ENV-03).
 */
export type PaymentMode = "manual" | "online";

export const PAYMENT_MODE = "manual" as PaymentMode;

export function isOnlinePaymentEnabled(mode: PaymentMode = PAYMENT_MODE): boolean {
  return mode === "online";
}

/**
 * Where a host reaches FiveFrames about buying an event (`mailto:`, `https://m.me/…`, `tel:`),
 * or null when none is published yet. In `manual` mode, copy that would link here reads fine
 * without it: the sale already happened in conversation.
 */
export const SALES_CONTACT: { label: string; href: string } | null = null;
