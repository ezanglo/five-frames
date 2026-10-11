import { describe, expect, it } from "vitest";
import { eventPlanFeatures, PLANS } from "@/lib/plans/registry";
import {
  isSignageFormatAllowed,
  SIGNAGE_FORMATS,
  signageFormatsFor,
} from "@/lib/media/signage-formats";
import {
  FULL_SET_STYLES,
  isStyleAllowed,
  PRESELECTED_FULL_SET_STYLE,
  PRESELECTED_SINGLE_STYLE,
  SINGLE_STYLES,
  stylesForPlan,
} from "@/lib/keepsakes/styles";

/**
 * Free's lighter event (product.md §15.3.1, Invariant 15). These helpers are what the signage
 * routes and the keepsake routes gate on, so they are the server-side rule, not just the UI's.
 */
describe("plan entitlements", () => {
  const free = PLANS.free.features;
  const paid = PLANS.intimate.features;

  it("reads features from the event's plan, and previews a plan-less draft as paid", () => {
    expect(eventPlanFeatures({ plan: "free" })).toEqual(free);
    expect(eventPlanFeatures({ plan: "celebration" })).toEqual(PLANS.celebration.features);
    expect(eventPlanFeatures({ plan: null })).toEqual(paid);
  });

  it("gives a Free event the phone-screen format only (criterion 82)", () => {
    expect(signageFormatsFor(free).map((f) => f.id)).toEqual(["digital"]);
    for (const format of SIGNAGE_FORMATS) {
      expect(isSignageFormatAllowed(format, free)).toBe(format === "digital");
    }
  });

  it("gives Standard and Premium every signage format, table-number cards included (criterion 78)", () => {
    for (const features of [PLANS.intimate.features, PLANS.celebration.features]) {
      expect(signageFormatsFor(features).map((f) => f.id)).toEqual([...SIGNAGE_FORMATS]);
      for (const format of SIGNAGE_FORMATS) expect(isSignageFormatAllowed(format, features)).toBe(true);
    }
    expect(isSignageFormatAllowed("table-number", free)).toBe(false);
  });

  it("gates table-number cards on their own feature, not on print signage alone", () => {
    const printOnly = { ...paid, tableNumberCards: false };
    expect(isSignageFormatAllowed("table-number", printOnly)).toBe(false);
    expect(isSignageFormatAllowed("poster", printOnly)).toBe(true);
    // A feature flag can't hand a Free-like event table cards without print signage.
    expect(isSignageFormatAllowed("table-number", { ...free, tableNumberCards: true })).toBe(false);
  });

  it("gives a Free event only each family's preselected keepsake style (criterion 84)", () => {
    expect(stylesForPlan("single", free).map((s) => s.id)).toEqual([PRESELECTED_SINGLE_STYLE]);
    expect(stylesForPlan("fullSet", free).map((s) => s.id)).toEqual([PRESELECTED_FULL_SET_STYLE]);
    for (const style of [...SINGLE_STYLES, ...FULL_SET_STYLES]) {
      const preselected = style.id === PRESELECTED_SINGLE_STYLE || style.id === PRESELECTED_FULL_SET_STYLE;
      expect(isStyleAllowed(style.id, free)).toBe(preselected);
    }
  });

  it("gives paid events all five styles in each family, never one list of ten", () => {
    expect(stylesForPlan("single", paid)).toEqual(SINGLE_STYLES);
    expect(stylesForPlan("fullSet", paid)).toEqual(FULL_SET_STYLES);
    for (const style of [...SINGLE_STYLES, ...FULL_SET_STYLES]) {
      expect(isStyleAllowed(style.id, paid)).toBe(true);
    }
  });
});
