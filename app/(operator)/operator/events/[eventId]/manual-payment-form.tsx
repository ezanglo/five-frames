"use client";

import { useActionState } from "react";
import { CircleAlert, CircleCheck } from "lucide-react";
import { confirmManualPaymentAction, type ManualPaymentFormState } from "@/app/(operator)/actions";
import { ConfirmSubmitButton } from "@/components/ff/confirm-button";
import { Field, SelectInput, TextArea, TextInput } from "@/components/ff/field";
import { labelItems, MANUAL_PAYMENT_METHOD_LABEL } from "@/lib/events/labels";
import { EVENT_PRICE_PHP } from "@/lib/payments/pricing";

const INITIAL_STATE: ManualPaymentFormState = { status: "idle" };
const METHOD_ITEMS = labelItems(MANUAL_PAYMENT_METHOD_LABEL);

/**
 * Confirms a supplier-assisted/manual payment (product.md §7.2.1) — the operator records
 * exactly what was received, then this activates the event through the same shared path
 * a provider payment uses. Only rendered for a draft (not-yet-activated) event. "Payment
 * received at" is entered and interpreted in the event's own timezone (actions.ts).
 */
export function ManualPaymentForm({
  eventId,
  timezone,
  defaultPaidAt,
}: {
  eventId: string;
  timezone: string;
  defaultPaidAt: string;
}) {
  const [state, formAction, pending] = useActionState(
    confirmManualPaymentAction.bind(null, eventId),
    INITIAL_STATE,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Method" htmlFor="method">
          <SelectInput id="method" name="method" required defaultValue="cash">
            {METHOD_ITEMS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field label="Amount (₱)" htmlFor="amount">
          <TextInput
            id="amount"
            name="amount"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            required
            defaultValue={EVENT_PRICE_PHP}
            className="tabular"
          />
        </Field>
      </div>

      <Field
        label="Payment received at"
        htmlFor="paidAt"
        hint={`In the event’s timezone (${timezone.replaceAll("_", " ")}).`}
      >
        <TextInput
          id="paidAt"
          name="paidAt"
          type="datetime-local"
          required
          defaultValue={defaultPaidAt}
        />
      </Field>

      <Field label="Reference / note" htmlFor="referenceNote" optional>
        <TextArea
          id="referenceNote"
          name="referenceNote"
          placeholder="e.g. bank reference, who arranged the sale"
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
      {state.status === "duplicate" && (
        <p role="alert" className="flex items-start gap-2 text-caption font-medium text-danger">
          <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          Recorded, but this event was already activated by a different payment — this one did
          not activate it. Review it as a duplicate under Payment.
        </p>
      )}
      {state.status === "activated" && (
        <p role="status" className="flex items-start gap-2 text-caption font-medium text-success">
          <CircleCheck aria-hidden className="mt-0.5 size-4 shrink-0" />
          Confirmed — the event is now active and its link and QR are issued.
        </p>
      )}

      <ConfirmSubmitButton
        pending={pending}
        title="Confirm this manual payment?"
        body="This activates the event and issues its guest link and QR immediately."
        confirmLabel="Confirm payment"
        className="w-full"
      >
        {pending ? "Confirming…" : "Confirm manual payment"}
      </ConfirmSubmitButton>
    </form>
  );
}
