import Link from "next/link";
import { requireHost } from "@/lib/auth/host-session";
import { signOut } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";

export default async function HostLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const host = await requireHost();

  return (
    <div className="host-scope flex min-h-dvh flex-col">
      <header className="flex items-center justify-between border-b border-(--host-border) bg-(--host-canvas-raised) px-4 py-3 sm:px-6">
        <Link
          href="/dashboard"
          className="font-host-display text-base font-semibold tracking-tight text-(--host-ink)"
        >
          FiveFrames
        </Link>
        <div className="flex items-center gap-3 text-sm text-(--host-ink-muted)">
          <span className="hidden sm:inline">{host.email}</span>
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
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        {children}
      </main>
    </div>
  );
}
