import Link from "next/link";
import { requireOperator } from "@/lib/auth/operator-session";
import { signOut } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";

export default async function OperatorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const operator = await requireOperator();

  return (
    <div className="host-scope flex min-h-dvh flex-col">
      <header className="flex items-center justify-between border-b border-(--host-border) bg-(--host-canvas-raised) px-4 py-3 sm:px-6">
        <Link
          href="/operator"
          className="font-host-display text-base font-semibold tracking-tight text-(--host-ink)"
        >
          FiveFrames Operator Console
        </Link>
        <div className="flex items-center gap-3 text-sm text-(--host-ink-muted)">
          <span className="hidden sm:inline">{operator.email}</span>
          <form action={signOut}>
            <Button
              type="submit"
              variant="ghost"
              size="sm"
              className="text-(--host-ink-muted) hover:bg-(--host-surface) hover:text-(--host-ink)"
            >
              Sign out
            </Button>
          </form>
        </div>
      </header>
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        {children}
      </main>
    </div>
  );
}
