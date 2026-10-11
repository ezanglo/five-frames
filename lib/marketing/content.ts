import { SHOTS_PER_GUEST } from "@/components/ff/shots";
import { PAYMENT_MODE, type PaymentMode } from "@/lib/payments/mode";
import { REFUND_POLICY_COPY } from "@/lib/payments/pricing";
import { formatPrice, PAID_PLANS, PLANS, type PaidPlanId, type Plan } from "@/lib/plans/registry";

/**
 * Public marketing copy that states product facts. Every number here derives from the constant
 * the product itself uses, so the site cannot drift from what checkout, the lifecycle and the
 * guest flow actually do (see content.test.ts). Claims must stay within docs/product.md — the
 * claim audit in docs/design-direction.md → "Marketing site" lists what is deliberately left out.
 */

/**
 * The plans the public site offers (product.md §15.3, D24), straight from the registry the
 * Share step and checkout use: the Free first event, then the two paid plans.
 *
 * Free activation is Slice 21. The site shows it ahead of that slice at the user's request, so
 * this must not be deployed until Slice 21 has landed (docs/progress.md, Slice 20).
 */
export const MARKETING_PLANS: Plan[] = [PLANS.free, ...PAID_PLANS];

export const FREE_PLAN = PLANS.free;

/** "₱499" — the lowest paid price, for "then from …" lines. */
export const PRICE_FROM_LABEL = formatPrice(Math.min(...PAID_PLANS.map((p) => p.pricePhp)));

/** "₱499 or ₱999". */
export const PRICES_LABEL = PAID_PLANS.map((p) => formatPrice(p.pricePhp)).join(" or ");

export const FRAMES = SHOTS_PER_GUEST;

/** Photos per "Download all" ZIP part (product.md §11.2.3, D25). Slice 26 reads it too. */
export const ZIP_PART_SIZE = 500;

/** "up to 12 months" — the longest hosted access any plan has (product.md §15.2). Copy using it
 *  says "depending on your plan", since Free is 7 days and Standard 6 months. */
export const HOSTED_ACCESS_LABEL = `up to ${
  MARKETING_PLANS.reduce((a, b) => (b.hostedAccessDays > a.hostedAccessDays ? b : a)).hostedAccessLabel
}`;

/** "Free for 7 days, Standard for 6 months and Premium for 12 months". */
export const HOSTED_ACCESS_BY_PLAN = MARKETING_PLANS.map((p) => `${p.label} for ${p.hostedAccessLabel}`)
  .join(", ")
  .replace(/, ([^,]*)$/, " and $1");

/** A plan card line. `soon` marks something a plan will get that isn't built yet. */
export type FeatureLine = { text: string; soon?: boolean };

/** A titled group of lines on a plan card, so each line reads as being for something. */
export type FeatureGroup = { title: string; lines: FeatureLine[] };

/**
 * What every plan does, including Free (product.md §15.3.1). Free's card lists these; paid plans
 * build on them. Only things the product does today. Downloads are on every plan (Invariant 11)
 * but aren't featured on Free's card, at the founder's request; the comparison table still
 * shows them.
 */
const EVERY_PLAN_GROUPS: FeatureGroup[] = [
  {
    title: "For your guests",
    lines: [
      { text: `${FRAMES} photos per guest` },
      { text: "No app or sign-up for guests" },
      { text: "Photo keepsakes for guests" },
    ],
  },
  {
    title: "For you",
    lines: [
      { text: "Share by link or QR" },
      { text: "Your own photo, color and hashtag" },
      { text: "Live guest and photo counts" },
      { text: "Private gallery" },
    ],
  },
];

/**
 * The groups a paid plan's additions fall into, in card order. Each paid card shows only the
 * groups it has lines in, so a plan above another repeats its groups, in the same order.
 */
