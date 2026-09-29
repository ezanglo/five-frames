"use client";

import { useActionState, useState } from "react";
import { updatePassword, type AuthActionState } from "@/lib/auth/actions";
import { Button } from "@/components/ff/button";
import { Field } from "@/components/ff/field";
import { PasswordInput, PasswordStrengthMeter } from "@/components/ff/password-input";

const initialState: AuthActionState = { error: null };

/** New password (04e / D1e): rules shown up front; confirm shows a check when it matches. */
export function NewPasswordForm() {
  const [state, formAction, pending] = useActionState(updatePassword, initialState);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const matches = confirm.length > 0 && confirm === password;

  return (
    <form action={formAction} className="flex flex-1 flex-col gap-5">
      <Field label="New password" htmlFor="password">
        <PasswordInput
          id="password"
          name="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <PasswordStrengthMeter value={password} />
      </Field>
      <Field
        label="Confirm password"
        htmlFor="confirmPassword"
        hint={matches ? "Passwords match" : undefined}
      >
        <PasswordInput
          id="confirmPassword"
          name="confirmPassword"
          required
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          matched={matches}
        />
      </Field>
      {state.error && (
        <p className="text-caption font-medium text-danger" role="alert">
          {state.error}
        </p>
      )}
      <div className="mt-auto pt-2 lg:mt-2">
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Saving…" : "Save & sign in"}
        </Button>
      </div>
    </form>
  );
}
