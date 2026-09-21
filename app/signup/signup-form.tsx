"use client";

import { useActionState } from "react";
import { signUp, type AuthActionState } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: AuthActionState = { error: null };

export function SignupForm() {
  const [state, formAction, pending] = useActionState(signUp, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="border-(--host-border) bg-(--host-canvas)"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="border-(--host-border) bg-(--host-canvas)"
        />
      </div>

      {state.error && (
        <p className="text-sm text-(--host-danger)">{state.error}</p>
      )}
      {state.message && (
        <p className="text-sm text-(--host-ink-muted)">{state.message}</p>
      )}

      <Button
        type="submit"
        disabled={pending}
        className="mt-2 bg-(--host-accent) text-(--host-accent-foreground) hover:bg-(--host-accent)/90"
      >
        {pending ? "Creating account..." : "Create account"}
      </Button>
    </form>
  );
}
