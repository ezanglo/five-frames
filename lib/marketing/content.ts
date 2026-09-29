import { SHOTS_PER_GUEST } from "@/components/ff/shots";
import { HOSTED_ACCESS_DAYS } from "@/lib/events/policy";
import { EVENT_PRICE_PHP, REFUND_POLICY_COPY } from "@/lib/payments/pricing";

/**
 * Public marketing copy that states product facts. Every number here derives from the constant
 * the product itself uses, so the site cannot drift from what checkout, the lifecycle and the
 * guest flow actually do (see content.test.ts). Claims must stay within docs/product.md — the
 * claim audit in docs/design-direction.md → "Marketing site" lists what is deliberately left out.
 */

/** "₱999" — the one event price (product.md §15), formatted for display. */
export const PRICE_LABEL = `₱${EVENT_PRICE_PHP.toLocaleString("en-PH")}`;

export const FRAMES = SHOTS_PER_GUEST;

/** "about 12 months" — hosted access from activation (product.md §15.2, lib/events/policy.ts). */
export const HOSTED_ACCESS_LABEL = `about ${Math.round(HOSTED_ACCESS_DAYS / 30.4)} months`;

/**
 * Launch guest-session capacity (product.md §9.5, decision D13). The authoritative value is the
 * `guest_session_cap` column default in supabase/migrations/20260922000000_event_join_capacity.sql;
 * content.test.ts fails if the two disagree.
 */
export const DEFAULT_GUEST_SESSION_CAP = 250;

/** Self-service methods offered at checkout (lib/payments/paymongo-client.ts). */
export const PAYMENT_METHODS = ["GCash", "Maya", "card"] as const;

export const PAYMENT_METHODS_SENTENCE = "GCash, Maya or card";

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
          "Create a host account, then set up your event: its name, date and timezone, a welcome message for guests, and your gallery and sharing settings. You can set everything up before you pay.",
          "Pay once to activate it, and your event link and QR code are ready to share.",
        ],
      },
      {
        id: "try-first",
        question: "Can I try it before I pay?",
        answer: [
          `Yes. The demo lets you take ${FRAMES} shots and keep them, just as a guest would, right in your browser.`,
          "The demo isn’t an event. Nothing you do there is uploaded or saved, and it never gives you a link or QR code to share.",
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
          `Each event has room for up to ${DEFAULT_GUEST_SESSION_CAP} guest sessions. Each phone browser that joins counts as one.`,
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
        id: "why-five",
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
          "With their phone’s own camera, straight from the event page. Before keeping a photo they see a preview, can add an optional short message, and can retake it as often as they like.",
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
          "Yes, one at a time or all at once, whenever you like until your event’s photos are deleted.",
          "Originals are never modified. Previews and share cards are made as separate files.",
        ],
      },
      {
        id: "how-long",
        question: "How long are the photos kept?",
        answer: [
          `Each event includes ${HOSTED_ACCESS_LABEL} of hosted access from the day it’s activated. Your dashboard warns you before it ends, and downloads stay available for a grace period afterwards.`,
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
          "If sharing is on, guests can share a FiveFrames card of their own photos, even before the gallery opens, without revealing anyone else’s.",
          "You can turn sharing off. That switches off FiveFrames’ own sharing tools. It can’t stop guests from sharing photos that are already on their phones.",
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
          `${PRICE_LABEL} per event, paid once. That covers the whole event, ${HOSTED_ACCESS_LABEL} of hosted access, and ${FRAMES} frames for every guest.`,
          "There are no tiers, subscriptions or per-photo charges.",
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
          `Online with ${PAYMENT_METHODS_SENTENCE}, handled securely by our payment provider, PayMongo. Processing fees are included in the price.`,
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
  "why-five",
  "unused",
  "gallery-opens",
  "download",
  "weak-internet",
  "which-events",
  "how-pay",
] as const;

export const PRICING_FAQ_IDS = ["guests-pay", "how-pay", "when-qr", "pay-opens", "refund", "how-long"] as const;

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
