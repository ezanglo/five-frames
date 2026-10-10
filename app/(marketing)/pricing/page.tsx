import { Ban, CalendarClock, CreditCard, ReceiptText } from "lucide-react";
import { CtaBand, FaqList, PlanCard, PlanComparison } from "@/components/ff/marketing/blocks";
import { PageHero, Section, SectionHeader } from "@/components/ff/marketing/section";
import {
  HOSTED_ACCESS_BY_PLAN,
  MARKETING_PLANS,
  PAYMENT_COPY,
  PRICES_LABEL,
  PRICING_FAQ_IDS,
  REFUND_SUMMARY,
  faqItemsById,
} from "@/lib/marketing/content";
import { marketingMetadata } from "@/lib/marketing/metadata";

export const metadata = marketingMetadata({
  title: "Pricing",
  description: `Your first FiveFrames event is free; after that it’s ${PRICES_LABEL} per event, paid once. Guests never pay, every guest gets five frames, and ${PAYMENT_COPY.metaTail}.`,
  path: "/pricing",
});

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
        title="Start free. Then pay once per event."
        lead={`Your first event is free. After that, choose by the size of your event: ${PRICES_LABEL}. Guests never pay, and there’s nothing to add on.`}
      />

      <Section labelledBy="plans-title" className="relative -mt-6 rounded-t-sheet">
        <h2 id="plans-title" className="sr-only">
          Plans
        </h2>
        <div className="grid gap-6 lg:grid-cols-3">
          {MARKETING_PLANS.map((plan) => (
            <PlanCard key={plan.id} plan={plan} />
          ))}
        </div>
      </Section>

      <Section labelledBy="compare-title" className="pt-0 sm:pt-0 lg:pt-0">
        <div className="flex flex-col gap-10 lg:gap-12">
          <SectionHeader
            id="compare-title"
            eyebrow="Compare plans"
            title="See what each plan includes."
            lead="Every plan gets five photos per guest and a private gallery. Free keeps it simple. Paid plans add the extras."
          />
          <PlanComparison />
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
              Hosting lasts from activation: {HOSTED_ACCESS_BY_PLAN}. Your dashboard warns you
              before it ends, and you can still download everything during a grace period
              afterwards. Then the photos are permanently deleted.
            </p>
          </PolicyCard>
          <PolicyCard icon={<Ban />} title="What you won’t pay for">
            <p>
              No subscriptions, no per-photo charges, no extra frames, and nothing to top up
              later. Guests are never asked to pay for anything.
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
