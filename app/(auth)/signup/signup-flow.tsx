"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Mail, User } from "lucide-react";
import { signUp, type AuthActionState } from "@/lib/auth/actions";
import { AuthShell, InboxIcon } from "@/components/ff/auth-shell";
import { Button } from "@/components/ff/button";
import { Field, TextInput } from "@/components/ff/field";
import { PasswordInput, PasswordStrengthMeter } from "@/components/ff/password-input";
import { CheckInbox } from "../check-inbox";

const initialState: AuthActionState = { error: null };

/** Host sign up (04b / D1). Email confirmation is required, so success shows "Check your inbox". */
export function SignupFlow() {
  const [state, formAction, pending] = useActionState(signUp, initialState);
  const [password, setPassword] = useState("");

  if (state.sentTo) {
    return (
      <AuthShell
        title="Check your inbox"
        subtitle={
          <>
            We sent a confirmation link to{" "}
            <span className="font-semibold max-lg:text-ink-inverse lg:text-ink">
              {state.sentTo}
            </span>
          </>
        }
        back={{ href: "/login", label: "Back to sign in" }}
        icon={
          <InboxIcon>
            <Mail />
          </InboxIcon>
        }
      >
        <CheckInbox email={state.sentTo} kind="signup" />
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Host your first event"
      subtitle="Free to start. Your guests never need an account."
    >
      <form action={formAction} className="flex flex-1 flex-col gap-5">
        <Field label="Full name" htmlFor="fullName">
          <TextInput
            id="fullName"
            name="fullName"
            required
            maxLength={80}
            autoComplete="name"
            placeholder="Your name"
            icon={<User />}
          />
        </Field>
        <Field label="Email" htmlFor="email">
          <TextInput
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            icon={<Mail />}
          />
        </Field>
        <Field label="Password" htmlFor="password">
          <PasswordInput
            id="password"
            name="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-describedby="password-strength"
          />
          <div id="password-strength">
            <PasswordStrengthMeter value={password} />
          </div>
        </Field>

        {state.error && (
          <p className="text-caption font-medium text-danger" role="alert">
            {state.error}
          </p>
        )}

        <div className="mt-auto flex flex-col gap-4 pt-2 lg:mt-2">
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? "Creating your account…" : "Sign up"}
          </Button>
          <p className="text-center text-label font-medium text-ink-muted">
            Already have an account?{" "}
            <Link href="/login" className="ff-focus rounded-md font-semibold text-brand hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </form>
    </AuthShell>
  );
}
