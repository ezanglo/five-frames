"use client";

import { useActionState } from "react";
import { CircleAlert, CircleCheck } from "lucide-react";
import {
  overrideGuestCapacityAction,
  type CapacityOverrideFormState,
} from "@/app/(operator)/actions";
import { ConfirmSubmitButton } from "@/components/ff/confirm-button";
import { Field, TextArea, TextInput } from "@/components/ff/field";

const INITIAL_STATE: CapacityOverrideFormState = { status: "idle" };

/**
 * Raises an activated event's guest capacity (product.md §9.5). Raise-only, with a required
 * reason that goes into the event's permanent history. The browser limits are a convenience;
 * the action, the DAL and the SQL function each refuse a bad value on their own.
 */
export function CapacityOverrideForm({
  eventId,
  currentCap,
  maxCap,
  maxReasonLength,
}: {
  eventId: string;
  currentCap: number;
  maxCap: number;
  maxReasonLength: number;
}) {
  const [state, formAction, pending] = useActionState(
    overrideGuestCapacityAction.bind(null, eventId),
    INITIAL_STATE,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <p className="text-caption font-medium text-ink-muted">
        Raise-only. Guests already in the event aren&rsquo;t affected, and new guests can join
        straight away. The plan, price, hosted access and payment don&rsquo;t change.
      </p>

      <Field
        label="New capacity (guests)"
        htmlFor="newCap"
        hint={`Currently ${currentCap}. Up to ${maxCap.toLocaleString("en-US")}.`}
      >
        <TextInput
          id="newCap"
          name="newCap"
          type="number"
          inputMode="numeric"
          min={currentCap + 1}
          max={maxCap}
          step={1}
          required
          className="tabular"
        />
      </Field>

      <Field label="Reason" htmlFor="reason" hint="Kept in this event’s history. It can’t be edited later.">
        <TextArea
          id="reason"
          name="reason"
          required
          maxLength={maxReasonLength}
          placeholder="e.g. Wedding grew to 340, agreed with the couple on Viber"
          rows={2}
          className="min-h-20"
        />
      </Field>

      {state.status === "error" && (
        <p role="alert" className="flex items-start gap-2 text-caption font-medium text-danger">
          <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          {state.message}
        </p>
      )}
      {state.status === "raised" && (
        <p role="status" className="flex items-start gap-2 text-caption font-medium text-success">
          <CircleCheck aria-hidden className="mt-0.5 size-4 shrink-0" />
          Capacity raised to {state.newCap} guests. New guests can join now.
        </p>
      )}

      <ConfirmSubmitButton
        pending={pending}
        title="Raise this event’s capacity?"
        body="It can’t be lowered again, and the change and your reason are kept in the event’s history."
        confirmLabel="Raise capacity"
        className="w-full"
      >
        {pending ? "Raising…" : "Raise capacity"}
      </ConfirmSubmitButton>
    </form>
  );
}
