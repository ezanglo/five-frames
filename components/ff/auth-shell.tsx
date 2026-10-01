import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronLeft } from "lucide-react";
import { MarketingRail, RailChecks } from "@/components/ff/marketing/marketing-rail";
import { PRICE_LABEL } from "@/lib/marketing/content";
import { Wordmark } from "./wordmark";

/**
 * Host auth layout (host 04a–e, D1–D1e). Desktop (≥1024): the auth split — a 640px brand panel
 * and the form centered in the rest, 420 wide. Mobile: a dark photo header carrying the title,
 * and the form in a white bottom sheet.
 *
 * The handoff's brand panel uses a balloon photograph; FiveFrames ships no stock photography,
 * so the panel is the shared marketing rail with the homepage's five printed frames.
 */
export function AuthShell({
  title,
  subtitle,
  back,
  icon,
  children,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  back?: { href: string; label: string };
  /** Large icon above the title (Check your inbox). */
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-surface-dark lg:grid lg:grid-cols-[640px_1fr] lg:bg-surface">
      <BrandPanel />

      {/* Mobile header */}
      <header className="ff-photo-header ff-safe-top relative flex min-h-[250px] flex-col px-5 pb-10 text-ink-inverse lg:hidden">
        <div className="flex h-11 items-center gap-3">
          {back && (
            <Link
              href={back.href}
              aria-label={back.label}
              className="ff-focus ff-frosted flex size-9 items-center justify-center rounded-full"
            >
              <ChevronLeft className="size-5" />
            </Link>
          )}
          <Wordmark host tone="light" href="/" />
        </div>
        <div className="mt-auto flex flex-col gap-1.5 pt-8">
          <h1 className="font-heading text-display font-semibold">{title}</h1>
          {subtitle && <div className="text-body font-medium text-ink-inverse/85">{subtitle}</div>}
        </div>
      </header>

      <main className="ff-safe-bottom relative -mt-6 flex min-h-[calc(100dvh-226px)] flex-col rounded-t-sheet bg-surface px-5 pt-6 lg:mt-0 lg:min-h-dvh lg:items-center lg:justify-center lg:rounded-none lg:px-10 lg:py-16">
        <div className="flex w-full flex-1 flex-col gap-6 lg:max-w-[420px] lg:flex-none lg:gap-7">
          <div className="hidden flex-col gap-5 lg:flex">
            {back && (
              <Link
                href={back.href}
                className="ff-focus flex w-fit items-center gap-1 rounded-md text-label font-medium text-ink-muted hover:text-ink"
              >
                <ChevronLeft className="size-4" aria-hidden />
                {back.label}
              </Link>
            )}
            {icon}
            <div className="flex flex-col gap-2">
              <h1 className="font-heading text-title-desktop font-semibold text-ink">{title}</h1>
              {subtitle && <div className="text-body text-ink-muted">{subtitle}</div>}
            </div>
          </div>
          {icon && <div className="flex justify-center lg:hidden">{icon}</div>}
          {children}
        </div>
      </main>
    </div>
  );
}

/** The desktop brand panel: the shared marketing rail, so auth reads as part of the public site. */
function BrandPanel() {
  return (
    <MarketingRail
      brand={<Wordmark host tone="light" href="/" />}
      eyebrow="For hosts"
      title={
        <>
          <span className="block">Every guest.</span>
          <span className="block">Five frames.</span>
          <span className="block">One shared story.</span>
        </>
      }
      lead="Share one QR code and your guests capture the day from their own phones. You reveal the gallery when the moment’s right."
      className="hidden lg:sticky lg:top-0 lg:flex"
    >
      <RailChecks items={["No app for guests", "No guest accounts", `${PRICE_LABEL} per event, paid once`]} />
    </MarketingRail>
  );
}

/** The mail icon in a tinted halo (host 04d / D1d "Check your inbox"). */
export function InboxIcon({ children }: { children: ReactNode }) {
  return (
    <span className="flex size-20 items-center justify-center rounded-full bg-brand-tint">
      <span className="flex size-14 items-center justify-center rounded-full bg-brand text-ink-inverse shadow-glow [&_svg]:size-6">
        {children}
      </span>
    </span>
  );
}

/** Numbered steps card (host 04d). */
export function StepsCard({ steps }: { steps: string[] }) {
  return (
    <ol className="flex flex-col gap-3 rounded-lg bg-surface-subtle p-4">
      {steps.map((step, i) => (
        <li key={step} className="flex items-center gap-3 text-label font-medium text-ink">
          <span className="tabular flex size-6 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-micro font-bold text-brand">
            {i + 1}
          </span>
          {step}
        </li>
      ))}
    </ol>
  );
}
