import { AuthShell } from "@/components/ff/auth-shell";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in · FiveFrames" };

function isValidNext(next: string | undefined): next is string {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//");
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; link?: string }>;
}) {
  const { next, link } = await searchParams;

  return (
    <AuthShell title="Welcome back" subtitle="Sign in to manage your events and photos.">
      {link === "expired" && (
        <p className="rounded-lg bg-brand-tint p-4 text-caption font-medium text-ink-on-tint" role="status">
          That link has expired or was already used. Sign in, or request a new one.
        </p>
      )}
      <LoginForm next={isValidNext(next) ? next : "/dashboard"} />
    </AuthShell>
  );
}