const PAID_GROUP_TITLES = {
  capacity: "Room for your event",
  look: "Signage and keepsakes",
  hosting: "Running your event",
  help: "Help from us",
} as const;
type PaidGroup = keyof typeof PAID_GROUP_TITLES;

/** Copy and group for each feature a plan adds over Free (registry `features`). */
const FEATURE_LINES: Record<keyof Plan["features"], { group: PaidGroup; text: string }> = {
  printSignage: { group: "look", text: "Printable QR cards and posters" },
  tableNumberCards: { group: "look", text: "Numbered table cards" },
  allKeepsakeStyles: { group: "look", text: "All keepsake styles" },
};

/**
 * Promised to a plan but not built yet, shown only as "coming soon" (product.md §11.2.1,
 * §11.2.2). Each line names "soon" so content.test.ts can tell a promise from a claim.
 */
const COMING_SOON: Partial<Record<Plan["id"], { group: PaidGroup; line: FeatureLine }[]>> = {
  celebration: [
    { group: "hosting", line: { text: "Save to Google Drive", soon: true } },
    { group: "hosting", line: { text: "Add a co-host", soon: true } },
  ],
};

/** What a paid plan adds that isn't a number or a registry feature: help from us. */
function planHelp(plan: Plan): string[] {
  if (plan.id !== "celebration") return [];
  return ["We set it up with you", "Signage prepared with you", "Direct help on the day"];
}

/**
 * The plan card's feature list (D24), in titled groups. Free lists what every plan does. Each
 * paid plan says "Everything in Free, plus" and lists everything it has beyond Free, read from
 * the registry: more guests, longer hosting, the features Free leaves out (product.md §15.3.1),
 * its help from us and what's coming soon. So every "plus" item is a real difference from Free,
 * and a lower paid plan's lines reappear on the plan above it, in the same groups and order.
 */
export function planFeatures(plan: Plan): {
  heading: string;
  groups: FeatureGroup[];
  additions: boolean;
} {
  if (plan.id === "free") {
    return { heading: "Includes", groups: EVERY_PLAN_GROUPS, additions: false };
  }

  const base = FREE_PLAN;
  const lines: Record<PaidGroup, FeatureLine[]> = { capacity: [], look: [], hosting: [], help: [] };
  if (plan.guestSessionCap > base.guestSessionCap) {
    lines.capacity.push({ text: `Up to ${plan.guestSessionCap} guests` });
    // The theoretical most a full event can hold: every guest keeping all their frames.
    lines.capacity.push({ text: `Up to ${(plan.guestSessionCap * FRAMES).toLocaleString("en-PH")} photos` });
  }
  if (plan.hostedAccessDays > base.hostedAccessDays) {
    lines.capacity.push({ text: `Hosted for ${plan.hostedAccessLabel}` });
  }
  for (const key of Object.keys(FEATURE_LINES) as (keyof Plan["features"])[]) {
    if (plan.features[key] && !base.features[key]) {
      lines[FEATURE_LINES[key].group].push({ text: FEATURE_LINES[key].text });
    }
  }
  // Free events can download too (Invariant 11), only for 7 days, and its card doesn't feature
  // downloads (founder's call). Paid plans name the longer download window, a real addition.
  lines.hosting.push({ text: "Download all as ZIP files" });
  for (const { group, line } of COMING_SOON[plan.id] ?? []) lines[group].push(line);
  lines.help.push(...planHelp(plan).map((text) => ({ text })));

  return {
    heading: `Everything in ${base.label}, plus`,
    groups: (Object.keys(PAID_GROUP_TITLES) as PaidGroup[])
      .filter((group) => lines[group].length > 0)
      .map((group) => ({ title: PAID_GROUP_TITLES[group], lines: lines[group] })),
    additions: true,
  };
}

/**
 * The one plan the site badges as the popular choice (founder’s call, 2026-10-11): the ₱499 plan, the
 * one most events fit. A single highlighted plan, never Free, never a crossed-out price.
 */
