import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CalendarClock,
  Check,
  ChevronDown,
  Clock,
  Minus,
  Sparkles,
  Users,
} from "lucide-react";
import { ButtonLink } from "@/components/ff/button";
import {
  EVERY_PLAN_HIGHLIGHTS,
  MARKETING_PLANS,
  PAYMENT_COPY,
  PLAN_COMPARISON,
  planExtras,
  planFeatures,
  type ComparisonValue,
  type FaqItem,
} from "@/lib/marketing/content";
import { formatPrice, type Plan } from "@/lib/plans/registry";
import { cn } from "@/lib/utils";

/**
 * FAQ disclosures: native <details>/<summary>, so they open with keyboard and assistive tech
 * with no script, and the answers stay in the HTML for search engines.
 */
export function FaqList({ items, className }: { items: FaqItem[]; className?: string }) {
  return (
    <div className={cn("flex flex-col divide-y divide-line rounded-xl border border-line bg-surface lg:rounded-3xl", className)}>
      {items.map((item) => (
        <details key={item.id} id={item.id} className="group scroll-mt-24">
          <summary className="ff-focus flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 rounded-xl px-5 py-4 text-[16px] leading-snug font-bold text-ink lg:px-6 [&::-webkit-details-marker]:hidden">
            {item.question}
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-subtle text-ink-muted transition-transform group-open:rotate-180 group-open:bg-brand-tint group-open:text-brand">
              <ChevronDown className="size-4" aria-hidden />
            </span>
          </summary>
          <div className="flex flex-col gap-3 px-5 pb-5 text-body font-medium text-ink-muted lg:px-6 lg:pb-6">
            {item.answer.map((paragraph) => (
              <p key={paragraph} className="max-w-[68ch]">
                {paragraph}
              </p>
            ))}
          </div>
        </details>
      ))}
    </div>
  );
}

