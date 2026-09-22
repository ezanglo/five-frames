"use server";

import { requireOperator } from "@/lib/auth/operator-session";
import {
  confirmManualPayment,
  recordManualRefund,
  type ManualPaymentInput,
} from "@/lib/dal/payments";
import { getEventForOperatorMutation } from "@/lib/dal/operator-events";
import { zonedDateTimeLocalToUtcIso } from "@/lib/events/timezone";
import { CURRENCY } from "@/lib/payments/pricing";
import type { ManualPaymentMethod } from "@/lib/db/types";

/**
 * Operator Console mutations (product.md §5.1/§7.2/§15.1, architecture §8a/§8b). Every
 * action here calls `requireOperator()` itself — the DAL functions it delegates to only
 * enforce the ownership-conflict rule, trusting the caller already verified operator
 * status, the same split every other role boundary in this codebase uses.
 */

const MANUAL_METHODS: ManualPaymentMethod[] = ["cash", "bank_transfer", "other"];

export type ManualPaymentFormState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "activated" }
  | { status: "duplicate" };

export async function confirmManualPaymentAction(
  eventId: string,
  _prevState: ManualPaymentFormState,
  formData: FormData,
): Promise<ManualPaymentFormState> {
  const operator = await requireOperator();

  const methodRaw = String(formData.get("method") ?? "");
  const method = MANUAL_METHODS.includes(methodRaw as ManualPaymentMethod)
    ? (methodRaw as ManualPaymentMethod)
    : null;
  const amountPhp = Number(formData.get("amount"));
  const paidAtLocal = String(formData.get("paidAt") ?? "").trim();
  const referenceNote = String(formData.get("referenceNote") ?? "").trim() || null;

  if (!method) {
    return { status: "error", message: "Choose a payment method." };
  }
  if (!Number.isFinite(amountPhp) || amountPhp <= 0) {
    return { status: "error", message: "Enter a valid amount." };
  }
  if (!paidAtLocal) {
    return { status: "error", message: "Enter when the payment was received." };
  }

  const event = await getEventForOperatorMutation(eventId);
  if (!event) {
    return { status: "error", message: "Event not found." };
  }

  const input: ManualPaymentInput = {
    method,
    amountCentavos: Math.round(amountPhp * 100),
    currency: CURRENCY,
    // Interpreted in the event's own timezone, same convention as every other
    // operator-entered local datetime in this codebase (see lib/events/timezone.ts) —
    // a bare `new Date(paidAtLocal)` would silently use the server process's own
    // timezone instead.
    paidAtIso: zonedDateTimeLocalToUtcIso(paidAtLocal, event.timezone),
    referenceNote,
  };

  const result = await confirmManualPayment(operator.id, eventId, input);

  switch (result.outcome) {
    case "not_found":
      return { status: "error", message: "Event not found." };
    case "owns_event":
      return {
        status: "error",
        message: "You cannot confirm payment for an event you own.",
      };
    case "already_activated":
      return {
        status: "error",
        message: "This event is already activated — nothing to confirm.",
      };
    case "activated":
      return { status: "activated" };
    case "duplicate":
      return { status: "duplicate" };
  }
}

export type ManualRefundFormState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "refunded" };

export async function recordManualRefundAction(
  eventId: string,
  _prevState: ManualRefundFormState,
  formData: FormData,
): Promise<ManualRefundFormState> {
  const operator = await requireOperator();
  const note = String(formData.get("note") ?? "").trim() || null;

  const result = await recordManualRefund(operator.id, eventId, { note });

  switch (result.outcome) {
    case "not_found":
      return { status: "error", message: "Event not found." };
    case "owns_event":
      return {
        status: "error",
        message: "You cannot record a refund for an event you own.",
      };
    case "not_activated":
      return {
        status: "error",
        message: "This event isn't currently paid/active — nothing to refund.",
      };
    case "refunded":
      return { status: "refunded" };
  }
}