export const FEATURED_PLAN_ID: PaidPlanId = "intimate";
export const FEATURED_PLAN_BADGE = "Most popular";

/** A comparison cell: included, not included, or a value that differs by plan. */
export type ComparisonValue = boolean | string;
export type ComparisonRow = { label: string; value: (plan: Plan) => ComparisonValue };
export type ComparisonGroup = { title: string; rows: ComparisonRow[] };

const everyPlan = () => true;
const keepsakeStyles = (p: Plan) => (p.features.allKeepsakeStyles ? "5 styles" : "1 style");

/** The full comparison on /pricing. Rows that differ read their values from the registry. */
export const PLAN_COMPARISON: ComparisonGroup[] = [
  {
    title: "Guests and hosting",
    rows: [
      { label: "Price", value: (p) => formatPrice(p.pricePhp) },
      { label: "Which events", value: (p) => (p.id === "free" ? "First only" : "Any") },
      { label: "Guests", value: (p) => `Up to ${p.guestSessionCap}` },
      { label: "Hosted for", value: (p) => p.hostedAccessLabel },
    ],
  },
  {
    title: "On the day",
    rows: [
      { label: `${FRAMES} photos per guest`, value: everyPlan },
      { label: "No app or sign-up for guests", value: everyPlan },
      { label: "You choose when guests can shoot", value: everyPlan },
      { label: "Live guest and photo counts", value: everyPlan },
    ],
  },
  {
    title: "Look and signage",
    rows: [
      { label: "Share by link or QR", value: everyPlan },
      { label: "Your event color", value: everyPlan },
      { label: "Your own photo and hashtag", value: everyPlan },
      { label: "Printable QR cards and posters", value: (p) => p.features.printSignage },
      { label: "Numbered table cards", value: (p) => p.features.tableNumberCards },
    ],
  },
  {
    title: "Keepsakes",
    rows: [
      { label: "Keepsakes of one photo", value: keepsakeStyles },
      { label: "Keepsakes of all five photos", value: keepsakeStyles },
      { label: "Turn sharing on or off", value: everyPlan },
    ],
  },
  {
    title: "Gallery",
    rows: [
      { label: "Private gallery", value: everyPlan },
      { label: "Reveal when you’re ready", value: everyPlan },
      { label: "Hide or delete any photo", value: everyPlan },
      { label: "Choice of layout", value: everyPlan },
    ],
  },
  {
    title: "Downloads",
    rows: [
      { label: "Download all as ZIP files", value: everyPlan },
      { label: "Guests download their own", value: everyPlan },
      { label: "Save to Google Drive", value: (p) => (p.id === "celebration" ? "Soon" : false) },
    ],
  },
  {
    title: "Help from us",
    rows: [
      { label: "We set it up with you", value: (p) => p.id === "celebration" },
      { label: "Direct help on the day", value: (p) => p.id === "celebration" },
      { label: "Add a co-host", value: (p) => (p.id === "celebration" ? "Soon" : false) },
    ],
  },
];


/** Self-service methods offered at checkout (lib/payments/paymongo-client.ts). */
export const PAYMENT_METHODS = ["GCash", "Maya", "card"] as const;

export const PAYMENT_METHODS_SENTENCE = "GCash, Maya or card";

type PaymentCopy = {
  /** One line: home pricing list, site footer. */
  line: string;
  /** Under the price card's CTA. */
  priceCardNote: string;
  /** Pricing page "how paying works" steps 2 and 3. */
  breakdownStep: string;
  payStep: { title: string; body: string };
  /** How it works, host step 2. */
  hostStep: string;
  /** FAQ "How do I pay?". */
  faqAnswer: string;
  /** Pricing page meta description, after "…every guest gets five frames, and ". */
  metaTail: string;
};

/**
 * How paying is described publicly, by payment mode (lib/payments/mode.ts, decision D23). The
 * site must describe the path the Share step actually offers: no "Pay online" or PayMongo claim
 * while hosts pay FiveFrames directly.
 */
