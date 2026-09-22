"use client";

import { useActionState } from "react";
import { CircleAlert } from "lucide-react";
import { recordManualRefundAction, type ManualRefundFormState } from "@/app/(operator)/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

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
    <form
      action={formAction}
      onSubmit={(e) => {
        if (
          !window.confirm(
            "Record this refund as completed? The event will return to unpaid and its link/QR will stop working immediately.",
          )
        ) {
          e.preventDefault();
        }
      }}
      className="flex flex-col gap-2.5 rounded-lg border border-(--operator-privileged)/25 bg-(--operator-privileged-surface) p-3"
    >
      <label className="flex flex-col gap-1 text-xs text-(--operator-ink-muted)">
        Note (optional)
        <Textarea
          name="note"
          placeholder="e.g. how the money was actually returned"
          rows={2}
        />
      </label>

      {state.status === "error" && (
        <p className="flex items-start gap-1.5 text-xs text-(--operator-privileged)">
          <CircleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0" />
          {state.message}
        </p>
      )}
      {state.status === "refunded" && (
        <p className="text-xs text-(--operator-ink-muted)">
          Refund recorded. The event is unpaid again and its link/QR no longer work.
        </p>
      )}

      <Button
        type="submit"
        size="sm"
        variant="secondary"
        disabled={pending}
        className="self-start"
      >
        {pending ? "Recording…" : "Record a refund"}
      </Button>
    </form>
  );
}
