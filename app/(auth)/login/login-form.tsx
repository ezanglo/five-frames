"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Mail } from "lucide-react";
import { signIn, type AuthActionState } from "@/lib/auth/actions";
import { Button } from "@/components/ff/button";
import { Field, TextInput } from "@/components/ff/field";
import { PasswordInput } from "@/components/ff/password-input";

const initialState: AuthActionState = { error: null };

/** Host sign in (04a / D1b): two fields and one violet button. */
export function LoginForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState(signIn, initialState);

  return (
    <form action={formAction} className="flex flex-1 flex-col gap-5">
      <input type="hidden" name="next" value={next} />

      <Field label="Email" htmlFor="email">
        <TextInput
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          icon={<Mail />}
          aria-invalid={state.error ? true : undefined}
        />
      </Field>

      <Field
        label="Password"
        htmlFor="password"
        aside={
          <Link
            href="/forgot-password"
            className="ff-focus rounded-md text-caption font-semibold text-brand hover:underline"
          >
            Forgot password?
          </Link>
        }
        error={state.error}
        errorId="login-error"
      >
        <PasswordInput
          id="password"
          name="password"
          required
          autoComplete="current-password"
          aria-invalid={state.error ? true : undefined}
          aria-describedby={state.error ? "login-error" : undefined}
        />
      </Field>

      <div className="mt-auto flex flex-col gap-4 pt-2 lg:mt-2">
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Signing in…" : "Sign in"}
        </Button>
        <p className="text-center text-label font-medium text-ink-muted">
          New to FiveFrames?{" "}
          <Link href="/signup" className="ff-focus rounded-md font-semibold text-brand hover:underline">
            Create an account
          </Link>
        </p>
      </div>
    </form>
  );
}
