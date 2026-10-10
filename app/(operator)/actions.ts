"use server";

import { refresh } from "next/cache";
import { requireOperator } from "@/lib/auth/operator-session";
import {
  confirmManualPayment,
  recordManualRefund,
  type ManualPaymentInput,
} from "@/lib/dal/payments";
import { getEventForOperatorMutation } from "@/lib/dal/operator-events";
import {
  MAX_GUEST_SESSION_CAP,
  MAX_OVERRIDE_REASON_LENGTH,
  overrideGuestCapacity,
} from "@/lib/dal/capacity-overrides";
import { zonedDateTimeLocalToUtcIso } from "@/lib/events/timezone";
import { CURRENCY } from "@/lib/payments/pricing";
import { PLANS } from "@/lib/plans/registry";
import type { ManualPaymentMethod } from "@/lib/db/types";

/**
 * Operator Console mutations (product.md §5.1/§7.2/§15.1, architecture §8a/§8b). Every
 * action here calls `requireOperator()` itself — the DAL functions it delegates to only
 * enforce the ownership-conflict rule, trusting the caller already verified operator
 * status, the same split every other role boundary in this codebase uses.
 */

const MANUAL_METHODS: ManualPaymentMethod[] = ["cash", "bank_transfer", "e_wallet", "other"];

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
  const expectedPlan = String(formData.get("plan") ?? "");

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
  // The operator agreed an amount for the plan this page showed. If the host switched plans
  // since, confirming would activate a plan nobody priced (D24), so stop and show the new one.
  if (event.plan !== expectedPlan) {
    return {
      status: "error",
      message: event.plan
        ? `The host changed the plan to ${PLANS[event.plan].label} since this page loaded. Reload, check the amount, and confirm again.`
        : "The host hasn’t chosen a plan. Reload once they have.",
    };
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
    case "plan_not_chosen":
      return {
        status: "error",
        message: "The host hasn’t chosen a paid plan yet, so there’s nothing to confirm.",
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
    case "free_event":
      return {
        status: "error",
        message: "This is the host's Free event. Nothing was paid, so there is nothing to refund.",
      };
    case "refunded":
      return { status: "refunded" };
  }
}

export type CapacityOverrideFormState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "raised"; newCap: number };

/** Raises an event's guest capacity (product.md §9.5). Raise-only, with a required reason. */
export async function overrideGuestCapacityAction(
  eventId: string,
  _prevState: CapacityOverrideFormState,
  formData: FormData,
): Promise<CapacityOverrideFormState> {
  const operator = await requireOperator();

  const newCapRaw = String(formData.get("newCap") ?? "").trim();
  const newCap = Number(newCapRaw);
  const reason = String(formData.get("reason") ?? "");

  if (!newCapRaw || !Number.isInteger(newCap) || newCap < 1) {
    return { status: "error", message: "Enter the new capacity as a whole number of guests." };
  }

  const result = await overrideGuestCapacity(operator.id, eventId, { newCap, reason });

  switch (result.outcome) {
    case "raised":
      // The capacity tile and the history on this page re-render with the new entry.
      refresh();
      return { status: "raised", newCap: result.entry.new_cap };
    case "not_found":
      return { status: "error", message: "Event not found." };
    case "owns_event":
      return { status: "error", message: "You cannot raise capacity for an event you own." };
    case "not_activated":
      return {
        status: "error",
        message: "This event isn’t activated, so there’s no capacity to raise yet.",
      };
    case "not_a_raise":
      return {
        status: "error",
        message:
          result.currentCap !== undefined
            ? `Capacity is already ${result.currentCap} guests. Enter a higher number. It can only be raised.`
            : "Enter a number higher than the current capacity. It can only be raised.",
      };
    case "reason_required":
      return { status: "error", message: "Enter a reason. It’s kept in the event’s history." };
    case "reason_too_long":
      return {
        status: "error",
        message: `Keep the reason under ${MAX_OVERRIDE_REASON_LENGTH} characters.`,
      };
    case "cap_too_large":
      return {
        status: "error",
        message: `${MAX_GUEST_SESSION_CAP.toLocaleString("en-US")} guests is the most the Console allows. Check the number for a typo.`,
      };
    case "not_operator":
      return { status: "error", message: "Only an operator can raise capacity." };
  }
}
