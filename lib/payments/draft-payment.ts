import { hasPendingProviderPayment } from "@/lib/payments/pricing";

/**
 * What an unpaid event's host screens may say about payment (HOST-05). Only the verified PayMongo
 * webhook (or an operator's manual confirmation) establishes that a payment happened, and that
 * activates the event, so nothing shown before activation may say a payment was received.
 *
 * - `none`: no checkout started.
 * - `checkout_unfinished`: a checkout session exists (`provider_status = 'pending'`) but nothing
 *   is confirmed. This is also what an abandoned or cancelled checkout looks like: PayMongo
 *   reports neither, so the row stays pending and is reused on the next "Pay online".
 * - `confirming`: the host just came back through PayMongo's success redirect. Still unverified
 *   (anyone can open that URL), so the copy says it is being checked, not that it arrived.
 */
export type DraftPaymentState = "none" | "checkout_unfinished" | "confirming";

export function deriveDraftPaymentState(input: {
  /** The `checkout` search param: `pending` after PayMongo's success redirect. */
  checkoutParam: string | undefined;
  latestPayment: { provider_status: string | null } | null | undefined;
}): DraftPaymentState {
  if (input.checkoutParam === "pending") return "confirming";
  if (hasPendingProviderPayment(input.latestPayment)) return "checkout_unfinished";
  return "none";
}

type DraftPaymentCopy = {
  /** Dashboard notice above the cards, if any. */
  notice: string | null;
  cardTitle: string;
  cardBody: string;
  cardAction: string;
  /** Share step (checkout) status line, if any. */
  checkoutStatus: string | null;
};

export const DRAFT_PAYMENT_COPY: Record<DraftPaymentState, DraftPaymentCopy> = {
  none: {
    notice: null,
    cardTitle: "Finish setting up",
    cardBody:
      "Activate your event to get its link and QR code. Capture stays closed until you open it.",
    cardAction: "Continue setup",
    checkoutStatus: null,
  },
  checkout_unfinished: {
    notice: null,
    cardTitle: "Payment not finished",
    cardBody:
      "A checkout was started, but no payment has been confirmed. Your link and QR code appear once PayMongo confirms one.",
    cardAction: "Continue to payment",
    checkoutStatus:
      "A checkout was started but not finished. Continuing returns you to that same checkout — it won’t start a second one or charge you twice.",
  },
  confirming: {
    notice:
      "Checking your payment with PayMongo. This page updates automatically once it’s confirmed and your event is activated; capture still stays closed until you open it.",
    cardTitle: "Confirming payment",
    cardBody: "Your link and QR code appear as soon as PayMongo confirms the payment.",
    cardAction: "View payment status",
    checkoutStatus: null,
  },
};
