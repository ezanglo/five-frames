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
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="displayName">Your name</Label>
        <Input
          id="displayName"
          name="displayName"
          required
          maxLength={60}
          autoComplete="name"
          placeholder="e.g. Ana"
        />
      </div>

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" disabled={pending}>
        {pending ? "Joining..." : "Start capturing"}
      </Button>
    </form>
  );
}
