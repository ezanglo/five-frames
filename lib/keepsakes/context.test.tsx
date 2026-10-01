import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { EventRow } from "@/lib/db/types";
import { deriveAccentRoles } from "@/lib/theme/accents";
import {
  buildFullSetKeepsakeInput,
  buildKeepsakeContext,
  buildSingleKeepsakeInput,
  keepsakeDate,
} from "./context";
import { FullSetKeepsake } from "./templates/full-set";
import { SingleKeepsake } from "./templates/single";
import { FULL_SET_STYLES, SINGLE_STYLES } from "./styles";

/** A full event row whose every private field carries a recognizable marker. */
const EVENT: EventRow = {
  id: "11111111-1111-1111-1111-111111111111",
  host_id: "HOSTID-SECRET",
  name: "Dani’s 40th",
  event_date: "2026-10-18",
  timezone: "Asia/Manila",
  host_message: "WELCOME-MESSAGE-SECRET",
  reveal_mode: "after_event",
  reveal_at: null,
  visibility: "only_me",
  gallery_layout: "masonry",
  sharing_enabled: true,
  hashtag: "DaniTurns40",
  accent_color: "marigold",
  theme_image_path: "11111111-1111-1111-1111-111111111111/THEME-PATH-SECRET.jpg",
  event_token: "EVENTTOKEN-SECRET",
  gallery_token: "GALLERYTOKEN-SECRET",
  activated_at: "2026-10-01T00:00:00Z",
  activating_payment_id: "PAYMENT-SECRET",
  capture_opened_at: null,
  capture_closed_at: null,
  safety_net_closes_at: null,
  hosted_until: null,
  grace_until: null,
  media_deleted_at: null,
  guest_session_cap: 250,
  guest_session_count: 187,
  created_at: "2026-09-01T00:00:00Z",
  updated_at: "2026-09-01T00:00:00Z",
};

/** Numbers only make sense to look for in data, not in markup full of SVG coordinates. */
const FORBIDDEN_COUNTS = ['"187"', ":187", ":250", '"250"'];
const FORBIDDEN = [
  "SECRET",
  "Asia/Manila",
  "only_me",
  "/e/",
  "/g/",
  "http",
  "Mia Reyes", // a guest display name never reaches the builder; checked in the output too
];

describe("keepsake context (closed render input)", () => {
  const context = buildKeepsakeContext(EVENT, { src: "data:image/jpeg;base64,AAAA" });

  it("has exactly the allowed keys", () => {
    expect(Object.keys(context).sort()).toEqual(["event", "theme"]);
    expect(Object.keys(context.event).sort()).toEqual(["date", "hashtag", "name"]);
    expect(Object.keys(context.theme).sort()).toEqual(["accent", "image"]);
    expect(Object.keys(context.theme.image!)).toEqual(["src"]);
  });

  it("copies nothing else from the event row: no tokens, welcome message, counts, timezone, host, payment", () => {
    const json = JSON.stringify(context);
    for (const marker of [...FORBIDDEN, ...FORBIDDEN_COUNTS]) expect(json).not.toContain(marker);
    expect(context.event).toEqual({
      name: "Dani’s 40th",
      date: { label: "Sun, 18 Oct 2026", stamp: "18.10.2026", day: "18", monthYear: "October 2026", weekday: "Sunday" },
      hashtag: "DaniTurns40",
    });
    expect(context.theme.accent).toEqual(deriveAccentRoles("marigold"));
  });

  it("Single-photo input adds only style, photo pixels/dimensions and the capture's own message", () => {
    const input = buildSingleKeepsakeInput(
      context,
      "print",
      { src: "data:x", width: 3, height: 4, capturedBy: "Mia Reyes", id: "c1" } as never,
      "  Best. Cake. Ever. ",
    );
    expect(Object.keys(input).sort()).toEqual(["event", "message", "photo", "style", "theme"]);
    expect(Object.keys(input.photo).sort()).toEqual(["height", "src", "width"]);
    expect(input.message).toBe("Best. Cake. Ever.");
    expect(buildSingleKeepsakeInput(context, "print", { src: "x", width: 1, height: 1 }, "   ").message).toBeNull();
  });

  it("every Single-photo template's output carries no private data, link or QR", () => {
    for (const { id } of SINGLE_STYLES) {
      for (const target of ["export", "preview"] as const) {
        const html = renderToStaticMarkup(
          <SingleKeepsake input={buildSingleKeepsakeInput(context, id, { src: "data:x", width: 3, height: 4 }, "hi")} target={target} />,
        );
        for (const marker of FORBIDDEN) expect(html).not.toContain(marker);
        expect(html).toContain("Dani’s 40th");
        expect(html).toContain('aria-label="FiveFrames"');
      }
    }
  });
});

