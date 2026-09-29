import Link from "next/link";
import type { ReactNode } from "react";
import { Check, ChevronLeft, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type WizardStep = 1 | 2 | 3;
const STEP_LABELS = ["Details", "Look", "Share"] as const;

/**
 * Create-event wizard (D3–D5 / mobile 05a–c). Desktop: a 72h wizard bar replaces the top nav —
 * close (X) left, numbered stepper centered, save status right — then the form column (700)
 * beside a 340 side column, 40 gap. Mobile: a dark header with close/back, "Step N of 3", the
 * title, and a 3-segment progress bar at the top of the white sheet.
 */
export function WizardShell({
  step,
  closeHref,
  stepHref,
  status,
  statusTone = "muted",
  title,
  subtitle,
  aside,
  children,
}: {
  step: WizardStep;
  closeHref: string;
  /** Link for a completed step, when the draft exists. */
  stepHref?: (step: WizardStep) => string;
  status?: string;
  statusTone?: "muted" | "success";
  title: ReactNode;
  subtitle?: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
}) {
  const mobileLeading =
    step === 1 || !stepHref ? (
      <Link
        href={closeHref}
        aria-label="Close"
        className="ff-focus ff-frosted flex size-9 items-center justify-center rounded-full"
      >
        <X className="size-4" />
      </Link>
    ) : (
      <Link
        href={stepHref((step - 1) as WizardStep)}
        aria-label="Back"
        className="ff-focus ff-frosted flex size-9 items-center justify-center rounded-full"
      >
        <ChevronLeft className="size-5" />
      </Link>
    );

  return (
    <div className="flex min-h-dvh flex-col bg-surface-dark lg:bg-surface-subtle">
      {/* Desktop wizard bar */}
      <div className="sticky top-0 z-20 hidden h-[72px] grid-cols-[1fr_auto_1fr] items-center border-b border-line bg-surface px-10 lg:grid">
        <div className="flex items-center gap-3">
          <Link
            href={closeHref}
            aria-label="Close"
            className="ff-focus flex size-10 items-center justify-center rounded-full border border-line text-ink hover:bg-surface-subtle"
          >
            <X className="size-4" />
          </Link>
          <span className="text-[16px] font-bold text-ink">Create event</span>
        </div>
        <Stepper step={step} stepHref={stepHref} />
        <p
          className={cn(
            "text-right text-caption font-semibold",
            statusTone === "success" ? "text-success" : "text-ink-muted",
          )}
          role="status"
        >
          {status}
        </p>
      </div>

      {/* Mobile header */}
      <header className="ff-photo-header ff-safe-top relative flex min-h-[200px] flex-col px-5 pb-10 text-ink-inverse lg:hidden">
        <div className="grid h-11 grid-cols-[36px_1fr_36px] items-center">
          {mobileLeading}
          <p className="text-center text-caption font-semibold text-ink-inverse/85">
            Step {step} of 3
          </p>
        </div>
        <div className="mt-auto flex flex-col gap-1.5 pt-6">
          <h1 className="font-heading text-display-create font-semibold">{title}</h1>
          {subtitle && <p className="text-label font-medium text-ink-inverse/85">{subtitle}</p>}
        </div>
      </header>

      <main className="ff-safe-bottom relative -mt-6 flex flex-1 flex-col gap-5 rounded-t-sheet bg-surface px-5 pt-5 lg:mt-0 lg:rounded-none lg:bg-transparent lg:px-10 lg:pt-12 lg:pb-16">
        <div className="grid grid-cols-3 gap-1.5 lg:hidden" role="img" aria-label={`Step ${step} of 3`}>
          {[1, 2, 3].map((n) => (
            <span key={n} className={cn("h-1.5 rounded-full", n <= step ? "bg-brand" : "bg-line")} />
          ))}
        </div>
        <div className="mx-auto grid w-full flex-1 gap-10 lg:max-w-[1080px] lg:flex-none lg:grid-cols-[minmax(0,700px)_minmax(0,340px)]">
          <div className="flex min-w-0 flex-col gap-5 lg:gap-6">
            <div className="hidden flex-col gap-2 lg:flex">
              <p className="text-micro font-bold tracking-[0.06em] text-brand uppercase">
                Step {step} of 3
              </p>
              <h1 className="font-heading text-wizard-desktop font-semibold text-ink">{title}</h1>
              {subtitle && <p className="text-body text-ink-muted">{subtitle}</p>}
            </div>
            {children}
          </div>
          {aside && <aside className="hidden flex-col gap-3 lg:flex lg:pt-[108px]">{aside}</aside>}
        </div>
      </main>
    </div>
  );
}

/** Wizard stepper (DS03): done = check on tint, active = violet number, upcoming = outlined. */
function Stepper({
  step,
  stepHref,
}: {
  step: WizardStep;
  stepHref?: (step: WizardStep) => string;
}) {
  return (
    <ol className="flex items-center gap-3" aria-label="Create event steps">
      {STEP_LABELS.map((label, index) => {
        const n = (index + 1) as WizardStep;
        const done = n < step;
        const active = n === step;
        const content = (
          <>
            <span
              className={cn(
                "tabular flex size-7 items-center justify-center rounded-full text-micro font-bold",
                done && "bg-brand-tint text-brand",
                active && "bg-brand text-ink-inverse",
                !done && !active && "border border-line text-ink-muted",
              )}
            >
              {done ? <Check className="size-3.5" strokeWidth={3} aria-hidden /> : n}
            </span>
            <span
              className={cn(
                "text-label font-semibold",
                done ? "text-brand" : active ? "text-ink" : "text-ink-muted",
              )}
            >
              {label}
            </span>
          </>
        );
        return (
          <li key={label} className="flex items-center gap-3" aria-current={active ? "step" : undefined}>
            {done && stepHref ? (
              <Link href={stepHref(n)} className="ff-focus flex items-center gap-2 rounded-full">
                {content}
              </Link>
            ) : (
              <span className="flex items-center gap-2">{content}</span>
            )}
            {n < 3 && (
              <span
                aria-hidden
                className={cn("h-0.5 w-14 rounded-full", n < step ? "bg-brand" : "bg-line")}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

/** Wizard action row: Back (text) left, Continue (primary) right under the form. */
export function WizardActions({
  backHref,
  backLabel = "Back",
  children,
}: {
  backHref?: string;
  backLabel?: string;
  children: ReactNode;
}) {
  return (
    <div className="mt-auto flex flex-col gap-3 pt-2 lg:mt-2 lg:flex-row-reverse lg:items-center lg:justify-between">
      {children}
      {backHref && (
        <Link
          href={backHref}
          className="ff-focus hidden items-center gap-1 rounded-md text-label font-semibold text-ink-muted hover:text-ink lg:flex"
        >
          <ChevronLeft className="size-4" aria-hidden />
          {backLabel}
        </Link>
      )}
    </div>
  );
}

export type TimelineItem = { title: string; body: string; icon: ReactNode; done?: boolean };

/** "What happens next" timeline (DS05): done = violet check, upcoming = tint circle, 2px connector. */
export function NextStepsTimeline({ items }: { items: TimelineItem[] }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[11px] font-bold tracking-[0.08em] text-ink-muted uppercase">
        What happens next
      </p>
      <ol className="flex flex-col rounded-3xl border border-line bg-surface p-5">
        {items.map((item, i) => (
          <li key={item.title} className="relative flex gap-3 pb-5 last:pb-0">
            {i < items.length - 1 && (
              <span aria-hidden className="absolute top-8 bottom-0 left-[13px] w-0.5 bg-line" />
            )}
            <span
              className={cn(
                "relative flex size-7 shrink-0 items-center justify-center rounded-full [&_svg]:size-3.5",
                item.done ? "bg-brand text-ink-inverse" : "bg-brand-tint text-brand",
              )}
            >
              {item.done ? <Check strokeWidth={3} aria-hidden /> : item.icon}
            </span>
            <div className="flex flex-col gap-0.5 pt-0.5">
              <p className="text-label font-semibold text-ink">{item.title}</p>
              <p className="text-caption font-medium text-ink-muted">{item.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
