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
    <div className="operator-scope flex min-h-dvh flex-col">
      <header className="flex items-center justify-between border-b border-(--operator-border) bg-(--operator-canvas-raised) px-4 py-2.5 sm:px-6">
        <Link href="/operator" className="flex items-center gap-2">
          <span className="rounded-md bg-(--operator-ink) px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-(--operator-canvas-raised) uppercase">
            Internal
          </span>
          <span className="font-operator-display text-sm font-semibold tracking-tight text-(--operator-ink)">
            Operator Console
          </span>
        </Link>
        <div className="flex items-center gap-3 text-xs text-(--operator-ink-muted)">
          <span className="hidden sm:inline">{operator.email}</span>
          <form action={signOut}>
            <Button
              type="submit"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-(--operator-ink-muted) hover:bg-(--operator-surface) hover:text-(--operator-ink)"
            >
              Sign out
            </Button>
          </form>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        {children}
      </main>
    </div>
  );
}