/** The two numbers that differ between plans, shown first on every plan card. */
function PlanStats({ plan, compact }: { plan: Plan; compact?: boolean }) {
  const stats = [
    { icon: <Users />, value: `Up to ${plan.guestSessionCap}`, label: "guests" },
    { icon: <CalendarClock />, value: plan.hostedAccessLabel, label: "hosted" },
  ];
  return (
    <dl className="grid grid-cols-2 gap-2">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className={cn(
            "flex flex-col gap-0.5 rounded-lg bg-surface-subtle [&_svg]:size-4 [&_svg]:text-brand",
            compact ? "px-3 py-2" : "p-3",
          )}
        >
          <dt className="flex items-center gap-1.5 text-caption font-medium text-ink-muted">
            {stat.icon}
            {stat.label[0].toUpperCase() + stat.label.slice(1)}
          </dt>
          <dd className="tabular text-label font-bold text-ink">{stat.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * One list line, the same on every plan card and the homepage card. A `soon` line is promised
 * but not built yet (product.md §11.2.1, §11.2.2): it gets a clock instead of a check and a
 * "Coming soon" label, so it can never read as available today.
 */
function CheckLine({ children, soon }: { children: ReactNode; soon?: boolean }) {
  return (
    <li className="flex items-start gap-3 text-label font-medium text-ink">
      <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-brand-tint text-brand">
        {soon ? (
          <Clock className="size-3" strokeWidth={2.5} aria-hidden />
        ) : (
          <Check className="size-3" strokeWidth={3} aria-hidden />
        )}
      </span>
      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {children}
        {soon && (
          <span className="rounded-full bg-surface-subtle px-2 py-0.5 text-micro font-semibold text-ink-muted">
            Coming soon
          </span>
        )}
      </span>
    </li>
  );
}

/**
 * One plan (product.md §15.3, D24): name, price (₱0 for the Free first event), who it suits, its
 * guests and hosting, then its features built up plan by plan: Free lists what it includes, and
 * each paid plan says "Everything in <previous>, plus" what it adds (`planFeatures`). Every card
 * has the same structure, spacing, icon and button, so the plans read as one set; the only
 * thing that varies is the content. No anchors, no
 * favourite-plan badge, no per-photo upsells. Everything comes from the registry and
 * lib/marketing/content.ts.
 */
export function PlanCard({
  plan,
  className,
  headingLevel = "h3",
}: {
  plan: Plan;
  className?: string;
  headingLevel?: "h2" | "h3";
}) {
  const Heading = headingLevel;
  const features = planFeatures(plan);
  return (
    <div
      className={cn(
        "flex flex-col gap-6 rounded-3xl border border-line bg-surface p-6 shadow-[0_24px_48px_-32px_rgb(21_20_26/0.3)] sm:p-8",
        className,
      )}
    >
      <div className="flex flex-col gap-2">
        <Heading className="text-label font-bold text-brand">{plan.label}</Heading>
        <p className="flex flex-wrap items-baseline gap-x-2">
          <span className="tabular text-[48px] leading-none font-extrabold tracking-[-0.02em] text-ink sm:text-[56px]">
            {formatPrice(plan.pricePhp)}
          </span>
          <span className="text-body font-semibold text-ink-muted">
            {plan.pricePhp === 0 ? "for your first event" : "per event, paid once"}
          </span>
        </p>
        {/* Two lines reserved, so every card's stats and list start at the same height. */}
        <p className="min-h-[2lh] text-label font-medium text-ink-muted">{plan.forWhom}.</p>
      </div>

      <PlanStats plan={plan} />

      <div className="flex flex-col gap-3 border-t border-line pt-5">
        <p className="text-caption font-semibold tracking-wide text-ink-muted uppercase">
          {features.heading}
        </p>
        <ul className="flex flex-col gap-3">
          {features.lines.map((line) => (
            <CheckLine key={line.text} soon={line.soon}>
              {line.text}
            </CheckLine>
          ))}
        </ul>
      </div>

      <ButtonLink href="/signup" className="mt-auto w-full">
        {plan.pricePhp === 0 ? "Start your free event" : "Create your event"}
        <ArrowRight aria-hidden />
      </ButtonLink>
    </div>
  );
}

/**
 * Every plan in one compact card, for the homepage pricing section: a row per plan with its
 * price, guests and hosting, then what every plan includes and one call to action. Guests
 * never pay on any of them.
 */
export function PlansCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex flex-col gap-6 rounded-3xl border border-line bg-surface p-6 shadow-[0_24px_48px_-32px_rgb(21_20_26/0.3)] sm:p-8",
        className,
      )}
    >
      <ul className="flex flex-col divide-y divide-line">
        {MARKETING_PLANS.map((plan) => (
          <li key={plan.id} className="flex flex-col gap-3 py-4 first:pt-0">
            <div className="flex items-baseline justify-between gap-4">
              <div className="flex min-w-0 flex-col">
                <span className="text-[19px] font-bold text-ink">{plan.label}</span>
                <span className="text-caption font-medium text-ink-muted">{plan.forWhom}</span>
              </div>
              <span className="tabular shrink-0 text-[32px] leading-none font-extrabold tracking-[-0.02em] text-ink">
                {formatPrice(plan.pricePhp)}
              </span>
            </div>
            <PlanStats plan={plan} compact />
            {planExtras(plan).length > 0 && (
              <p className="flex items-center gap-1.5 text-caption font-semibold text-ink">
                <Sparkles className="size-3.5 shrink-0 text-brand" aria-hidden />
                {planExtras(plan).join(" · ")}
              </p>
            )}
          </li>
        ))}
      </ul>
      <div className="flex flex-col gap-3 rounded-xl bg-surface-subtle p-4">
        <p className="text-caption font-semibold tracking-wide text-ink-muted uppercase">
          Every plan includes
        </p>
        <ul className="flex flex-col gap-2.5">
          {EVERY_PLAN_HIGHLIGHTS.map((line) => (
            <CheckLine key={line}>{line}</CheckLine>
          ))}
        </ul>
        <Link
          href="/pricing#compare-title"
          className="ff-focus w-fit rounded-md text-label font-semibold text-brand underline-offset-4 hover:underline"
        >
          Compare everything in each plan
        </Link>
      </div>
      <div className="flex flex-col gap-3">
        <ButtonLink href="/signup" className="w-full">
          Create your event
          <ArrowRight aria-hidden />
        </ButtonLink>
        <p className="text-center text-caption font-medium text-ink-muted">
          Your first event is free. After that, each event is paid once.{" "}
          {PAYMENT_COPY.priceCardNote}
        </p>
      </div>
    </div>
  );
}

