import { describe, expect, it } from "vitest";
import { DRAFT_PAYMENT_COPY, deriveDraftPaymentState } from "./draft-payment";

/** HOST-05: an unpaid event's screens never say a payment was received. */
describe("draft payment state", () => {
  it("no checkout yet", () => {
    expect(deriveDraftPaymentState({ mode: "online", checkoutParam: undefined, latestPayment: null })).toBe("none");
  });

  it("a started, abandoned or cancelled checkout reads as unfinished, not as paid", () => {
    const pending = { provider_status: "pending" };
    expect(deriveDraftPaymentState({ mode: "online", checkoutParam: undefined, latestPayment: pending })).toBe(
      "checkout_unfinished",
    );
    // PayMongo's cancel redirect lands on the Share step with `checkout=cancelled`.
    expect(deriveDraftPaymentState({ mode: "online", checkoutParam: "cancelled", latestPayment: pending })).toBe(
      "checkout_unfinished",
    );
  });

  it("a superseded attempt is not an unfinished checkout", () => {
    expect(
      deriveDraftPaymentState({
        mode: "online",
        checkoutParam: undefined,
        latestPayment: { provider_status: "superseded" },
      }),
    ).toBe("none");
  });

  it("only PayMongo's success redirect shows the confirming state", () => {
    expect(
      deriveDraftPaymentState({
        mode: "online",
        checkoutParam: "pending",
        latestPayment: { provider_status: "pending" },
      }),
    ).toBe("confirming");
  });

  it("no pre-activation copy claims a payment was received or completed", () => {
    for (const copy of Object.values(DRAFT_PAYMENT_COPY)) {
      for (const text of Object.values(copy)) {
        if (text === null) continue;
        expect(text).not.toMatch(/\b(received|paid|payment (is )?complete)\b/i);
      }
    }
  });

  it("manual payment mode ignores any provider checkout state", () => {
    for (const checkoutParam of [undefined, "pending", "cancelled"]) {
      expect(
        deriveDraftPaymentState({
          mode: "manual",
          checkoutParam,
          latestPayment: { provider_status: "pending" },
        }),
      ).toBe("manual");
    }
    expect(Object.values(DRAFT_PAYMENT_COPY.manual).join(" ")).not.toMatch(/paymongo|online/i);
  });

  it("an unfinished checkout offers to continue it", () => {
    expect(DRAFT_PAYMENT_COPY.checkout_unfinished.cardAction).toBe("Continue to payment");
  });
});
