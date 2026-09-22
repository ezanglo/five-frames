import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Thin wrapper around the PayMongo v2 Checkout Sessions API (architecture §8). Test-mode
 * keys work immediately at signup, no KYC required — see docs.paymongo.com/docs/account-
 * settings-api-keys. Only what this slice needs: create a checkout session, and verify an
 * inbound webhook's signature. No SDK — PayMongo's REST API is small enough that a
 * dependency isn't justified for two calls.
 */

const PAYMONGO_API_BASE_V2 = "https://api.paymongo.com/v2";
const PAYMONGO_API_BASE_V1 = "https://api.paymongo.com/v1";

function secretKey(): string {
  const key = process.env.PAYMONGO_SECRET_KEY;
  if (!key) {
    throw new Error("PAYMONGO_SECRET_KEY is not set.");
  }
  return key;
}

function authHeader(): string {
  return `Basic ${Buffer.from(`${secretKey()}:`).toString("base64")}`;
}

export type CreateCheckoutSessionInput = {
  amountCentavos: number;
  currency: string;
  eventName: string;
  successUrl: string;
  cancelUrl: string;
  referenceNumber: string;
  metadata: Record<string, string>;
  /**
   * A stable id for this logical checkout attempt (the placeholder `payments.id` reserved
   * by `begin_provider_checkout`), sent as PayMongo's `Idempotency-Key` header
   * (docs.paymongo.com/reference/idempotent-requests — UUIDv4 or high-entropy string, up
   * to 255 chars, applies to resource-creation requests, cached 24h). A retried call for
   * the same payment id — e.g. our own network-error retry — returns the original
   * checkout session instead of creating a second one, a second independent layer on top
   * of `begin_provider_checkout`'s own DB-level one-active-session guard.
   */
  idempotencyKey: string;
};

export type CheckoutSession = {
  id: string;
  checkoutUrl: string;
};

/**
 * POST /v2/checkout_sessions. GCash, Maya, and cards are the required PH launch methods
 * (product.md §15); `pass_on_fees: false` keeps the price disclosed to the host the full
 * amount charged, with nothing derived from provider UI (architecture §8).
 */
export async function createCheckoutSession(
  input: CreateCheckoutSessionInput,
): Promise<CheckoutSession> {
  const response = await fetch(`${PAYMONGO_API_BASE_V2}/checkout_sessions`, {
    method: "POST",
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/json",
      "Idempotency-Key": input.idempotencyKey,
    },
    body: JSON.stringify({
      data: {
        attributes: {
          line_items: [
            {
              name: input.eventName,
              amount: input.amountCentavos,
              currency: input.currency,
              quantity: 1,
            },
          ],
          payment_method_types: ["gcash", "paymaya", "card"],
          success_url: input.successUrl,
          cancel_url: input.cancelUrl,
          reference_number: input.referenceNumber,
          description: `FiveFrames event: ${input.eventName}`,
          show_line_items: true,
          pass_on_fees: false,
          metadata: input.metadata,
        },
      },
    }),
  });

  const body = await response.json();
  if (!response.ok) {
    const message = body?.errors?.[0]?.detail ?? response.statusText;
    throw new Error(`PayMongo checkout session creation failed: ${message}`);
  }

  return {
    id: body.data.id,
    checkoutUrl: body.data.attributes.checkout_url,
  };
}

/**
 * GET /v1/checkout_sessions/{id}. Used only to check whether a session we're about to
 * reuse is still `active` — PayMongo's docs don't state whether sessions auto-expire
 * after some fixed time, so rather than assume a reused session is always still payable,
 * this confirms it directly before handing the URL back to the host.
 */
export async function getCheckoutSessionStatus(
  checkoutSessionId: string,
): Promise<"active" | "expired" | "unknown"> {
  const response = await fetch(`${PAYMONGO_API_BASE_V1}/checkout_sessions/${checkoutSessionId}`, {
    method: "GET",
    headers: { Authorization: authHeader() },
  });

  if (!response.ok) return "unknown";

  const body = await response.json();
  const status = body?.data?.attributes?.status;
  return status === "active" || status === "expired" ? status : "unknown";
}

