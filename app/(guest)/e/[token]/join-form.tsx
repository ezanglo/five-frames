"use client";

import { useActionState } from "react";
import { Clock, User } from "lucide-react";
import { joinEvent, type JoinActionState } from "./actions";
import { Button } from "@/components/ff/button";
import { Field, TextInput } from "@/components/ff/field";
import { ActionFootnote, SheetActions } from "@/components/ff/guest-shell";

const initialState: JoinActionState = { error: null };

/** Join (guest 01 · open): display name only — no account, no email, no OTP (product.md §6). */
export function JoinForm({ token }: { token: string }) {
  const boundJoin = joinEvent.bind(null, token);
  const [state, formAction, pending] = useActionState(boundJoin, initialState);

  if (state.atCapacity) {
    return (
      <p className="rounded-lg bg-surface-subtle p-4 text-body font-medium text-ink" role="status">
        This event just reached its guest capacity for now. Guests who already joined can keep
        capturing — check back with your host.
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-1 flex-col gap-5">
      <Field
        label="What should we call you?"
        htmlFor="displayName"
        error={state.error}
        errorId="displayName-error"
      >
        <TextInput
          id="displayName"
          name="displayName"
          required
          maxLength={60}
          autoComplete="given-name"
          placeholder="Your first name"
          icon={<User />}
          aria-invalid={state.error ? true : undefined}
          aria-describedby={state.error ? "displayName-error" : undefined}
        />
      </Field>

      <SheetActions>
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Joining…" : "Join & start shooting"}
        </Button>
        <ActionFootnote icon={<Clock />}>
          Open until your host closes capture · No app needed
        </ActionFootnote>
      </SheetActions>
    </form>
  );
}
