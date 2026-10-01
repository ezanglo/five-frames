import { describe, expect, it, vi } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { PhotoPickerInput } from "./photo-picker-input";

const ROOT = path.resolve(import.meta.dirname, "../..");

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) return sources(full);
    return /\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry) ? [full] : [];
  });
}

/**
 * Guests and demo visitors must be able to take a photo **or** pick one from their library
 * (product.md §9.2, §16; IOS-03, AND-02, VIS-04). `capture` on the input makes Android Chrome
 * open only the camera, so it must never come back. Real-device pickers are still checked by
 * hand; this guards the markup they depend on.
 */
describe("photo picker input", () => {
  it("is a standard image input with no capture attribute", () => {
    const html = renderToStaticMarkup(<PhotoPickerInput ref={null} onFile={() => {}} />);
    expect(html).toMatch(/type="file"/);
    expect(html).toMatch(/accept="image\/\*"/);
    expect(html).not.toMatch(/capture/i);
    expect(html).not.toMatch(/multiple/);
  });

  it("hands the chosen file to the preview flow and resets for the next pick", () => {
    const onFile = vi.fn();
    const element = PhotoPickerInput({ ref: null, onFile });
    const file = new File(["x"], "shot.jpg", { type: "image/jpeg" });
    const target = { files: [file], value: "C:\\fakepath\\shot.jpg" };

    element.props.onChange({ target });
    expect(onFile).toHaveBeenCalledWith(file);
    expect(target.value).toBe("");

    element.props.onChange({ target: { files: [], value: "" } });
    expect(onFile).toHaveBeenCalledTimes(1);
  });

  it("is the only photo input on the guest capture and demo routes", () => {
    for (const dir of ["app/(guest)", "app/(demo)"]) {
      for (const file of sources(path.join(ROOT, dir))) {
        const source = readFileSync(file, "utf-8");
        expect(source, path.relative(ROOT, file)).not.toMatch(/type="file"/);
        expect(source, path.relative(ROOT, file)).not.toMatch(/\bcapture=/);
      }
    }
    for (const file of ["app/(guest)/e/[token]/capture-slots.tsx", "app/(demo)/demo/demo-experience.tsx"]) {
      expect(readFileSync(path.join(ROOT, file), "utf-8")).toMatch(/<PhotoPickerInput\b/);
    }
  });
});
