"use client";

import { ArrowRight, Check } from "lucide-react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ff/button";
import { formatPrice, PAID_PLANS, PLANS, type PlanId } from "@/lib/plans/registry";

/**
 * Share step → plan choice (product.md §7.2, §15.3, D24). Native radio cards posted as `plan`
 * to `chooseEventPlanAction`, the same card treatment as the gallery-layout field. Choosing a
 * card saves it straight away, so the price below always matches what is stored; without
 * JavaScript, the "Use this plan" button does the same. Each card says what the plan holds and
 * how long it's hosted, in plain words, with the price. The selected card has a check and a
 * border, never color alone.
 *
 * Free is listed first, and only while the account hasn't used its Free event (the server
 * refuses the choice otherwise). Choosing it activates nothing; the Share step's own button does.
 */
export function PlanPicker({
  action,
  value,
  offerFree,
}: {
  action: (formData: FormData) => void | Promise<void>;
  value: PlanId | null;
  offerFree: boolean;
}) {
  const plans = offerFree ? [PLANS.free, ...PAID_PLANS] : PAID_PLANS;
  return (
    <form action={action}>
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-3 text-label font-semibold text-ink">
          {value ? "Your plan" : "Choose a plan"}
        </legend>
        {/* Three cards stack: side by side they would wrap each line in the wizard's column. */}
        <div className={offerFree ? "grid gap-3" : "grid gap-3 sm:grid-cols-2"}>
          {plans.map((plan) => (
            <label key={plan.id} className="group relative flex cursor-pointer">
              <input
                type="radio"
                name="plan"
                value={plan.id}
                defaultChecked={plan.id === value}
                onChange={(e) => e.currentTarget.form?.requestSubmit()}
                className="peer sr-only"
              />
              <span className="flex w-full flex-col gap-1 rounded-lg border border-line bg-surface p-4 pr-10 transition-colors group-hover:border-ink-muted/40 peer-checked:border-brand peer-checked:bg-brand-tint/40 peer-focus-visible:shadow-[0_0_0_2px_var(--color-surface-base),0_0_0_4px_var(--brand-primary)]">
                <span className="flex items-baseline justify-between gap-3">
                  <span className="text-label font-bold text-ink">{plan.label}</span>
                  <span className="tabular text-label font-extrabold text-ink">
                    {formatPrice(plan.pricePhp)}
                  </span>
                </span>
                <span className="text-caption font-medium text-ink-muted">{plan.forWhom}</span>
                <span className="text-caption font-medium text-ink">
                  Up to {plan.guestSessionCap} guests · hosted for {plan.hostedAccessLabel}
                </span>
                {plan.id === "celebration" && (
                  <span className="text-caption font-medium text-ink">
                    We set it up with you, and help on the day
                  </span>
                )}
              </span>
              <span
                aria-hidden
                className="absolute top-4 right-4 hidden size-5 items-center justify-center rounded-full bg-brand text-ink-inverse peer-checked:flex"
              >
                <Check className="size-3" strokeWidth={3} />
              </span>
            </label>
          ))}
        </div>
        <SaveStatus />
      </fieldset>
    </form>
  );
}

/** Pending note while a choice saves, plus the no-JavaScript submit. */
function SaveStatus() {
  const { pending } = useFormStatus();
  return (
    <div className="flex items-center justify-between gap-3">
      <p role="status" className="text-caption font-medium text-ink-muted">
        {pending ? "Saving your plan…" : "You can change it until your event is activated."}
      </p>
      <noscript>
        <button
          type="submit"
          className="ff-focus rounded-md text-label font-semibold text-brand-ink hover:underline"
        >
          Use this plan
        </button>
      </noscript>
    </div>
  );
}

/**
 * The Share step's Free activation submit. Disabled while the request is in flight, so a double
 * tap sends one request; a second one would land on the same Free event anyway (the server
 * guard), never a second.
 */
export function ActivateFreeButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full lg:w-auto lg:px-8">
      {pending ? "Activating…" : "Activate free event"}
      {!pending && <ArrowRight aria-hidden />}
    </Button>
  );
}
