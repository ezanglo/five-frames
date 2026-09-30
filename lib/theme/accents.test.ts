import { describe, expect, it } from "vitest";
import {
  ACCENTS,
  accentCssVars,
  accentFor,
  DEFAULT_ACCENT,
  deriveAccentRoles,
  isAccentKey,
} from "./accents";
import { contrastRatio, WCAG_AA_TEXT } from "./contrast";

const WHITE = "#FFFFFF";
/** Night surface behind guest headers (--color-surface-dark). */
const NIGHT = "#141414";

/**
 * The contrast safeguard (product.md §10.1, architecture §7a, criterion 41). Every combination
 * the themed guest screens use must clear WCAG AA for every curated color. A palette edit that
 * breaks one fails here instead of shipping illegible text.
 */
describe("curated event colors", () => {
  it("has exactly the seven accepted keys, violet first and default", () => {
    expect(ACCENTS.map((a) => a.key)).toEqual([
      "violet",
      "coral",
      "rose",
      "marigold",
      "teal",
      "ocean",
      "midnight",
    ]);
    expect(DEFAULT_ACCENT).toBe("violet");
  });

  it("gives every key a human label that is not the raw key", () => {
    for (const accent of ACCENTS) {
      expect(accent.label).toMatch(/^[A-Z][a-z]+$/);
    }
  });

  describe.each(ACCENTS.map((a) => [a.key, a.roles] as const))("%s", (_key, roles) => {
    it("fill text on fill", () => {
      expect(contrastRatio(roles.fillText, roles.fill)).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
    });
    it("ink on white", () => {
      expect(contrastRatio(roles.ink, WHITE)).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
    });
    it("ink on tint", () => {
      expect(contrastRatio(roles.ink, roles.tint)).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
    });
    it("on-dark highlight on night", () => {
      expect(contrastRatio(roles.onDark, NIGHT)).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
    });
  });

  it("never uses raw marigold as text: its ink is darkened and its button text is ink", () => {
    const marigold = deriveAccentRoles("marigold");
    expect(contrastRatio(marigold.base, WHITE)).toBeLessThan(WCAG_AA_TEXT);
    expect(marigold.ink).not.toBe(marigold.base);
    expect(marigold.fillText).not.toBe(WHITE);
  });

  it("renders an unknown or missing key as violet instead of failing", () => {
    expect(accentFor("chartreuse").key).toBe("violet");
    expect(accentFor(null).key).toBe("violet");
    expect(deriveAccentRoles("")).toEqual(deriveAccentRoles("violet"));
    expect(isAccentKey("chartreuse")).toBe(false);
    expect(isAccentKey("teal")).toBe(true);
  });

  it("emits only registry colors as scoped CSS variables", () => {
    const vars = accentCssVars("teal");
    expect(Object.keys(vars).sort()).toEqual([
      "--brand-base",
      "--brand-foreground",
      "--brand-highlight",
      "--brand-ink",
      "--brand-primary",
      "--brand-tint",
    ]);
    for (const value of Object.values(vars)) expect(value).toMatch(/^#[0-9A-F]{6}$/);
    // A hostile stored value can never reach CSS: it resolves to violet's registry colors.
    expect(accentCssVars("red;}body{display:none")).toEqual(accentCssVars("violet"));
  });
});
