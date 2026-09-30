import { describe, expect, it } from "vitest";
import {
  FULL_SET_STYLES,
  PRESELECTED_FULL_SET_STYLE,
  PRESELECTED_SINGLE_STYLE,
  SINGLE_STYLES,
} from "./styles";

describe("keepsake style registry", () => {
  it("has exactly five styles in each family, in the accepted order", () => {
    expect(SINGLE_STYLES.map((s) => s.id)).toEqual(["print", "booth", "poster", "journal", "album"]);
    expect(FULL_SET_STYLES.map((s) => s.id)).toEqual(["signature", "strip", "grid", "spotlight", "prints"]);
  });

  it("uses ids unique across both families, each tagged with its own family", () => {
    const ids = [...SINGLE_STYLES, ...FULL_SET_STYLES].map((s) => s.id);
    expect(new Set(ids).size).toBe(10);
    expect(SINGLE_STYLES.every((s) => s.family === "single")).toBe(true);
    expect(FULL_SET_STYLES.every((s) => s.family === "fullSet")).toBe(true);
  });

  it("preselects Print and Signature, one per family", () => {
    expect(SINGLE_STYLES.some((s) => s.id === PRESELECTED_SINGLE_STYLE)).toBe(true);
    expect(FULL_SET_STYLES.some((s) => s.id === PRESELECTED_FULL_SET_STYLE)).toBe(true);
  });

  it("never names a style a frame", () => {
    for (const style of [...SINGLE_STYLES, ...FULL_SET_STYLES]) {
      expect(`${style.label} ${style.line}`).not.toMatch(/\bframes?\b/i);
    }
  });
});