export const PAYMENT_COPY_BY_MODE: Record<PaymentMode, PaymentCopy> = {
  online: {
    line: `Pay online with ${PAYMENT_METHODS_SENTENCE}`,
    priceCardNote: `Set it up first, pay when you’re ready. ${PAYMENT_METHODS_SENTENCE} via PayMongo.`,
    breakdownStep:
      "Before you pay: the event price, processing fees (included — nothing extra), the total, and the refund terms.",
    payStep: {
      title: "Pay online",
      body: `${PAYMENT_METHODS_SENTENCE}, handled securely by our payment provider, PayMongo.`,
    },
    hostStep: `Choose your plan, then see the full breakdown — ${PRICES_LABEL}, processing fees included — and the refund terms. Then pay online with ${PAYMENT_METHODS_SENTENCE}.`,
    faqAnswer: `Online with ${PAYMENT_METHODS_SENTENCE}, handled securely by our payment provider, PayMongo. Processing fees are included in the price.`,
    metaTail: `you pay online with ${PAYMENT_METHODS_SENTENCE}`,
  },
  manual: {
    line: "Pay FiveFrames directly — we set up every event with you",
    priceCardNote: "Set it up first, then pay FiveFrames directly. Your event activates once we confirm it.",
    breakdownStep: "Before you pay: the event price, the total, and the refund terms.",
    payStep: {
      title: "Pay FiveFrames directly",
      body: "We arrange payment with you in person — cash, bank transfer or e-wallet — and confirm it ourselves.",
    },
    hostStep: `Choose your plan, then see the full breakdown — ${PRICES_LABEL} and the refund terms. Then pay FiveFrames directly, and your event activates as soon as we confirm it.`,
    faqAnswer:
      "Directly to FiveFrames. We arrange it with you when we set up your event — cash, bank transfer or e-wallet — and your event activates once we confirm your payment.",
    metaTail: "you pay FiveFrames directly",
  },
};

export const PAYMENT_COPY = PAYMENT_COPY_BY_MODE[PAYMENT_MODE];

export const REFUND_SUMMARY = REFUND_POLICY_COPY;

export type FaqItem = { id: string; question: string; answer: string[] };
export type FaqGroup = { id: string; title: string; items: FaqItem[] };

