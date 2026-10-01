import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import {
  DEMO_KEEPSAKE_EVENT,
  DEMO_THEME_IMAGE,
  demoFullSetInput,
  demoKeepsakeContext,
  demoSingleInput,
} from "@/lib/demo/keepsakes";
import { FullSetKeepsake } from "@/lib/keepsakes/templates/full-set";
import { SingleKeepsake } from "@/lib/keepsakes/templates/single";
import { FULL_SET_STYLES, SINGLE_STYLES } from "@/lib/keepsakes/styles";
import { FULL_SET_SAMPLES } from "@/lib/keepsakes/samples";
import { isAccentKey } from "@/lib/theme/accents";

/**
 * Demo keepsakes (Slice 18; product.md §7.1, D14). Both families come from the one shared
 * registry and are drawn by the real templates; the fixed sample look can't carry a link, token
 * or QR; and the demo component itself previews only, with no route call and no export.
 */

const DEMO_COMPONENT = readFileSync(
  path.resolve(import.meta.dirname, "../../app/(demo)/demo/demo-keepsakes.tsx"),
  "utf-8",
);

function markupOf(element: React.ReactElement): string {
  return renderToStaticMarkup(element);
}

/** Every URL-ish thing the markup references must be inline data, never a network address. */
function externalRefs(markup: string): string[] {
  return [...markup.matchAll(/(?:src|href)="([^"]*)"/g)]
    .map((m) => m[1])
    .filter((ref) => !ref.startsWith("data:"));
}

describe("demo keepsakes (D14)", () => {
  const context = demoKeepsakeContext();

  it("uses a fixed, curated sample look built by the shared context builder", () => {
    expect(isAccentKey(DEMO_KEEPSAKE_EVENT.accent_color)).toBe(true);
    expect(DEMO_THEME_IMAGE.src.startsWith("data:image/svg+xml,")).toBe(true);
    expect(Object.keys(context).sort()).toEqual(["event", "theme"]);
    expect(Object.keys(context.event).sort()).toEqual(["date", "hashtag", "name"]);
    expect(context.theme.image).toEqual({ src: DEMO_THEME_IMAGE.src });
    // The theme image is never one of the sample "guest" photos.
    expect(FULL_SET_SAMPLES.map((p) => p.src)).not.toContain(DEMO_THEME_IMAGE.src);
  });

  it("renders all five One-photo styles with the real template, with no link, token or QR", () => {
    for (const style of SINGLE_STYLES) {
      const markup = markupOf(<SingleKeepsake input={demoSingleInput(context, style.id, null)} target="preview" />);
      expect(markup).toContain(DEMO_KEEPSAKE_EVENT.name.replace("&", "&amp;"));
      expect(externalRefs(markup)).toEqual([]);
      expect(markup).not.toMatch(/\/e\/|\/g\/|https?:\/\/|token|<canvas/i);
    }
  });

  it("renders all five All-five styles with the real template on the five bundled samples", () => {
    for (const style of FULL_SET_STYLES) {
      const input = demoFullSetInput(context, style.id);
      expect(input.photos).toHaveLength(5);
      expect("message" in input).toBe(false);
      const markup = markupOf(<FullSetKeepsake input={input} target="preview" />);
      expect(externalRefs(markup)).toEqual([]);
      expect(markup).not.toMatch(/\/e\/|\/g\/|https?:\/\/|token/i);
    }
  });

  it("puts the visitor's own in-memory photo only into a One-photo keepsake", () => {
    const own = { photo: { src: "blob:http://localhost/abc", width: 800, height: 600 }, message: "  hi  " };
    const input = demoSingleInput(context, "print", own);
    expect(input.photo).toEqual(own.photo);
    expect(input.message).toBe("hi");
    expect(demoSingleInput(context, "print", { ...own, message: "" }).message).toBeNull();
  });

  it("the demo component shows two families from the registry and never offers share, save or a route", () => {
    expect(DEMO_COMPONENT).toMatch(/from "@\/lib\/keepsakes\/styles"/);
    expect(DEMO_COMPONENT).toMatch(/from "@\/components\/ff\/keepsakes\/keepsake-preview"/);
    expect(DEMO_COMPONENT).toContain("SINGLE_STYLES");
    expect(DEMO_COMPONENT).toContain("FULL_SET_STYLES");
    expect(DEMO_COMPONENT).not.toMatch(/\[\s*\.\.\.SINGLE_STYLES\s*,\s*\.\.\.FULL_SET_STYLES/);
    expect(DEMO_COMPONENT).not.toMatch(/fetch\(|\/keepsake\/|navigator\.share|download=|toBlob|toDataURL|keepsake-picker/);
    expect(DEMO_COMPONENT).toContain("Demo sample");
  });
});