/**
 * The full plan comparison on /pricing: every feature, grouped, against Free, Intimate and
 * Celebration. Free is the lighter event (product.md §15.3.1); the paid plans differ only in
 * guests, hosting and Celebration's help from us (§15.3). A real table, so screen
 * readers announce each cell with its plan and feature. At phone width the plan columns stay
 * narrow (checks and short values), so the table fits without scrolling the page.
 */
export function PlanComparison() {
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-surface lg:rounded-3xl">
      <table className="w-full min-w-[340px] border-collapse text-left">
        <caption className="sr-only">What each FiveFrames plan includes</caption>
        <thead>
          <tr className="border-b border-line">
            <th scope="col" className="p-3 text-caption font-semibold text-ink-muted sm:p-4 lg:px-6">
              <span className="sr-only">Feature</span>
            </th>
            {MARKETING_PLANS.map((plan) => (
              <th
                key={plan.id}
                scope="col"
                className="w-[24%] p-3 text-center text-label font-bold text-ink sm:w-[18%] sm:p-4"
              >
                {plan.label}
              </th>
            ))}
          </tr>
        </thead>
        {PLAN_COMPARISON.map((group) => (
          <tbody key={group.title}>
            <tr className="bg-surface-subtle">
              <th
                scope="colgroup"
                colSpan={MARKETING_PLANS.length + 1}
                className="px-3 py-2.5 text-caption font-bold tracking-wide text-ink-muted uppercase sm:px-4 lg:px-6"
              >
                {group.title}
              </th>
            </tr>
            {group.rows.map((row) => (
              <tr key={row.label} className="border-t border-line first:border-t-0">
                <th
                  scope="row"
                  className="p-3 text-caption font-medium text-ink sm:p-4 sm:text-label lg:px-6"
                >
                  {row.label}
                </th>
                {MARKETING_PLANS.map((plan) => (
                  <td key={plan.id} className="p-3 text-center sm:p-4">
                    <ComparisonCell value={row.value(plan)} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        ))}
      </table>
    </div>
  );
}

function ComparisonCell({ value }: { value: ComparisonValue }) {
  if (value === true) {
    return (
      <span className="inline-flex size-6 items-center justify-center rounded-full bg-brand-tint text-brand">
        <Check className="size-3.5" strokeWidth={3} aria-hidden />
        <span className="sr-only">Included</span>
      </span>
    );
  }
  if (value === false) {
    return (
      <span className="text-ink-muted">
        <Minus className="mx-auto size-4" aria-hidden />
        <span className="sr-only">Not included</span>
      </span>
    );
  }
  if (value === "Soon") {
    return (
      <span className="rounded-full bg-surface-subtle px-2 py-0.5 text-micro font-semibold text-ink-muted">
        Coming soon
      </span>
    );
  }
  return <span className="tabular text-caption font-bold text-ink sm:text-label">{value}</span>;
}

/** Closing call to action: the dark photo-header treatment as a rounded band. */
export function CtaBand({
  title,
  body,
  secondary = { href: "/demo", label: "Try the demo" },
}: {
  title: ReactNode;
  body: ReactNode;
  secondary?: { href: string; label: string } | null;
}) {
  return (
    <section aria-labelledby="closing-cta" className="bg-surface px-5 py-16 lg:px-10 lg:py-24">
      <div className="ff-photo-header-desktop mx-auto flex w-full max-w-[1200px] flex-col items-start gap-6 overflow-hidden rounded-[28px] px-6 py-12 text-ink-inverse sm:px-10 lg:flex-row lg:items-end lg:justify-between lg:rounded-[36px] lg:px-16 lg:py-20">
        <div className="flex max-w-[620px] flex-col gap-4">
          <h2 id="closing-cta" className="font-heading text-display font-semibold text-balance lg:text-page-desktop">
            {title}
          </h2>
          <p className="text-body font-medium text-ink-on-dark sm:text-[17px]">{body}</p>
        </div>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row lg:shrink-0">
          <ButtonLink href="/signup">Create your FiveFrames event</ButtonLink>
          {secondary && (
            <ButtonLink href={secondary.href} variant="frosted">
              {secondary.label}
            </ButtonLink>
          )}
        </div>
      </div>
    </section>
  );
}
