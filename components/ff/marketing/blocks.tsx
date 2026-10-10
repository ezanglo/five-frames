import type { ReactNode } from "react";
import {
  ArrowRight,
  CalendarClock,
  Check,
  ChevronDown,
  Clock,
  Minus,
  Users,
} from "lucide-react";
import { ButtonLink } from "@/components/ff/button";
import {
  FEATURED_PLAN_BADGE,
  FEATURED_PLAN_ID,
  MARKETING_PLANS,
  PLAN_COMPARISON,
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
 * One plan (product.md §15.3, D24), on /pricing and the homepage alike: name, price (₱0 for the
 * Free first event), who it suits, its guests and hosting, then its features in short titled
 * groups: Free lists what it includes, and each paid plan says "Everything in Free, plus" what
 * it adds (`planFeatures`). Every card has the same structure and spacing, so the plans read as
 * one set. The one featured plan (`FEATURED_PLAN_ID`) gets a badge, a brand border and the primary
 * button; the others get the secondary one. No anchor prices, no per-photo upsells. Everything
 * comes from the registry and lib/marketing/content.ts.
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
  const featured = plan.id === FEATURED_PLAN_ID;
  return (
    <div
      className={cn(
        "flex flex-col gap-6 rounded-3xl border bg-surface p-6 shadow-[0_24px_48px_-32px_rgb(21_20_26/0.3)] sm:p-8",
        featured ? "border-brand ring-1 ring-brand" : "border-line",
        className,
      )}
    >
      <div className="flex flex-col gap-2">
        {/* The badge sits in the name row, so every card's price starts at the same height. */}
        <div className="flex min-h-6 items-center justify-between gap-3">
          <Heading className="text-label font-bold text-brand">{plan.label}</Heading>
          {featured && (
            <span className="rounded-full bg-brand px-2.5 py-1 text-micro font-bold text-brand-foreground">
              {FEATURED_PLAN_BADGE}
            </span>
          )}
        </div>
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

      <div className="flex flex-col gap-5 border-t border-line pt-5">
        <p className="text-caption font-semibold tracking-wide text-ink-muted uppercase">
          {features.heading}
        </p>
        {features.groups.map((group) => (
          <div key={group.title} className="flex flex-col gap-3">
            <p className="text-caption font-bold text-ink">{group.title}</p>
            <ul className="flex flex-col gap-3">
              {group.lines.map((line) => (
                <CheckLine key={line.text} soon={line.soon}>
                  {line.text}
                </CheckLine>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <ButtonLink href="/signup" variant={featured ? "primary" : "secondary"} className="mt-auto w-full">
        {plan.pricePhp === 0 ? "Start your free event" : "Create your event"}
        <ArrowRight aria-hidden />
      </ButtonLink>
    </div>
  );
}

/**
 * The full plan comparison on /pricing: every feature, grouped, against Free, Standard and
 * Premium. Free is the lighter event (product.md §15.3.1); the paid plans differ only in
 * guests, hosting and Premium's help from us (§15.3). A real table, so screen
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
