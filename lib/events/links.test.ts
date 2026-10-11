import { describe, expect, it } from "vitest";
import {
  captureLinkPath,
  captureQrPath,
  galleryLinkPath,
  SLUG_SOURCE,
  slugifyEventName,
  TOKEN_SOURCE,
} from "./links";

const TOKEN = "Ab3_x-9QzP2mL0kT7vYw1c"; // 22 chars, the shape generateLinkToken() mints
const SLUGGED = new RegExp(`^/(e|g)/(${SLUG_SOURCE})/(${TOKEN_SOURCE})$`);

describe("event link slugs", () => {
  it("reads the event name as lowercase ASCII words", () => {
    expect(slugifyEventName("Maria & Jon’s Wedding!")).toBe("maria-and-jons-wedding");
    expect(slugifyEventName("  Café   Reunión 2026 ")).toBe("cafe-reunion-2026");
  });

  it("has no slug for a name without latin letters or digits", () => {
    expect(slugifyEventName("🎉🎉")).toBeNull();
    expect(slugifyEventName("婚礼")).toBeNull();
  });

  it("caps the slug at a word boundary", () => {
    const slug = slugifyEventName("The Annual Company Gathering of Everyone Who Works Here Together")!;
    expect(slug.length).toBeLessThanOrEqual(48);
    expect(slug.endsWith("-")).toBe(false);
    expect("the-annual-company-gathering-of-everyone-who-works-here".startsWith(slug)).toBe(true);
  });

  it("builds links the next.config rewrite matches, keeping the token whole", () => {
    const capture = captureLinkPath({ name: "Maria & Jon", event_token: TOKEN })!;
    const gallery = galleryLinkPath({ name: "Maria & Jon", gallery_token: TOKEN })!;
    expect(capture).toBe(`/e/maria-and-jon/${TOKEN}`);
    expect(gallery).toBe(`/g/maria-and-jon/${TOKEN}`);
    expect(capture).toMatch(SLUGGED);
    expect(gallery).toMatch(SLUGGED);
  });

  it("falls back to the bare token path when there is no slug or an unexpected token", () => {
    expect(captureLinkPath({ name: "🎉", event_token: TOKEN })).toBe(`/e/${TOKEN}`);
    expect(galleryLinkPath({ name: "Party", gallery_token: "legacy-token" })).toBe("/g/legacy-token");
    expect(captureLinkPath({ name: "Party", event_token: null })).toBeNull();
  });

  it("keeps QR codes on the bare token path", () => {
    expect(captureQrPath({ event_token: TOKEN })).toBe(`/e/${TOKEN}`);
  });

  it("never reads a fixed child route of a token page as a slugged link", () => {
    for (const child of ["keepsake", "preview-image"]) {
      expect(`/e/${TOKEN}/${child}`).not.toMatch(SLUGGED);
      expect(`/g/${TOKEN}/${child}`).not.toMatch(SLUGGED);
    }
  });
});
