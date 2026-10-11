import { GRACE_PERIOD_DAYS } from "@/lib/events/policy";
import { REFUND_POLICY_COPY } from "@/lib/payments/pricing";
import { PAID_PLANS } from "@/lib/plans/registry";
import { FREE_PLAN, HOSTED_ACCESS_BY_PLAN, PAYMENT_COPY } from "./content";

/**
 * The Terms of Service and Privacy Policy (product.md §5.1.3, §15, §19). Plain-language documents
 * that state what the product actually does: every fact here is either interpolated from the
 * module that enforces it (plans, grace period, refund copy, payment mode) or describes code
 * that exists (support access and its log, the guest cookie, metadata stripping, deletion).
 * When behavior changes, change it here too. Not yet reviewed by a lawyer (progress.md).
 */

export const PRIVACY_EMAIL = "privacy@fiveframes.app";
export const SUPPORT_EMAIL = "support@fiveframes.app";
export const LEGAL_UPDATED = "11 October 2026";

/** A paragraph, or a bulleted list. */
export type LegalBlock = string | { list: string[] };
export type LegalSection = { id: string; title: string; body: LegalBlock[] };
export type LegalDocument = { title: string; lead: string; sections: LegalSection[] };

const PAID_PRICES = PAID_PLANS.map((p) => `${p.label} ₱${p.pricePhp.toLocaleString("en-PH")}`).join(", ");

/** The one description of support access both documents use (product.md §5.1.3, D27, D30). */
const SUPPORT_ACCESS: LegalBlock[] = [
  "FiveFrames staff set up, run and support events, often without being at the venue. To do that on a host’s behalf, an authorised member of our team can open any event’s own host pages and act as the host would, without asking first. In support access, staff can:",
  {
    list: [
      "change the event’s details, look, gallery and sharing settings, open and close capture, reveal the gallery, and replace or turn off its links;",
      "see the event’s photos, and hide or unhide them;",
      "download the original photos, one at a time or all together, for example to send them to the host;",
      "make a guest’s Full Set keepsake, as the host can.",
    ],
  },
  "Staff in support access can’t change the plan or take payment, request a refund, delete the event or any photo, favourite a photo, or change anything about a guest’s five frames.",
  "Every action in support access is permanently recorded, including each time staff view the photos, download an original or make a keepsake. The host’s event page lists what FiveFrames support did and when. Nobody, including our staff, can edit or delete that record.",
];

