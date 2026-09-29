import { describe, expect, it } from "vitest";
import { cn } from "./utils";

/**
 * Regression guard for a class of styling bug: an unregistered design token (e.g. the
 * `text-button` font size) is treated by class merging as a conflicting color and silently
 * removes the real color class — which rendered primary buttons with dark text on violet.
 */
describe("cn with FiveFrames design tokens", () => {
  it("keeps a text color alongside a custom font-size token", () => {
    expect(cn("text-ink-inverse", "text-button")).toBe("text-ink-inverse text-button");
    expect(cn("text-brand", "text-label")).toBe("text-brand text-label");
  });

  it("still resolves real conflicts within each custom group", () => {
    expect(cn("text-label", "text-caption")).toBe("text-caption");
    expect(cn("shadow-glow", "shadow-none")).toBe("shadow-none");
    expect(cn("rounded-t-sheet", "rounded-t-none")).toBe("rounded-t-none");
  });
});
