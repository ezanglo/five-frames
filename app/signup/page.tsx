import Link from "next/link";
import { SignupForm } from "./signup-form";

export default function SignupPage() {
  return (
    <div className="host-scope flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-(--host-border) bg-(--host-canvas-raised) p-6">
        <h1 className="font-host-display text-xl font-semibold text-(--host-ink)">
          Create your host account
        </h1>
        <div className="mt-5 flex flex-col gap-4">
          <SignupForm />
          <p className="text-center text-sm text-(--host-ink-muted)">
            Already have an account?{" "}
            <Link
              href="/login"
              className="text-(--host-accent) underline-offset-4 hover:underline"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
