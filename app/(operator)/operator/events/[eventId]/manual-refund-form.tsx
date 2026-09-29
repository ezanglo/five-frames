"use client";

import { useActionState } from "react";
import { CircleAlert, CircleCheck } from "lucide-react";
import { recordManualRefundAction, type ManualRefundFormState } from "@/app/(operator)/actions";
import { ConfirmSubmitButton } from "@/components/ff/confirm-button";
import { Field, TextArea } from "@/components/ff/field";

const INITIAL_STATE: ManualRefundFormState = { status: "idle" };

/**
 * Records a manually executed refund (product.md §15.1) — returns the event to unpaid
 * and disables its links. Only rendered for a currently activated event.
 */
export function ManualRefundForm({ eventId }: { eventId: string }) {
  const [state, formAction, pending] = useActionState(
    recordManualRefundAction.bind(null, eventId),
    INITIAL_STATE,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <p className="text-caption font-medium text-ink-muted">
        Only after the money has actually been returned. The event goes back to unpaid and its
        guest link and QR stop working immediately.
      </p>

      <Field label="Note" htmlFor="note" optional>
        <TextArea
          id="note"
          name="note"
          placeholder="e.g. how the money was actually returned"
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
      {state.status === "refunded" && (
        <p role="status" className="flex items-start gap-2 text-caption font-medium text-success">
          <CircleCheck aria-hidden className="mt-0.5 size-4 shrink-0" />
          Refund recorded. The event is unpaid again and its link and QR no longer work.
        </p>
      )}

      <ConfirmSubmitButton
        pending={pending}
        variant="danger"
        destructive
        title="Record this refund as completed?"
        body="The event returns to unpaid and its guest link and QR stop working immediately."
        confirmLabel="Record refund"
        className="w-full"
      >
        {pending ? "Recording…" : "Record a refund"}
      </ConfirmSubmitButton>
    </form>
  );
}
