import { describe, expect, it } from "vitest";
import { hasPendingProviderPayment } from "./pricing";

describe("hasPendingProviderPayment", () => {
  it("is false when there is no payment", () => {
    expect(hasPendingProviderPayment(null)).toBe(false);
    expect(hasPendingProviderPayment(undefined)).toBe(false);
  });

  it("is false for a paid payment", () => {
    expect(hasPendingProviderPayment({ provider_status: "paid" })).toBe(false);
  });

  it("is true for a pending payment", () => {
    expect(hasPendingProviderPayment({ provider_status: "pending" })).toBe(true);
  });
});