export const FAQ_GROUPS: FaqGroup[] = [
  {
    id: "getting-started",
    title: "Getting started",
    items: [
      {
        id: "what-is-fiveframes",
        question: "What is FiveFrames?",
        answer: [
          `A simple way for everyone at your event to contribute a few photos from their own phones. Each guest gets exactly ${FRAMES} frames, and everything they keep goes into one private collection that you, the host, control.`,
        ],
      },
      {
        id: "create-event",
        question: "How do I create an event?",
        answer: [
          "Create a host account, then set up your event: its name, date and timezone, a welcome message for guests, and your gallery and sharing settings. If you like, give it a look too. You can set everything up before you pay.",
          `Your first event can be free, for up to ${FREE_PLAN.guestSessionCap} guests. After that, choose a plan and pay once to activate it. Either way, your event link and QR code are ready to share as soon as it’s active.`,
        ],
      },
      {
        id: "try-first",
        question: "Can I try it before I pay?",
        answer: [
          `Yes. The demo lets you take ${FRAMES} shots and keep them, just as a guest would, right in your browser, and try the keepsake styles on a sample look.`,
          "The demo isn’t an event. Nothing you do there is uploaded or saved, and it never gives you a link or QR code to share.",
          `For a real event, your first one is free: up to ${FREE_PLAN.guestSessionCap} guests, hosted for ${FREE_PLAN.hostedAccessLabel}, with the essentials: your event link and QR to share, your own photo, color and hashtag, live counts, and keepsakes for guests.`,
        ],
      },
      {
        id: "event-look",
        question: "Can it match my event?",
        answer: [
          "Yes, simply. Add one image, choose an accent color from a curated set, and set a hashtag if you have one. Guest screens, signage and keepsakes all use it.",
          "There’s no design editor: FiveFrames lays everything out for you. It’s all optional, and an event with no look set still looks finished.",
        ],
      },
      {
        id: "which-events",
        question: "Is it only for weddings?",
        answer: [
          "No. FiveFrames works for any occasion where people gather: birthdays, parties, reunions, trips, team events and weddings. Nothing about it is tied to one kind of event.",
        ],
      },
      {
        id: "how-many-guests",
        question: "How many guests can join?",
        answer: [
          `It depends on your plan: ${MARKETING_PLANS.map((p) => `up to ${p.guestSessionCap} on ${p.label}`).join(", ").replace(/, ([^,]*)$/, " and $1")}. Each phone browser that joins counts as one.`,
          `If an event fills up, anyone new sees a calm “this event is full” screen. Guests who already joined keep all ${FRAMES} of their frames.`,
        ],
      },
    ],
  },
  {
    id: "guests",
    title: "Guests & five frames",
    items: [
      {
        id: "app",
        question: "Do guests need to download an app?",
        answer: [
          "No. Guests scan your QR code or open your link, and everything happens in their phone’s browser.",
        ],
      },
      {
        id: "account",
        question: "Do guests need an account?",
        answer: ["No account, no email, no code. Guests type a first name and they’re in."],
      },
      {
        id: "why-only-five",
        question: "Why only five photos?",
        answer: [
          "Because five is the point. A small number asks guests to choose the moments that matter to them, and then lets them put the phone away and enjoy the event.",
          `It’s ${FRAMES} for every event. Hosts can’t change it and guests can’t buy more.`,
        ],
      },
      {
        id: "unused",
        question: "What if someone doesn’t use all five?",
        answer: [
          "That’s completely fine. Unused frames aren’t something to fix, and FiveFrames never nudges guests to finish.",
        ],
      },
      {
        id: "per-session",
        question: "Is it exactly five for each guest?",
        answer: [
          `It’s ${FRAMES} per guest session, meaning per phone browser that joins. There are no guest accounts, so someone who clears their browser or switches phones starts again with a new ${FRAMES}.`,
          "We chose that so joining never needs a login.",
        ],
      },
      {
        id: "taking-photos",
        question: "How do guests take their photos?",
        answer: [
          "With their phone’s camera or from their photo library, straight from the event page. Before keeping a photo they see a preview, can add an optional short message, and can retake it as often as they like.",
        ],
      },
      {
        id: "final",
        question: "Can a guest change a photo after keeping it?",
        answer: [
          "No. Once a guest taps Keep, that frame is final. It can’t be deleted or swapped. That’s why every guest sees a preview and makes an explicit choice before anything counts.",
        ],
      },
      {
        id: "weak-internet",
        question: "What if the internet at the venue is weak?",
        answer: [
          "A frame is only used once the photo has safely arrived. If an upload fails, the guest keeps the frame and can try again, and a retry never creates a duplicate.",
          "Larger photos upload in pieces, so an interrupted upload can pick up where it left off.",
        ],
      },
    ],
  },
  {
    id: "gallery",
    title: "Photos & gallery",
    items: [
      {
        id: "gallery-opens",
        question: "When does the gallery open?",
        answer: [
          "When you decide. By default it opens once capture has closed. You can also reveal it right away, or at a time you choose.",
          "Until then the gallery stays hidden, even from people who have its link.",
        ],
      },
      {
        id: "gallery-looks",
        question: "What does the gallery look like?",
        answer: [
          "One page of everyone’s photos to scroll through. Tap any photo to see it whole, with its message if the guest added one.",
          "You choose the layout in your event settings: Masonry keeps every photo in its own shape, Rows lines them up neatly across the page, and Grid shows even squares. It’s the same photos either way, and you can change it whenever you like.",
        ],
      },
      {
        id: "hide",
        question: "Can I hide photos?",
        answer: [
          "Yes. You can hide, unhide, delete or favorite any photo. Hiding or deleting a photo also removes it from that guest’s own view.",
          "It doesn’t give the guest a frame back. Keeping a photo is final for them.",
        ],
      },
      {
        id: "own-photos",
        question: "Can guests see the photos they took?",
        answer: [
          "Yes. Each guest keeps a private view of their own photos, which they can download, for as long as their browser session and the event last. Seeing everyone else’s photos depends on the gallery you share.",
        ],
      },
      {
        id: "download",
        question: "Can I download the original photos?",
        answer: [
          `Yes, one at a time, or all at once as ZIP files of up to ${ZIP_PART_SIZE} photos each, whenever you like until your event’s photos are deleted.`,
          "Originals are never modified. Previews and keepsakes are made as separate files.",
        ],
      },
      {
        id: "how-long",
        question: "How long are the photos kept?",
        answer: [
          `Each event is hosted from the day it’s activated: ${HOSTED_ACCESS_BY_PLAN}. You can download everything at any point in that time, your dashboard warns you before it ends, and downloads stay available for a grace period afterwards.`,
          "After that, the photos are permanently deleted.",
        ],
      },
    ],
  },
  {
    id: "privacy",
    title: "Privacy & sharing",
    items: [
      {
        id: "who-sees",
        question: "Who can see the photos?",
        answer: [
          "Nobody sees the gallery until you reveal it. After that, you choose: anyone with the gallery link, or only you.",
          "The gallery link is separate from the link guests use to join, and you can replace or turn off either one if it spreads further than you meant.",
        ],
      },
      {
        id: "public",
        question: "Are the photos public on the internet?",
        answer: [
          "No. Photos aren’t kept at public web addresses. Each one is shown through a short-lived link that’s only issued after an access check.",
        ],
      },
      {
        id: "sharing",
        question: "Can guests share their photos?",
        answer: [
          "If sharing is on, guests can make keepsakes of their own photos to share or save, even before the gallery opens, without revealing anyone else’s.",
          "You can turn sharing off. That switches off FiveFrames’ own sharing tools. It can’t stop guests from sharing photos that are already on their phones.",
        ],
      },
      {
        id: "what-are-keepsakes",
        question: "What are keepsakes?",
        answer: [
          "Styled images guests can make from their own photos, dressed in your event’s look. There are five styles for a single photo, and a guest who keeps all five can also put them together in one, in five styles made for that.",
          "A keepsake is a separate image: the original photo is never changed. It never shows the guest’s name, anyone else’s photos, or a link into your event, and it carries a small FiveFrames mark.",
        ],
      },
      {
        id: "staff",
        question: "Can FiveFrames staff see my photos?",
        answer: [
          "Only to support your event, on your behalf. Our team can open your event as you would to set it up or fix it, see and hide its photos, download the originals for you, and make a guest’s Full Set keepsake.",
          "Everything they do is recorded and listed on your event page, and they can’t delete your event or any photo. The Privacy Policy has the details.",
        ],
      },
      {
        id: "ai",
        question: "Does FiveFrames edit photos or use AI?",
        answer: [
          "No. There’s no AI in the capture flow, and FiveFrames never alters faces, writes captions or changes the photos guests keep.",
        ],
      },
    ],
  },
  {
    id: "payments",
    title: "Payments",
    items: [
      {
        id: "cost",
        question: "How much does it cost?",
        answer: [
          `Your first event is free, for up to ${FREE_PLAN.guestSessionCap} guests and ${FREE_PLAN.hostedAccessLabel} of hosting. After that: ${PAID_PLANS.map((p) => `${p.label} is ${formatPrice(p.pricePhp)}, for up to ${p.guestSessionCap} guests and ${p.hostedAccessLabel} of hosting`).join("; ")}. Each is paid once, for one event.`,
          `Every plan gets the same ${FRAMES} frames for every guest, the same keepsakes and the same gallery. There are no subscriptions or per-photo charges, and nothing to top up later.`,
        ],
      },
      {
        id: "which-plan",
        question: "Which plan should I choose?",
        answer: [
          `Go by how many guests you expect. ${PAID_PLANS.map((p) => `${p.label} suits ${p.forWhom.toLowerCase()}, up to ${p.guestSessionCap} guests`).join("; ")}.`,
          `${PLANS.celebration.label} also comes with us: we set up your look and get your signage print-ready with you, and you have a direct line to us on the day. Sending your photos to Google Drive and adding a co-host are coming soon too.`,
          `Free is there to try FiveFrames for real once, with up to ${FREE_PLAN.guestSessionCap} guests. It’s one per account, so save it for a small gathering rather than the event that matters most.`,
        ],
      },
      {
        id: "guests-pay",
        question: "Do guests pay anything?",
        answer: ["Never. Guests don’t pay, and there are no extra frames to buy."],
      },
      {
        id: "how-pay",
        question: "How do I pay?",
        answer: [
          PAYMENT_COPY.faqAnswer,
        ],
      },
      {
        id: "when-qr",
        question: "When do I get the QR code?",
        answer: [
          "As soon as your payment is confirmed. Your event link, QR code and signage (a printable QR, a table card, a poster and a phone-screen version) are issued then, and never before.",
        ],
      },
      {
        id: "pay-opens",
        question: "Does paying open capture?",
        answer: [
          "No. Paying activates your event, but capture stays closed until you open it, usually once everyone has arrived. Guests who scan early see a friendly “not open yet” screen.",
        ],
      },
      {
        id: "refund",
        question: "Can I get a refund?",
        answer: [REFUND_SUMMARY],
      },
    ],
  },
  {
    id: "after",
    title: "After the event",
    items: [
      {
        id: "capture-ends",
        question: "How does capture end?",
        answer: [
          "You close it when you’re ready, and you can reopen it for a while if you close it too early. If you forget, capture closes automatically a set time after your event date.",
        ],
      },
      {
        id: "after-event",
        question: "What can I do after the event?",
        answer: [
          "Review the photos, hide anything you’d rather not show, reveal the gallery, share its link and download the originals. All of it stays in your dashboard for the length of your hosted access.",
        ],
      },
    ],
  },
];

