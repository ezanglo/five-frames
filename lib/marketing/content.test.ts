import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { EVENT_PRICE_PHP, REFUND_POLICY_COPY } from "@/lib/payments/pricing";
import {
  DEFAULT_GUEST_SESSION_CAP,
  FAQ_GROUPS,
  HOME_FAQ_IDS,
  PRICE_LABEL,
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
  it("shows the one real event price", () => {
    expect(PRICE_LABEL).toBe(`₱${EVENT_PRICE_PHP.toLocaleString("en-PH")}`);
  });

  it("uses the refund copy shown at checkout, verbatim", () => {
    expect(REFUND_SUMMARY).toBe(REFUND_POLICY_COPY);
  });

  it("states the same guest-session capacity as the database default", () => {
    const migration = readFileSync(
      path.join(ROOT, "supabase/migrations/20260922000000_event_join_capacity.sql"),
      "utf8",
    );
    const match = migration.match(/guest_session_cap int not null default (\d+)/);
    expect(match?.[1]).toBe(String(DEFAULT_GUEST_SESSION_CAP));
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
    [/renew/i, "renewal isn't built — don't sell it"],
    [/\bzip\b/i, "bulk download is not a ZIP (D11)"],
    [/real[- ]?time/i, "counts are polled, not realtime (D9)"],
    [/\bvideo\b/i, "there is no video feature"],
  ];

  it.each(FORBIDDEN)("contains no %s", (pattern, reason) => {
    const found = text.match(pattern);
    expect(found?.[0], reason).toBeUndefined();
  });
});