export const TERMS: LegalDocument = {
  title: "Terms of Service",
  lead: "The agreement between you and FiveFrames when you host an event, join one as a guest, or view a gallery.",
  sections: [
    {
      id: "about",
      title: "About these terms",
      body: [
        "FiveFrames (“we”, “us”) runs a web app for capturing shared moments at events. These terms apply to hosts, who create and run events, to guests, who join an event to take photos, and to anyone who opens a gallery link. By using FiveFrames you agree to them.",
        "Our Privacy Policy explains what we do with your information. It is part of these terms.",
      ],
    },
    {
      id: "service",
      title: "How FiveFrames works",
      body: [
        "A host creates an event and shares its link or QR code. Each guest joins from their own browser with a display name, without an app or an account, and can keep up to five photos. The five belong to the browser session that joined, so they are counted for each browser, not for each individual. Once a guest keeps a photo, that frame is used, even if the host later hides or deletes it.",
        "The host decides when capture opens and closes, when the gallery is revealed, and who can see it. Gallery links and capture links are separate, and the host can replace or turn off either one.",
      ],
    },
    {
      id: "hosts",
      title: "Hosting an event",
      body: [
        "You need an account to host. Keep your sign-in details to yourself, and give us accurate information. You are responsible for what happens in your account.",
        {
          list: [
            "Only run an event you have the right to run, and let your guests know their photos go to you and, if you share it, to everyone with the gallery link.",
            "You choose who sees the gallery and whether guests can make keepsakes. You can hide or delete any photo.",
            "If you share a gallery link, anyone who has it can view the gallery while it is open to link holders.",
          ],
        },
      ],
    },
    {
      id: "guests",
      title: "Joining as a guest",
      body: [
        "You join with a display name your host and, where the gallery shows it, other people will see. Keeping a photo is final for you: you can’t replace it or get the frame back. The host can hide or delete your photos.",
        "You can see and download your own photos from your event link, in the browser you joined from, until the event’s photos are deleted.",
      ],
    },
    {
      id: "content",
      title: "Your photos",
      body: [
        "You keep ownership of the photos and messages you add. You let FiveFrames store and process them, make the versions we need to run the service (smaller copies for viewing, keepsakes, previews), and show them to the people the event’s settings allow. We use them only to run FiveFrames and to support your event. We never sell them, use them for advertising, or use them to train AI.",
        "The original photo is never altered. Keepsakes are separate images and carry a small FiveFrames mark.",
        "Hosts give the same permission for the event image, name and other details they add.",
      ],
    },
    {
      id: "acceptable-use",
      title: "What you can’t do",
      body: [
        {
          list: [
            "Upload anything illegal, anything you don’t have the right to share, or anything that sexualises children.",
            "Use FiveFrames to harass, threaten or exploit anyone.",
            "Try to reach events, photos or accounts that aren’t yours, or get around the five-photo limit or any other limit.",
            "Overload, scrape or automate the service, or interfere with how it works.",
          ],
        },
        "We may hide content, suspend an event or close an account that breaks these rules, and we may report illegal content to the authorities.",
      ],
    },
    {
      id: "plans",
      title: "Plans, payment and refunds",
      body: [
        `Each plan buys one event, paid once. A host’s first event can be ${FREE_PLAN.label}, once per account. After that: ${PAID_PRICES}. Prices are in Philippine pesos. Guests never pay.`,
        `${PAYMENT_COPY.line}. Your event activates once payment is confirmed.`,
        `Refunds: ${REFUND_POLICY_COPY} A ${FREE_PLAN.label} event involves no payment, so there is nothing to refund. A refunded event goes back to unpaid and its links stop working.`,
      ],
    },
    {
      id: "hosted-access",
      title: "How long events are kept",
      body: [
        `Each event is hosted from the day it’s activated: ${HOSTED_ACCESS_BY_PLAN}. Hosted access can’t be extended. We warn you on your event dashboard before it ends.`,
        `When it ends, downloads stay available for ${GRACE_PERIOD_DAYS} more days. After that, the event’s photos are permanently deleted and can’t be recovered. Download anything you want to keep before then.`,
      ],
    },
    { id: "support-access", title: "FiveFrames support access", body: SUPPORT_ACCESS },
    {
      id: "availability",
      title: "Availability and changes",
      body: [
        "We work to keep FiveFrames running and your photos safe, but we can’t promise it will always be available or free of errors. Keep your own copy of anything important.",
        "We may change or improve features. If we change these terms in a way that matters, we’ll update this page and tell hosts before the change applies to them.",
      ],
    },
    {
      id: "liability",
      title: "Our responsibility",
      body: [
        "FiveFrames is provided as it is. As far as the law allows, we aren’t responsible for indirect losses, and our total responsibility to a host for an event is limited to what they paid for it. Nothing in these terms limits rights you have under Philippine law that can’t be limited.",
      ],
    },
    {
      id: "law",
      title: "Governing law",
      body: ["These terms are governed by the laws of the Republic of the Philippines."],
    },
    {
      id: "contact",
      title: "Contact",
      body: [`Questions about these terms: ${SUPPORT_EMAIL}. Privacy questions: ${PRIVACY_EMAIL}.`],
    },
  ],
};

