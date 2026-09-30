import { describe, expect, it } from "vitest";
import { isHeicUpload, precheckThemeImageFile, THEME_IMAGE_REFUSAL_COPY } from "./image";

const MB = 1024 * 1024;
const file = (type: string, name: string, size = 2 * MB) => ({ type, name, size });

describe("precheckThemeImageFile", () => {
  it("accepts JPEG, PNG and WebP", () => {
    expect(precheckThemeImageFile(file("image/jpeg", "party.jpg"))).toEqual({ ok: true });
    expect(precheckThemeImageFile(file("image/png", "logo.png"))).toEqual({ ok: true });
    expect(precheckThemeImageFile(file("image/webp", "art.webp"))).toEqual({ ok: true });
  });

  it("refuses raw HEIC and HEIF before anything is uploaded, by type or by name", () => {
    for (const f of [
      file("image/heic", "IMG_0001.HEIC"),
      file("image/heif", "IMG_0001.heif"),
      file("image/heic-sequence", "burst.heic"),
      file("", "IMG_0001.HEIC"),
      file("", "photo.heif"),
    ]) {
      expect(precheckThemeImageFile(f)).toEqual({ ok: false, reason: "heic" });
    }
  });

  it("says HEIC even when the file is also too big, since resizing wouldn't help", () => {
    expect(precheckThemeImageFile(file("image/heic", "big.heic", 20 * MB))).toEqual({ ok: false, reason: "heic" });
  });

  it("treats a browser-converted photo as the JPEG it now is, whatever its name", () => {
    expect(precheckThemeImageFile(file("image/jpeg", "IMG_0001.HEIC"))).toEqual({ ok: true });
    expect(isHeicUpload(file("image/jpeg", "IMG_0001.HEIC"))).toBe(false);
  });

  it("refuses other formats and oversized files", () => {
    expect(precheckThemeImageFile(file("image/gif", "a.gif"))).toEqual({ ok: false, reason: "unsupported" });
    expect(precheckThemeImageFile(file("image/svg+xml", "a.svg"))).toEqual({ ok: false, reason: "unsupported" });
    expect(precheckThemeImageFile(file("", "notes.txt"))).toEqual({ ok: false, reason: "unsupported" });
    expect(precheckThemeImageFile(file("image/jpeg", "a.jpg", 15 * MB + 1))).toEqual({
      ok: false,
      reason: "too_large",
    });
  });
});

describe("refusal copy", () => {
  it("never suggests HEIC and always says the current image is unchanged", () => {
    for (const copy of Object.values(THEME_IMAGE_REFUSAL_COPY)) {
      expect(copy).toMatch(/Your current image is unchanged\.$/);
    }
    for (const [reason, copy] of Object.entries(THEME_IMAGE_REFUSAL_COPY)) {
      if (reason !== "heic") expect(copy).not.toMatch(/HEIC|HEIF/);
    }
    expect(THEME_IMAGE_REFUSAL_COPY.heic).toMatch(/JPG, PNG or WebP/);
  });
});
