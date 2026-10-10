import { describe, expect, it } from "vitest";
import {
  formatPrice,
  isPaidPlanId,
  isPlanId,
  PAID_PLANS,
  PLAN_IDS,
  PLANS,
  planForPayment,
  priceCentavos,
} from "./registry";

describe("plan registry (product.md §15.3, D24)", () => {
  it("has exactly the three plans, keyed by their own ids", () => {
    expect(PLAN_IDS).toEqual(["free", "intimate", "celebration"]);
    for (const id of PLAN_IDS) expect(PLANS[id].id).toBe(id);
  });

  it("holds the product's prices, capacities and hosted access", () => {
    expect(PLANS.free).toMatchObject({ pricePhp: 0, guestSessionCap: 10, hostedAccessDays: 7 });
    expect(PLANS.intimate).toMatchObject({ pricePhp: 499, guestSessionCap: 100 });
    expect(PLANS.celebration).toMatchObject({ pricePhp: 999, guestSessionCap: 300, hostedAccessDays: 365 });
    expect(PLANS.free.hostedAccessLabel).toBe("7 days");
    expect(PLANS.intimate.hostedAccessLabel).toBe("6 months");
    expect(PLANS.celebration.hostedAccessLabel).toBe("12 months");
  });

  it("makes Free the lighter event and gives paid plans every feature (product.md §15.3.1)", () => {
    expect(Object.values(PLANS.free.features).every((on) => on === false)).toBe(true);
    const { tableNumberCards, ...shared } = PLANS.intimate.features;
    expect(Object.values(shared).every((on) => on === true)).toBe(true);
    expect(PLANS.celebration.features).toEqual({ ...PLANS.intimate.features, tableNumberCards: true });
    expect(tableNumberCards).toBe(false);
  });

  it("only sells paid plans; Free is never a payment", () => {
    expect(PAID_PLANS.map((p) => p.id)).toEqual(["intimate", "celebration"]);
    expect(isPaidPlanId("free")).toBe(false);
    expect(isPaidPlanId("celebration")).toBe(true);
    expect(priceCentavos("intimate")).toBe(49_900);
    expect(priceCentavos("celebration")).toBe(99_900);
  });

  it("rejects anything that isn't a plan id", () => {
    for (const value of [null, undefined, "", "Celebration", "premium", 1]) {
      expect(isPlanId(value)).toBe(false);
      expect(isPaidPlanId(value)).toBe(false);
    }
  });

  it("reads a payment from before plans as the single ₱999 / 12-month product it was", () => {
    expect(planForPayment({ plan: null })).toBe("celebration");
    expect(planForPayment({ plan: "intimate" })).toBe("intimate");
  });

  it("formats prices the way the site and the Share step show them", () => {
    expect(formatPrice(499)).toBe("₱499");
    expect(formatPrice(1490)).toBe("₱1,490");
  });
});