export const PRIVACY: LegalDocument = {
  title: "Privacy Policy",
  lead: "What FiveFrames collects, why, who can see it, how long we keep it, and your rights.",
  sections: [
    {
      id: "who",
      title: "Who we are",
      body: [
        `FiveFrames runs the FiveFrames web app and is responsible for the personal information described here. Contact us about privacy at ${PRIVACY_EMAIL}.`,
      ],
    },
    {
      id: "collect",
      title: "What we collect",
      body: [
        "From hosts:",
        {
          list: [
            "your email address and password (the password is stored only in a form we can’t read);",
            "your events: name, date, timezone, welcome message, event image, hashtag, colour and settings;",
            "payment records: the plan, amount, method, reference and dates. We don’t store card details.",
          ],
        },
        "From guests (no account, email or phone number is needed):",
        {
          list: [
            "the display name you enter;",
            "the photos you keep, any message you add, and when you kept them;",
            "a cookie that remembers your place in that one event.",
          ],
        },
        "Inside photo files: the original is kept exactly as uploaded, so it may include details your phone added, such as when and where it was taken and the device. The host, and the guest who took it, can download that original. The copies shown on screen, in the gallery and in keepsakes have those details removed.",
        "From everyone: our hosting provider records technical information about each request, such as IP address, browser and time, for security and to fix problems.",
      ],
    },
    {
      id: "use",
      title: "How we use it",
      body: [
        {
          list: [
            "to run events: capture, galleries, downloads, keepsakes and signage;",
            "to show photos only to the people the event’s settings allow;",
            "to take and record payments and handle refunds;",
            "to support hosts, including through support access (below);",
            "to keep FiveFrames secure and to fix problems;",
            "to tell hosts when their event is about to end.",
          ],
        },
        "We don’t sell personal information, show advertising, or use photos to train AI. There is no face recognition or other automated analysis of what is in a photo.",
      ],
    },
    {
      id: "who-sees",
      title: "Who can see the photos",
      body: [
        {
          list: [
            "The host sees every photo kept at their event and can download the originals.",
            "Each guest sees and can download their own photos.",
            "Once the host reveals the gallery and makes it open to link holders, anyone with the gallery link can view it. Hidden photos never appear there.",
            "Anyone a guest shares a keepsake with sees that keepsake. It never shows the guest’s name, other guests’ photos or a link into the event.",
            "FiveFrames staff, through support access, on the host’s behalf (below).",
            "Our service providers, only to store and deliver them for us.",
          ],
        },
        "The event image the host chooses is shown to everyone who opens the event link, on signage and on keepsakes.",
      ],
    },
    { id: "support-access", title: "FiveFrames staff and support access", body: SUPPORT_ACCESS },
    {
      id: "providers",
      title: "Service providers",
      body: [
        "We use these providers to run FiveFrames. They process information only on our instructions:",
        {
          list: [
            "Vercel, to host the app;",
            "Supabase, for our database and host sign-in;",
            "Cloudflare, to store photos and event images;",
            "a payment provider, if you pay online.",
          ],
        },
        "Some of them process information outside the Philippines, including in Singapore and the United States. We use them under terms that require them to protect it.",
      ],
    },
    {
      id: "cookies",
      title: "Cookies and storage on your device",
      body: [
        {
          list: [
            "Hosts: cookies that keep you signed in.",
            "Guests: one cookie per event that remembers your place in it, kept for up to about 13 months.",
            "Guests: your browser briefly remembers a photo you were in the middle of keeping, so a retry doesn’t use a second frame.",
          ],
        },
        "We don’t use advertising or tracking cookies.",
      ],
    },
    {
      id: "retention",
      title: "How long we keep it",
      body: [
        `Photos, their messages, every copy made from them and the event image are permanently deleted ${GRACE_PERIOD_DAYS} days after the event’s hosted access ends (${HOSTED_ACCESS_BY_PLAN}). We can’t recover them after that.`,
        "We keep the host account, the event’s record (its name, date and settings), guests’ display names, payment records and the support access record after that, for as long as the account exists or as long as the law requires us to keep financial records. Ask us to delete them and we will, unless we must keep them by law.",
      ],
    },
    {
      id: "rights",
      title: "Your rights",
      body: [
        "Under the Data Privacy Act of 2012, you can ask to be informed about and get a copy of your personal information, have it corrected, object to its processing, have it deleted or blocked, and receive it in a portable form. You can also complain to the National Privacy Commission.",
        `To make a request, email ${PRIVACY_EMAIL}. Guests: tell us the event and the display name you used, so we can find your photos. We may ask you to show it’s you before we act. Hosts can also hide or delete a guest’s photos directly.`,
      ],
    },
    {
      id: "security",
      title: "How we protect it",
      body: [
        "Photos are kept in private storage, never at public web addresses. Each one is shown through a short-lived link issued only after an access check. Only a few authorised staff have support access, and everything they do is recorded and shown to the host.",
      ],
    },
    {
      id: "children",
      title: "Children",
      body: [
        "Hosts must be adults. Guests under 18 should join with a parent’s or guardian’s permission. Hosts are responsible for running their event in a way that respects the people photographed at it.",
      ],
    },
    {
      id: "changes",
      title: "Changes to this policy",
      body: [
        "If we change this policy in a way that matters, we’ll update this page and tell hosts before the change applies to them.",
      ],
    },
  ],
};
