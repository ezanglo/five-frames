"use client";

import { useActionState } from "react";
import { signIn, type AuthActionState } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: AuthActionState = { error: null };

export function LoginForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState(signIn, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />

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
          autoComplete="current-password"
          className="border-(--host-border) bg-(--host-canvas)"
        />
      </div>

      {state.error && (
        <p className="text-sm text-(--host-danger)">{state.error}</p>
      )}

      <Button
        type="submit"
        disabled={pending}
        className="mt-2 bg-(--host-accent) text-(--host-accent-foreground) hover:bg-(--host-accent)/90"
      >
        {pending ? "Signing in..." : "Sign in"}
      </Button>
    </form>
  );
}
