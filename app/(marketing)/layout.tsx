import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/ff/marketing/site-chrome";
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/marketing/site";

export const metadata: Metadata = {
  title: { default: SITE_NAME, template: `%s · ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
};

/**
 * Public marketing surface (docs/design-direction.md → "Marketing site"). Static, server-rendered
 * pages on the contracted design system; no data access of any kind. The demo keeps its own
 * route group (decision D14) and guest shell, and is linked from here rather than wrapped.
 */
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      <a
        href="#main"
        className="ff-focus sr-only z-50 rounded-full bg-ink px-4 py-2 text-label font-semibold text-ink-inverse focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>
      <SiteHeader />
      <main id="main" className="flex flex-1 flex-col">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
