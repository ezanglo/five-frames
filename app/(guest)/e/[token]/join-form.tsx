"use client";

import { useActionState } from "react";
import { joinEvent, type JoinActionState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: JoinActionState = { error: null };

export function JoinForm({ token }: { token: string }) {
  const boundJoin = joinEvent.bind(null, token);
  const [state, formAction, pending] = useActionState(boundJoin, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor="displayName" className="text-(--guest-ink-muted)">
          Your name
        </Label>
        <Input
          id="displayName"
          name="displayName"
          required
          maxLength={60}
          autoComplete="name"
          placeholder="e.g. Ana"
          className="h-12 border-(--guest-border) bg-(--guest-canvas-raised) text-base"
        />
      </div>

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}

      <Button
        type="submit"
        disabled={pending}
        className="h-12 bg-(--guest-accent) text-base text-(--guest-accent-foreground) hover:bg-(--guest-accent)/90"
      >
        {pending ? "Joining..." : "Start capturing"}
      </Button>
    </form>
  );
}
