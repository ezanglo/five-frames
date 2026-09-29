"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Info, Mail } from "lucide-react";
import { requestPasswordReset, type AuthActionState } from "@/lib/auth/actions";
import { AuthShell, InboxIcon } from "@/components/ff/auth-shell";
import { Button } from "@/components/ff/button";
import { Field, TextInput } from "@/components/ff/field";
import { CheckInbox } from "../check-inbox";

const initialState: AuthActionState = { error: null };

/** Forgot password (04c / D1c) → Check your inbox (04d / D1d). */
export function ForgotFlow({ expired }: { expired: boolean }) {
  const [state, formAction, pending] = useActionState(requestPasswordReset, initialState);

  if (state.sentTo && !state.error) {
    return (
      <AuthShell
        title="Check your inbox"
        subtitle={
          <>
            We sent a reset link to{" "}
            <span className="font-semibold max-lg:text-ink-inverse lg:text-ink">{state.sentTo}</span>
          </>
        }
        back={{ href: "/login", label: "Back to sign in" }}
        icon={
          <InboxIcon>
            <Mail />
          </InboxIcon>
        }
      >
        <CheckInbox email={state.sentTo} kind="reset" />
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Forgot password?"
      subtitle="No worries — enter your email and we’ll send you a link to reset it."
      back={{ href: "/login", label: "Back to sign in" }}
    >
      <form action={formAction} className="flex flex-1 flex-col gap-5">
        {expired && (
          <p className="rounded-lg bg-brand-tint p-4 text-caption font-medium text-ink-on-tint" role="status">
            That reset link has expired or was already used. Request a new one below.
          </p>
        )}
        <Field label="Email" htmlFor="email" error={state.error}>
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
        <p className="flex items-start gap-2.5 rounded-lg bg-brand-tint p-4 text-caption font-medium text-ink-on-tint">
          <Info className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
          Use the email you signed up with. The link works for a limited time.
        </p>
        <div className="mt-auto flex flex-col gap-4 pt-2 lg:mt-2">
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? "Sending…" : "Send reset link"}
          </Button>
          <p className="text-center text-label font-medium text-ink-muted">
            Remembered it?{" "}
            <Link href="/login" className="ff-focus rounded-md font-semibold text-brand hover:underline">
              Back to sign in
            </Link>
          </p>
        </div>
      </form>
    </AuthShell>
  );
}
