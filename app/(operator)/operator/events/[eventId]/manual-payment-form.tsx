"use client";

import { useActionState } from "react";
import { CircleAlert } from "lucide-react";
import { confirmManualPaymentAction, type ManualPaymentFormState } from "@/app/(operator)/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { EVENT_PRICE_PHP } from "@/lib/payments/pricing";

const INITIAL_STATE: ManualPaymentFormState = { status: "idle" };

function nowAsLocalDateTime(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

/**
 * Confirms a supplier-assisted/manual payment (product.md §7.2.1) — the operator records
 * exactly what was received, then this activates the event through the same shared path
 * a provider payment uses. Only rendered for a draft (not-yet-activated) event.
 */
export function ManualPaymentForm({ eventId }: { eventId: string }) {
  const [state, formAction, pending] = useActionState(
    confirmManualPaymentAction.bind(null, eventId),
    INITIAL_STATE,
  );

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (
          !window.confirm(
            "Confirm this manual payment? This will activate the event and issue its link and QR immediately.",
          )
        ) {
          e.preventDefault();
        }
      }}
      className="flex flex-col gap-2.5 rounded-lg border border-(--operator-privileged)/25 bg-(--operator-privileged-surface) p-3"
    >
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-xs text-(--operator-ink-muted)">
          Method
          <select
            name="method"
            required
            defaultValue="cash"
            className="h-8 rounded-lg border border-(--operator-border) bg-transparent px-2 text-sm text-(--operator-ink)"
          >
            <option value="cash">Cash</option>
            <option value="bank_transfer">Bank transfer (verified)</option>
            <option value="other">Other (explicitly agreed)</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-(--operator-ink-muted)">
          Amount (₱)
          <Input
            name="amount"
            type="number"
            min="0"
            step="0.01"
            required
            defaultValue={EVENT_PRICE_PHP}
          />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-xs text-(--operator-ink-muted)">
        Payment received at
        <Input name="paidAt" type="datetime-local" required defaultValue={nowAsLocalDateTime()} />
      </label>

      <label className="flex flex-col gap-1 text-xs text-(--operator-ink-muted)">
        Reference / note (optional)
        <Textarea
          name="referenceNote"
          placeholder="e.g. bank reference, who arranged the sale"
          rows={2}
        />
      </label>

      {state.status === "error" && (
        <p className="flex items-start gap-1.5 text-xs text-(--operator-privileged)">
          <CircleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0" />
          {state.message}
        </p>
      )}
      {state.status === "duplicate" && (
        <p className="flex items-start gap-1.5 text-xs text-(--operator-privileged)">
          <CircleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0" />
          Recorded, but this event was already activated by a different payment — this one
          did not activate it. Review it as a duplicate payment below.
        </p>
      )}
      {state.status === "activated" && (
        <p className="text-xs text-(--operator-ink-muted)">
          Confirmed — the event is now active and its link/QR are issued.
        </p>
      )}

      <Button type="submit" size="sm" disabled={pending} className="self-start">
        {pending ? "Confirming…" : "Confirm manual payment"}
      </Button>
    </form>
  );
}
