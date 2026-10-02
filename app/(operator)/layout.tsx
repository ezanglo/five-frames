import { requireOperator } from "@/lib/auth/operator-session";
import { AccountMenu } from "@/components/ff/host/account-menu";
import { Wordmark } from "@/components/ff/wordmark";
import { OperatorNav } from "./operator-nav";

/**
 * Operator Console chrome. The console is internal and outside the contracted handoff's screen
 * inventory, so it borrows the host desktop template (DS04 top nav, DS06 grey page + white
 * cards, 1200 content column) at every width rather than inventing its own look. The OPERATOR
 * tag is ink, not violet, so it never reads as the host product.
 */
export default async function OperatorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const operator = await requireOperator();

  return (
    <div className="flex min-h-dvh flex-col bg-surface-subtle">
      <nav
        aria-label="Operator"
        className="ff-safe-top sticky top-0 z-20 border-b border-line bg-surface"
      >
        <div className="flex h-16 items-center justify-between gap-4 px-5 lg:h-[72px] lg:px-10">
          <div className="flex min-w-0 items-center gap-3 sm:gap-6 lg:gap-8">
            <Wordmark operator href="/operator" />
            <OperatorNav />
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-caption font-medium text-ink-muted md:inline">
              {operator.email}
            </span>
            <AccountMenu name={null} email={operator.email} />
          </div>
        </div>
      </nav>
      <main className="ff-safe-bottom mx-auto flex w-full max-w-[1280px] flex-1 flex-col px-5 pt-6 lg:px-10 lg:pt-10 lg:pb-16">
        {children}
      </main>
    </div>
  );
}