describe("Full Set input (closed, photography-first)", () => {
  const context = buildKeepsakeContext(EVENT, null);
  const five = [0, 1, 2, 3, 4].map((i) => ({ src: `data:${i}`, message: "Mia Reyes says hi", committedAt: "PER-PHOTO-TIMESTAMP", id: `c${i}` }));

  it("has exactly the allowed keys — no message field at all — and pixel-only photos", () => {
    const input = buildFullSetKeepsakeInput(context, "signature", five as never);
    expect(Object.keys(input).sort()).toEqual(["event", "photos", "style", "theme"]);
    expect("message" in input).toBe(false);
    expect(input.photos).toHaveLength(5);
    for (const photo of input.photos) expect(Object.keys(photo)).toEqual(["src"]);
    expect(JSON.stringify(input)).not.toContain("Mia Reyes");
    expect(JSON.stringify(input)).not.toContain("PER-PHOTO-TIMESTAMP");
    expect(JSON.stringify(input)).not.toMatch(/"c[0-4]"/);
  });

  it("refuses anything but exactly five photos: no partial, padded or six-photo Full Set", () => {
    for (const n of [0, 1, 4, 6]) {
      expect(() => buildFullSetKeepsakeInput(context, "grid", five.slice(0, Math.min(n, 5)).concat(n === 6 ? [five[0]] : []))).toThrow();
    }
  });

  it("every Full Set template's output carries no private data, link, QR or message", () => {
    for (const { id } of FULL_SET_STYLES) {
      for (const target of ["export", "preview"] as const) {
        const input = buildFullSetKeepsakeInput(buildKeepsakeContext(EVENT, { src: "data:theme" }), id, five);
        const html = renderToStaticMarkup(<FullSetKeepsake input={input} target={target} />);
        for (const marker of FORBIDDEN) expect(html).not.toContain(marker);
        expect(html).not.toContain("says hi");
        expect(html).toContain("Dani’s 40th");
        expect(html).toContain('aria-label="FiveFrames"');
        // Exactly the five photos (+ at most the one theme image) are drawn.
        expect(html.match(/src="data:[0-4]"/g)).toHaveLength(5);
        expect((html.match(/src="data:theme"/g) ?? []).length).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe("keepsake dates", () => {
  it("formats a calendar date the same way everywhere, with no timezone shift", () => {
    expect(keepsakeDate("2026-05-29")).toEqual({
      label: "Fri, 29 May 2026",
      stamp: "29.05.2026",
      day: "29",
      monthYear: "May 2026",
      weekday: "Friday",
    });
    expect(keepsakeDate("2027-01-01")?.label).toBe("Fri, 1 Jan 2027");
  });

  it("collapses a missing or malformed date", () => {
    expect(keepsakeDate(null)).toBeNull();
    expect(keepsakeDate("2026-02-30")).toBeNull();
    expect(keepsakeDate("not a date")).toBeNull();
  });

  it("drops an empty hashtag and never shows a leading #", () => {
    expect(buildKeepsakeContext({ ...EVENT, hashtag: "" }, null).event.hashtag).toBeNull();
    expect(buildKeepsakeContext({ ...EVENT, hashtag: "#Tag" }, null).event.hashtag).toBe("Tag");
    expect(buildKeepsakeContext({ ...EVENT, accent_color: "nope" }, null).theme.accent).toEqual(deriveAccentRoles("violet"));
  });
});
