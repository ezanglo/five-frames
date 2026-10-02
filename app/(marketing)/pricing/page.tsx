import { Ban, CalendarClock, CreditCard, ReceiptText } from "lucide-react";
import { CtaBand, FaqList, PriceCard } from "@/components/ff/marketing/blocks";
import { PageHero, Section, SectionHeader } from "@/components/ff/marketing/section";
import {
  DEFAULT_GUEST_SESSION_CAP,
  FRAMES,
  HOSTED_ACCESS_LABEL,
  PAYMENT_COPY,
  PRICE_LABEL,
  PRICING_FAQ_IDS,
  REFUND_SUMMARY,
  faqItemsById,
} from "@/lib/marketing/content";
import { marketingMetadata } from "@/lib/marketing/metadata";

export const metadata = marketingMetadata({
  title: "Pricing",
  description: `FiveFrames is ${PRICE_LABEL} per event, paid once. Guests never pay, every guest gets five frames, and ${PAYMENT_COPY.metaTail}.`,
  path: "/pricing",
});

const INCLUDED = [
  {
    title: "For your guests",
    lines: [
      `Exactly ${FRAMES} frames each, at no cost to them`,
      "No app, no account — just a first name",
      "A private view of the photos they kept, to revisit and download",
      "Keepsakes of their own photos to share or save, if you allow sharing",
    ],
  },
  {
    title: "For you",
    lines: [
      "Your event link and QR code, plus table card, poster and phone-screen signage",
      "An optional look: one image, an accent color and a hashtag",
      "Capture you open and close yourself",
      "Guests-joined and photos-taken counts that refresh on their own",
      "Hide, unhide, delete and favorite",
      "Gallery reveal after the event, right away, or at a time you set",
      "A choice of gallery layout: Masonry, Rows or Grid",
      "Download every original, individually or all at once",
    ],
  },
  {
    title: "Hosting",
    lines: [
      `${HOSTED_ACCESS_LABEL[0].toUpperCase()}${HOSTED_ACCESS_LABEL.slice(1)} of hosted access from activation`,
      "A warning on your dashboard before hosting ends",
      "Downloads stay open for a grace period afterwards",
      `Room for up to ${DEFAULT_GUEST_SESSION_CAP} guest sessions per event`,
    ],
  },
];

const PAYMENT_STEPS = [
  {
    title: "Set up first",
    body: "Create your account and configure your event before paying anything.",
  },
  {
    title: "See the breakdown",
    body: PAYMENT_COPY.breakdownStep,
  },
  PAYMENT_COPY.payStep,
  {
    title: "Share right away",
    body: "Your link, QR code and signage are issued as soon as payment is confirmed. Capture opens when you say so.",
  },
];

export default function PricingPage() {
  return (
    <>
      <PageHero
        eyebrow="Pricing"
        title="One event. One price. Paid once."
        lead={`${PRICE_LABEL} covers everything for one event. Guests never pay, and there’s nothing to add on.`}
      />

      <Section labelledBy="included-title" className="relative -mt-6 rounded-t-sheet">
        <div className="grid gap-12 lg:grid-cols-[440px_minmax(0,1fr)] lg:gap-20">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <PriceCard headingLevel="h2" />
          </div>
          <div className="flex flex-col gap-10">
            <SectionHeader
              id="included-title"
              eyebrow="What’s included"
              title="Everything, for every event."
              lead="There’s one offer, so there’s nothing to compare. Every event gets all of this."
            />
            {INCLUDED.map((group) => (
              <div key={group.title} className="flex flex-col gap-4 border-t border-line pt-6">
                <h3 className="text-[19px] font-bold text-ink">{group.title}</h3>
                <ul className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
                  {group.lines.map((line) => (
                    <li key={line} className="flex items-start gap-3 text-label font-medium text-ink">
                      <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-brand" />
                      {line}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </Section>

      <Section tone="subtle" labelledBy="payment-title">
        <SectionHeader
          id="payment-title"
          eyebrow="Paying"
          title="How payment works."
          lead="Paying activates your event. It doesn’t open capture — you still decide when guests can start."
        />
        <ol className="mt-12 grid gap-4 sm:grid-cols-2 lg:mt-16 lg:grid-cols-4 lg:gap-6">
          {PAYMENT_STEPS.map((step, index) => (
            <li key={step.title} className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-5 lg:rounded-3xl lg:p-6">
              <span className="tabular flex size-10 items-center justify-center rounded-full bg-brand-tint text-label font-extrabold text-brand">
                {index + 1}
              </span>
              <h3 className="text-[17px] font-bold text-ink">{step.title}</h3>
              <p className="text-label font-medium text-ink-muted">{step.body}</p>
            </li>
          ))}
        </ol>

        <div className="mt-6 grid gap-4 lg:mt-8 lg:grid-cols-3 lg:gap-6">
          <PolicyCard icon={<ReceiptText />} title="Refund summary">
            <p>{REFUND_SUMMARY}</p>
            <p>The same terms are shown to you before you pay.</p>
          </PolicyCard>
          <PolicyCard icon={<CalendarClock />} title="After hosting ends">
            <p>
              Hosting lasts {HOSTED_ACCESS_LABEL} from activation. Your dashboard warns you before
              it ends, and you can still download everything during a grace period afterwards.
              Then the photos are permanently deleted.
            </p>
          </PolicyCard>
          <PolicyCard icon={<Ban />} title="What you won’t pay for">
            <p>
              No subscriptions, no tiers, no per-photo charges, no extra frames. Guests are never
              asked to pay for anything.
            </p>
          </PolicyCard>
        </div>
        <p className="mt-6 flex items-center gap-2 text-caption font-medium text-ink-muted">
          <CreditCard className="size-4 shrink-0" aria-hidden />
          Prices are in Philippine pesos.
        </p>
      </Section>

      <Section labelledBy="pricing-faq-title">
        <div className="grid gap-10 lg:grid-cols-[360px_minmax(0,1fr)] lg:gap-16">
          <SectionHeader id="pricing-faq-title" eyebrow="FAQ" title="Payment questions." />
          <FaqList items={faqItemsById(PRICING_FAQ_IDS)} />
        </div>
      </Section>

      <CtaBand
        title="Set it up now. Pay when you’re ready."
        body="Create your event and configure everything first. You’ll only pay when you want your QR code."
      />
    </>
  );
}

function PolicyCard({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-5 lg:rounded-3xl lg:p-6">
      <span className="flex size-10 items-center justify-center rounded-full bg-surface-subtle text-ink [&_svg]:size-5">
        {icon}
      </span>
      <h3 className="text-[17px] font-bold text-ink">{title}</h3>
      <div className="flex flex-col gap-2 text-label font-medium text-ink-muted">{children}</div>
    </div>
  );
}
