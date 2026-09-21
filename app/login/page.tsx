import Link from "next/link";
import { LoginForm } from "./login-form";

function isValidNext(next: string | undefined): next is string {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//");
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <div className="host-scope flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-(--host-border) bg-(--host-canvas-raised) p-6">
        <h1 className="font-host-display text-xl font-semibold text-(--host-ink)">
          Sign in
        </h1>
        <div className="mt-5 flex flex-col gap-4">
          <LoginForm next={isValidNext(next) ? next : "/dashboard"} />
          <p className="text-center text-sm text-(--host-ink-muted)">
            No account?{" "}
            <Link
              href="/signup"
              className="text-(--host-accent) underline-offset-4 hover:underline"
            >
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
