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
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b px-4 py-3">
        <Link href="/dashboard" className="font-semibold">
          FiveFrames
        </Link>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span>{host.email}</span>
          <form action={signOut}>
            <Button type="submit" variant="ghost" size="sm">
              Sign out
            </Button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-8">{children}</main>
    </div>
  );
}
