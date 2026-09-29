import Link from "next/link";
import type { ReactNode } from "react";
import { Check, ChevronLeft } from "lucide-react";
import { Wordmark } from "./wordmark";

/**
 * Host auth layout (host 04a–e, D1–D1e). Desktop (≥1024): the auth split — a 640px brand panel
 * (dark gradient, Fraunces tagline) and the form centered in the rest, 420 wide. Mobile: a dark
 * photo header carrying the title, and the form in a white bottom sheet.
 *
 * The handoff's brand panel uses a balloon photograph; FiveFrames ships no stock photography,
 * so the panel keeps the same crop, gradient and hierarchy with an abstract five-frame motif.
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

const PANEL_FRAMES = [
  { rotate: "-8deg", top: "12%", left: "44%", w: 150 },
  { rotate: "6deg", top: "20%", left: "68%", w: 120 },
  { rotate: "-3deg", top: "36%", left: "56%", w: 170 },
  { rotate: "9deg", top: "8%", left: "18%", w: 110 },
  { rotate: "-5deg", top: "30%", left: "10%", w: 130 },
] as const;

function BrandPanel() {
  return (
    <aside className="ff-photo-header relative hidden min-h-dvh flex-col overflow-hidden px-12 py-12 text-ink-inverse lg:sticky lg:top-0 lg:flex lg:h-dvh">
      <div aria-hidden className="absolute inset-0">
        {PANEL_FRAMES.map((f, i) => (
          <span
            key={i}
            style={{ transform: `rotate(${f.rotate})`, top: f.top, left: f.left, width: f.w }}
            className="absolute aspect-[4/5] rounded-xl border border-white/25 bg-white/[0.06] backdrop-blur-[2px]"
          />
        ))}
        <span className="absolute inset-x-0 bottom-0 h-2/3 bg-linear-to-t from-surface-dark via-surface-dark/80 to-transparent" />
      </div>
      <Wordmark host tone="light" href="/" className="relative" />
      <div className="relative mt-auto flex flex-col gap-6">
        <p className="font-heading text-[48px] leading-[1.05] font-semibold tracking-[-0.01em]">
          Every guest.
          <br />
          Five frames.
          <br />
          One shared story.
        </p>
        <p className="max-w-[440px] text-[17px] leading-relaxed font-medium text-ink-inverse/85">
          Share one QR code and your guests capture the party from their own phones. You reveal
          the gallery when the moment’s right.
        </p>
        <ul className="flex flex-wrap gap-x-6 gap-y-2 text-label font-semibold">
          {["No app for guests", "No guest accounts", "Pay once per event"].map((item) => (
            <li key={item} className="flex items-center gap-2">
              <Check className="size-4 text-brand-highlight" aria-hidden />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </aside>
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