const ALL_ITEMS = FAQ_GROUPS.flatMap((group) => group.items);

export function faqItemsById(ids: readonly string[]): FaqItem[] {
  return ids.map((id) => {
    const item = ALL_ITEMS.find((candidate) => candidate.id === id);
    if (!item) throw new Error(`Unknown FAQ item: ${id}`);
    return item;
  });
}

/** The high-intent questions previewed on the homepage. */
export const HOME_FAQ_IDS = [
  "app",
  "why-only-five",
  "unused",
  "gallery-opens",
  "what-are-keepsakes",
  "download",
  "weak-internet",
  "how-pay",
] as const;

export const PRICING_FAQ_IDS = ["which-plan", "guests-pay", "how-pay", "when-qr", "pay-opens", "refund", "how-long"] as const;

/**
 * Testimonials — intentionally empty. Only add a quote that a real host or guest actually gave,
 * with their permission to publish it, attributed exactly as they agreed. Never paraphrase,
 * embellish, or invent one; the section renders nothing while this list is empty.
 */
export type Testimonial = {
  quote: string;
  /** Exactly as the person agreed to be credited (e.g. "Ana, hosted a 40th birthday"). */
  attribution: string;
  /** Where the permission to publish is recorded — required so nothing unapproved ships. */
  permissionReference: string;
};

export const TESTIMONIALS: Testimonial[] = [];
