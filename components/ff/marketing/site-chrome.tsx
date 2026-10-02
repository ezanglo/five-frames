import Link from "next/link";
import { ButtonLink } from "@/components/ff/button";
import { Wordmark } from "@/components/ff/wordmark";
import { PAYMENT_COPY } from "@/lib/marketing/content";
import { SALES_CONTACT } from "@/lib/payments/mode";
import { PUBLIC_NAV } from "@/lib/marketing/site";
import { DesktopNavLinks, MobileMenu } from "./site-nav";

/**
 * Public header — the host desktop top nav (DS04: 72h, white, 1px bottom border, tint pill for
 * the current page) without any authenticated controls. One primary action: Create an event.
 * Below 1024 it keeps the primary visible and folds everything else into the menu.
 */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur-md supports-[backdrop-filter]:bg-surface/85">
      <nav
        aria-label="Main"
        className="relative mx-auto flex h-16 w-full max-w-[1280px] items-center justify-between gap-3 px-5 lg:h-[72px] lg:px-10"
      >
        <div className="flex items-center gap-8">
          <Wordmark href="/" />
          <DesktopNavLinks />
        </div>
        <div className="flex items-center gap-2 lg:gap-3">
          <Link
            href="/login"
            className="ff-focus hidden h-9 items-center rounded-full px-4 text-label font-semibold text-ink-muted hover:text-ink lg:flex"
          >
            Sign in
          </Link>
          <ButtonLink href="/signup" size="sm" className="max-[359px]:hidden">
            Create an event
          </ButtonLink>
          <MobileMenu />
        </div>
      </nav>
    </header>
  );
}

/** Footer: only destinations that exist. Legal pages don't exist yet (a recorded content gap). */
export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-surface-subtle px-5 pt-14 pb-10 lg:px-10">
      <div className="mx-auto grid w-full max-w-[1200px] gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
        <div className="flex max-w-sm flex-col gap-3">
          <Wordmark href="/" />
          <p className="text-label font-medium text-ink-muted">
            Every guest gets five frames. You get one private collection from the day.
          </p>
        </div>
        <FooterColumn
          title="FiveFrames"
          links={PUBLIC_NAV.map((item) => ({ href: item.href, label: item.label }))}
        />
        <FooterColumn
          title="Hosts"
          links={[
            { href: "/signup", label: "Create an event" },
            { href: "/login", label: "Sign in" },
            { href: "/forgot-password", label: "Reset your password" },
            ...(SALES_CONTACT ? [SALES_CONTACT] : []),
          ]}
        />
      </div>
      <div className="mx-auto mt-12 flex w-full max-w-[1200px] flex-col gap-2 border-t border-line pt-6 text-caption font-medium text-ink-muted sm:flex-row sm:justify-between">
        <p>Prices in Philippine pesos. {PAYMENT_COPY.line}.</p>
        <p>© {new Date().getFullYear()} FiveFrames</p>
      </div>
    </footer>
  );
}

function FooterColumn({ title, links }: { title: string; links: { href: string; label: string }[] }) {
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-[11px] font-bold tracking-[0.08em] text-ink-muted uppercase">{title}</h2>
      <ul className="flex flex-col gap-1">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="ff-focus inline-flex min-h-10 items-center rounded-md text-label font-semibold text-ink hover:text-brand"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
