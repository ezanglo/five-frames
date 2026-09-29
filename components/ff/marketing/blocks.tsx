import type { ReactNode } from "react";
import { ArrowRight, Check, ChevronDown } from "lucide-react";
import { ButtonLink } from "@/components/ff/button";
import {
  FRAMES,
  HOSTED_ACCESS_LABEL,
  PAYMENT_METHODS_SENTENCE,
  PRICE_LABEL,
  type FaqItem,
} from "@/lib/marketing/content";
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

const INCLUSIONS = [
  `${FRAMES} frames for every guest — the same for every event`,
  "Your event link, printable QR, table card, poster and phone-screen signage",
  "You open and close capture; counts refresh on their own",
  "Hide, unhide, delete and favorite any photo",
  "Reveal the gallery when you choose, to anyone with the link or only you",
  "Download every original, one at a time or all at once",
  `${HOSTED_ACCESS_LABEL[0].toUpperCase()}${HOSTED_ACCESS_LABEL.slice(1)} of hosted access`,
];

/**
 * The one offer (product.md §15): one event, one price, paid once. No tiers, no anchors, no
 * per-photo upsells. Price and inclusions come from the product constants.
 */
export function PriceCard({ className, headingLevel = "h3" }: { className?: string; headingLevel?: "h2" | "h3" }) {
  const Heading = headingLevel;
  return (
    <div
      className={cn(
        "flex flex-col gap-6 rounded-3xl border border-line bg-surface p-6 shadow-[0_24px_48px_-32px_rgb(21_20_26/0.3)] sm:p-8",
        className,
      )}
    >
      <div className="flex flex-col gap-2">
        <Heading className="text-label font-bold text-brand">One event</Heading>
        <p className="flex items-baseline gap-2">
          <span className="tabular text-[56px] leading-none font-extrabold tracking-[-0.02em] text-ink">
            {PRICE_LABEL}
          </span>
          <span className="text-body font-semibold text-ink-muted">per event, paid once</span>
        </p>
        <p className="text-label font-medium text-ink-muted">
          Guests never pay. No subscription, no per-photo charges, and processing fees are
          included.
        </p>
      </div>
      <ul className="flex flex-col gap-3">
        {INCLUSIONS.map((line) => (
          <li key={line} className="flex items-start gap-3 text-label font-medium text-ink">
            <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-brand-tint text-brand">
              <Check className="size-3" strokeWidth={3} aria-hidden />
            </span>
            {line}
          </li>
        ))}
      </ul>
      <div className="flex flex-col gap-3">
        <ButtonLink href="/signup" className="w-full">
          Create your event
          <ArrowRight aria-hidden />
        </ButtonLink>
        <p className="text-center text-caption font-medium text-ink-muted">
          Set it up first, pay when you’re ready. {PAYMENT_METHODS_SENTENCE} via PayMongo.
        </p>
      </div>
    </div>
  );
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
