import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { REFUND_POLICY_COPY } from "@/lib/payments/pricing";
import { PAID_PLANS, PLANS } from "@/lib/plans/registry";
import {
  FAQ_GROUPS,
  HOME_FAQ_IDS,
  HOSTED_ACCESS_LABEL,
  MARKETING_PLANS,
  PAYMENT_COPY_BY_MODE,
  PLAN_COMPARISON,
  planFeatures,
  PRICE_FROM_LABEL,
  PRICES_LABEL,
  PRICING_FAQ_IDS,
  REFUND_SUMMARY,
  TESTIMONIALS,
  faqItemsById,
} from "./content";

/**
 * The public marketing site states product facts. These tests keep it from drifting away from
 * what the product actually does, and keep a known class of dishonest or off-brand copy out of
 * it (docs/design-direction.md → "Marketing site", product.md §4 and §15).
 */

const ROOT = path.resolve(import.meta.dirname, "../..");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(entry) && !entry.endsWith(".test.ts") ? [full] : [];
  });
}

describe("marketing facts come from the product", () => {
  it("offers every plan, straight from the registry the Share step uses (D24)", () => {
    expect(MARKETING_PLANS).toEqual([PLANS.free, ...PAID_PLANS]);
    expect(PRICES_LABEL).toBe("₱499 or ₱999");
    expect(PRICE_FROM_LABEL).toBe("₱499");
    expect(HOSTED_ACCESS_LABEL).toBe("up to 12 months");
  });

  it("builds each plan card on the one before it (D24)", () => {
    const [free, intimate, celebration] = MARKETING_PLANS.map(planFeatures);
    expect(free).toMatchObject({ heading: "Includes", additions: false });
    expect(intimate.heading).toBe("Everything in Free, plus");
    expect(intimate.lines.map((l) => l.text)).toEqual([
      "Up to 100 guests",
      "Up to 500 photos",
      "Hosted for 6 months",
      "Download all as ZIP files",
      "Printable QR cards and posters",
      "Your own photo and hashtag",
      "All keepsake styles",
      "Live guest and photo counts",
    ]);
    expect(celebration.heading).toBe("Everything in Intimate, plus");
    expect(celebration.lines).toEqual([
      { text: "Up to 300 guests" },
      { text: "Up to 1,500 photos" },
      { text: "Hosted for 12 months" },
      { text: "We set it up with you" },
      { text: "Signage prepared with you" },
      { text: "Direct help on the day" },
      { text: "Numbered table cards" },
      { text: "Save to Google Drive", soon: true },
      { text: "Add a co-host", soon: true },
    ]);
    // Only what isn't built yet is marked soon, and nothing else is.
    expect(intimate.lines.some((l) => l.soon)).toBe(false);
  });

  it("never claims Free can do what product.md §15.3.1 leaves out", () => {
    const free = planFeatures(PLANS.free).lines.map((l) => l.text).join(" ");
    expect(free).not.toMatch(/printable|table card|poster|theme photo|hashtag|counts|download/i);
  });

  it("compares plans only on what really differs (product.md §15.3)", () => {
    // Every plan runs the same event. A row may differ between plans only if product.md says
    // that thing differs; anything else would invent a plan-gated feature.
    const MAY_DIFFER = new Set([
      "Price",
      "Which events",
      "Guests",
      "Hosted for",
      // Free's lighter event (product.md §15.3.1), from the registry's `features`:
      "Live guest and photo counts",
      "Your own photo and hashtag",
      "Printable QR cards and posters",
      "Keepsakes of one photo",
      "Keepsakes of all five photos",
      // Celebration's extras, built and coming soon:
      "Numbered table cards",
      "Save to Google Drive",
      "We set it up with you",
      "Direct help on the day",
      "Add a co-host",
    ]);
    for (const row of PLAN_COMPARISON.flatMap((group) => group.rows)) {
      const values = MARKETING_PLANS.map((plan) => row.value(plan));
      if (new Set(values).size > 1) expect(MAY_DIFFER, row.label).toContain(row.label);
      else expect(values[0], row.label).toBe(true);
    }
  });

  it("uses the refund copy shown at checkout, verbatim", () => {
    expect(REFUND_SUMMARY).toBe(REFUND_POLICY_COPY);
  });

  it("states guest capacity only from the plan registry", () => {
    // Capacity is per plan and stamped at activation (D24). A literal number of guests in copy
    // would drift from it, so copy must interpolate `guestSessionCap` instead.
    const files = [
      ...sourceFiles(path.join(ROOT, "app/(marketing)")),
      ...sourceFiles(path.join(ROOT, "components/ff/marketing")),
      path.join(ROOT, "lib/marketing/content.ts"),
    ];
    for (const file of files) {
      expect(readFileSync(file, "utf8"), file).not.toMatch(/\b\d+ guest(s| sessions)\b/i);
    }
  });

  it("never promises online checkout while hosts pay FiveFrames directly (D23)", () => {
    const { payStep, ...lines } = PAYMENT_COPY_BY_MODE.manual;
    const manual = [...Object.values(lines), payStep.title, payStep.body].join(" ");
    expect(manual).not.toMatch(/paymongo|online|\bcard\b|processing fee/i);
    // Every page reads payment copy from PAYMENT_COPY, so no page can contradict the mode.
    const pages = [
      "app/(marketing)/page.tsx",
      "app/(marketing)/pricing/page.tsx",
      "app/(marketing)/how-it-works/page.tsx",
      "components/ff/marketing/blocks.tsx",
      "components/ff/marketing/site-chrome.tsx",
    ];
    for (const page of pages) {
      expect(readFileSync(path.join(ROOT, page), "utf8")).not.toMatch(/PayMongo|Pay online/);
    }
  });

  it("names only the payment methods checkout actually offers", () => {
    const client = readFileSync(path.join(ROOT, "lib/payments/paymongo-client.ts"), "utf8");
    expect(client).toContain(`payment_method_types: ["gcash", "paymaya", "card"]`);
  });

  it("resolves every previewed FAQ id", () => {
    expect(faqItemsById(HOME_FAQ_IDS)).toHaveLength(HOME_FAQ_IDS.length);
    expect(faqItemsById(PRICING_FAQ_IDS)).toHaveLength(PRICING_FAQ_IDS.length);
    const ids = FAQ_GROUPS.flatMap((group) => group.items.map((item) => item.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("never reuses a homepage element id for a previewed FAQ answer", () => {
    // FAQ answers render with their id as the element id, so a homepage section with the same
    // id would make two targets for one anchor (and break in-page links to either).
    const home = readFileSync(path.join(ROOT, "app/(marketing)/page.tsx"), "utf8");
    const pageIds = [...home.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
    expect(pageIds.length).toBeGreaterThan(0);
    for (const id of HOME_FAQ_IDS) expect(pageIds).not.toContain(id);
  });

  it("ships no testimonial without a recorded permission", () => {
    for (const testimonial of TESTIMONIALS) {
      expect(testimonial.quote.trim()).not.toBe("");
      expect(testimonial.attribution.trim()).not.toBe("");
      expect(testimonial.permissionReference.trim()).not.toBe("");
    }
  });
});

describe("marketing copy stays honest and on-brand", () => {
  const files = [
    ...sourceFiles(path.join(ROOT, "app/(marketing)")),
    ...sourceFiles(path.join(ROOT, "components/ff/marketing")),
    path.join(ROOT, "lib/marketing/content.ts"),
  ];
  const text = files.map((file) => readFileSync(file, "utf8")).join("\n");

  const FORBIDDEN: [RegExp, string][] = [
    [/revolutionary|game[- ]chang/i, "startup hype"],
    [/\bengagement\b|\bmaximi[sz]e/i, "engagement language (product.md §4)"],
    [/capture every moment/i, "contradicts the five-frame idea"],
    [/you still have|don’t miss out|don't miss out|hurry|limited[- ]time|only \d+ left/i, "pressure or urgency"],
    [/per person/i, "frames are per browser session, never per person"],
    [/bank[- ]level|military[- ]grade|100% (private|secure)/i, "unsupported security claims"],
    [/★|\bstars?\b rating|\d[\d,]* (happy )?(hosts|customers|events) (trust|use|love)/i, "fabricated social proof"],
    [/(regular|normally|was) ₱|<s>|line-through/i, "fake anchor price"],
    [/renew/i, "every plan is one-time; there are no renewals (D24)"],
    // Ships after launch: it may appear only as "coming soon", on the same line (product.md §11.2.1).
    [/google drive(?![^\n]*soon)/i, "Google Drive may only be offered as coming soon (D24)"],
    [/co-?host(?![^\n]*soon)/i, "co-host access ships after launch; only as coming soon (§11.2.2)"],
    [/one price|no tiers|nothing to compare/i, "there are two plans now (D24)"],
    [/most popular|best value|recommended plan/i, "no upsell framing between plans"],
    [/real[- ]?time/i, "counts are polled, not realtime (D9)"],
    [/\bvideo\b/i, "there is no video feature"],
    [/slide ?show|live (photo )?wall/i, "the gallery is scrolled, never played (D22)"],
    [/customi[sz]able|custom galler|custom layout/i, "a choice of three gallery layouts is not customization (D22)"],
  ];

  it.each(FORBIDDEN)("contains no %s", (pattern, reason) => {
    const found = text.match(pattern);
    expect(found?.[0], reason).toBeUndefined();
  });
});