/**
 * POST /v1/checkout_sessions/{id}/expire. Explicitly invalidates a Checkout Session so it
 * can no longer be paid — the `cancel_url` a host's browser is redirected to on "Cancel"
 * is only a browser redirect and never expires the session at PayMongo (product
 * requirement for this fix), so this is the only way to actually retire an obsolete
 * session. PayMongo itself refuses to expire a session that already has a paid or
 * in-flight payment (400), which is the behavior we want — we only ever call this on a
 * session we believe is still merely `pending` in our own bookkeeping, and a refusal here
 * is treated as a harmless no-op by the caller (best-effort; our own `payments` row is the
 * source of truth for whether we still treat the session as active).
 */
export async function expireCheckoutSession(checkoutSessionId: string): Promise<void> {
  const response = await fetch(
    `${PAYMONGO_API_BASE_V1}/checkout_sessions/${checkoutSessionId}/expire`,
    {
      method: "POST",
      headers: { Authorization: authHeader() },
    },
  );

  if (!response.ok && response.status !== 400 && response.status !== 404) {
    const body = await response.json().catch(() => null);
    const message = body?.errors?.[0]?.detail ?? response.statusText;
    throw new Error(`PayMongo checkout session expiry failed: ${message}`);
  }
}

/**
 * Verifies the `Paymongo-Signature` header against the raw request body. The header is
 * `t=<timestamp>,te=<test_signature>,li=<live_signature>` — not a bare hex digest — and
 * the signed payload is `{timestamp}.{raw_body}`, not the raw body alone. This is
 * confirmed against PayMongo's own official Node SDK source
 * (github.com/paymongo/paymongo-node, `src/services/Webhook.js`,
 * `WebhookService.prototype.constructEvent`), not the docs site — PayMongo's own webhook
 * docs describe the general HMAC-SHA256-over-the-raw-body idea but never state the header
 * layout or the timestamp-prefixed signed string, which caused an earlier version of this
 * function to reject every real delivery. Prefers the live-mode signature when present
 * (matching the SDK's own precedence), falling back to the test-mode one. Callers must
 * pass the untouched raw body string, never a re-serialized JSON object — any byte change
 * breaks the check on a legitimate request.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
): boolean {
  if (!signatureHeader) return false;

  const webhookSecret = process.env.PAYMONGO_WEBHOOK_SECRET;
  if (!webhookSecret) {
    throw new Error("PAYMONGO_WEBHOOK_SECRET is not set.");
  }

  const parts = signatureHeader.split(",").map((part) => part.trim());
  if (parts.length < 3) return false;

  const timestamp = parts[0].split("=")[1];
  const testSignature = parts[1].split("=")[1];
  const liveSignature = parts[2].split("=")[1];
  const comparisonSignature = liveSignature || testSignature;

  if (!timestamp || !comparisonSignature) return false;

  const expected = createHmac("sha256", webhookSecret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");
  const expectedBuffer = Buffer.from(expected, "utf-8");
  const actualBuffer = Buffer.from(comparisonSignature, "utf-8");

  if (expectedBuffer.length !== actualBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, actualBuffer);
}

/**
 * PayMongo's standard event envelope (docs.paymongo.com/docs/developer-tools-onboarding-
 * webhooks shows the shape): `data.id` is the event's own id (used for webhook-delivery
 * idempotency), `data.attributes.type` is the event name, `data.attributes.data` is the
 * nested resource the event is about — here, a checkout session.
 */
export type PaymongoWebhookEvent = {
  id: string;
  type: string;
  livemode: boolean;
  checkoutSession: {
    id: string;
    referenceNumber: string | null;
    payments: Array<{
      amount: number | null;
      currency: string | null;
      fee: number | null;
    }>;
  } | null;
};

export function parseWebhookEventPayload(rawBody: string): PaymongoWebhookEvent {
  const parsed = JSON.parse(rawBody);
  const event = parsed?.data;
  const attributes = event?.attributes ?? {};
  const session = attributes?.data;
  const sessionAttributes = session?.attributes ?? {};
  const payments = Array.isArray(sessionAttributes.payments)
    ? sessionAttributes.payments
    : [];

  return {
    id: event?.id,
    type: attributes?.type,
    livemode: Boolean(attributes?.livemode),
    checkoutSession: session
      ? {
          id: session.id,
          referenceNumber: sessionAttributes.reference_number ?? null,
          payments: payments.map((payment: { attributes?: Record<string, unknown> }) => ({
            amount: (payment?.attributes?.amount as number) ?? null,
            currency: (payment?.attributes?.currency as string) ?? null,
            fee: (payment?.attributes?.fee as number) ?? null,
          })),
        }
      : null,
  };
}
