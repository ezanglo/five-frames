import { describe, expect, it } from "vitest";
import {
  FULL_SET_STYLES,
  PRESELECTED_FULL_SET_STYLE,
  PRESELECTED_SINGLE_STYLE,
  SINGLE_STYLES,
  isFullSetStyleId,
  isSingleStyleId,
  preselectedStyle,
  stylesForFamily,
} from "./styles";

describe("keepsake style registry", () => {
  it("has exactly five styles in each family, in the accepted order", () => {
    expect(SINGLE_STYLES.map((s) => s.id)).toEqual(["print", "booth", "poster", "journal", "album"]);
    expect(FULL_SET_STYLES.map((s) => s.id)).toEqual(["signature", "strip", "grid", "spotlight", "prints"]);
    expect(stylesForFamily("single")).toHaveLength(5);
    expect(stylesForFamily("fullSet")).toHaveLength(5);
  });

  it("uses ids unique across both families, each tagged with its own family", () => {
    const ids = [...SINGLE_STYLES, ...FULL_SET_STYLES].map((s) => s.id);
    expect(new Set(ids).size).toBe(10);
    expect(SINGLE_STYLES.every((s) => s.family === "single")).toBe(true);
    expect(FULL_SET_STYLES.every((s) => s.family === "fullSet")).toBe(true);
  });

  it("preselects Print and Signature, one per family", () => {
    expect(PRESELECTED_SINGLE_STYLE).toBe("print");
    expect(PRESELECTED_FULL_SET_STYLE).toBe("signature");
    expect(preselectedStyle("single")).toBe("print");
    expect(preselectedStyle("fullSet")).toBe("signature");
  });

  it("refuses a style id from the other family, or an unknown one (route validation)", () => {
    for (const s of SINGLE_STYLES) {
      expect(isSingleStyleId(s.id)).toBe(true);
      expect(isFullSetStyleId(s.id)).toBe(false);
    }
    for (const s of FULL_SET_STYLES) {
      expect(isFullSetStyleId(s.id)).toBe(true);
      expect(isSingleStyleId(s.id)).toBe(false);
    }
    for (const bad of ["", "Print", "share", "../print", "print ", null, 3]) {
      expect(isSingleStyleId(bad)).toBe(false);
      expect(isFullSetStyleId(bad)).toBe(false);
    }
  });

  it("never names a style a frame", () => {
    for (const style of [...SINGLE_STYLES, ...FULL_SET_STYLES]) {
      expect(`${style.label} ${style.line}`).not.toMatch(/\bframes?\b/i);
    }
  });
});
