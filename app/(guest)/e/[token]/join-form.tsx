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

  if (state.atCapacity) {
    return (
      <p className="text-sm text-(--guest-ink-muted)">
        This event just reached its guest capacity for now. Guests who already joined can
        keep capturing — check back with your host.
      </p>
    );
  }

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

      <p className="text-xs text-(--guest-ink-muted)">
        No app to download, no account to create — your captures follow this event&rsquo;s
        own access settings.
      </p>
    </form>
  );
}
