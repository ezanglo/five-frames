import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parseWebhookEventPayload, verifyWebhookSignature } from "./paymongo-client";

describe("verifyWebhookSignature", () => {
  const originalSecret = process.env.PAYMONGO_WEBHOOK_SECRET;

  beforeEach(() => {
    process.env.PAYMONGO_WEBHOOK_SECRET = "whsec_test_secret";
  });

  afterEach(() => {
    process.env.PAYMONGO_WEBHOOK_SECRET = originalSecret;
  });

  const TIMESTAMP = "1758542400";

  function sign(body: string, timestamp: string = TIMESTAMP): string {
    return createHmac("sha256", "whsec_test_secret")
      .update(`${timestamp}.${body}`)
      .digest("hex");
  }

  function testHeader(body: string, timestamp: string = TIMESTAMP): string {
    return `t=${timestamp},te=${sign(body, timestamp)},li=`;
  }

  it("accepts a correctly signed test-mode payload", () => {
    const body = JSON.stringify({ data: { id: "evt_1" } });
    expect(verifyWebhookSignature(body, testHeader(body))).toBe(true);
  });

  it("accepts a correctly signed live-mode payload", () => {
    const body = JSON.stringify({ data: { id: "evt_1" } });
    const header = `t=${TIMESTAMP},te=,li=${sign(body)}`;
    expect(verifyWebhookSignature(body, header)).toBe(true);
  });

  it("prefers the live-mode signature when both are present", () => {
    const body = JSON.stringify({ data: { id: "evt_1" } });
    const header = `t=${TIMESTAMP},te=not-the-real-signature,li=${sign(body)}`;
    expect(verifyWebhookSignature(body, header)).toBe(true);
  });

  it("rejects a tampered body against the original signature", () => {
    const body = JSON.stringify({ data: { id: "evt_1" } });
    const header = testHeader(body);
    const tamperedBody = JSON.stringify({ data: { id: "evt_2" } });
    expect(verifyWebhookSignature(tamperedBody, header)).toBe(false);
  });

  it("rejects a missing signature header", () => {
    const body = JSON.stringify({ data: { id: "evt_1" } });
    expect(verifyWebhookSignature(body, null)).toBe(false);
  });

  it("rejects a malformed header with too few parts", () => {
    const body = JSON.stringify({ data: { id: "evt_1" } });
    expect(verifyWebhookSignature(body, "not,enough")).toBe(false);
  });

  it("rejects a signature signed with the wrong secret", () => {
    const body = JSON.stringify({ data: { id: "evt_1" } });
    const wrongSignature = createHmac("sha256", "wrong_secret")
      .update(`${TIMESTAMP}.${body}`)
      .digest("hex");
    const header = `t=${TIMESTAMP},te=${wrongSignature},li=`;
    expect(verifyWebhookSignature(body, header)).toBe(false);
  });
});

describe("parseWebhookEventPayload", () => {
  it("extracts the event id, type, and nested checkout session", () => {
    const payload = JSON.stringify({
      data: {
        id: "evt_abc123",
        type: "event",
        attributes: {
          type: "checkout_session.payment.paid",
          livemode: false,
          data: {
            id: "cs_xyz789",
            type: "checkout_session",
            attributes: {
              reference_number: "event_abc",
              payments: [{ attributes: { amount: 99900, currency: "PHP", fee: 4500 } }],
            },
          },
        },
      },
    });

    const event = parseWebhookEventPayload(payload);
    expect(event.id).toBe("evt_abc123");
    expect(event.type).toBe("checkout_session.payment.paid");
    expect(event.livemode).toBe(false);
    expect(event.checkoutSession?.id).toBe("cs_xyz789");
    expect(event.checkoutSession?.referenceNumber).toBe("event_abc");
    expect(event.checkoutSession?.payments).toEqual([
      { amount: 99900, currency: "PHP", fee: 4500 },
    ]);
  });

  it("returns a null checkoutSession when the event carries no nested resource", () => {
    const payload = JSON.stringify({
      data: { id: "evt_1", attributes: { type: "payment.failed", livemode: false } },
    });
    const event = parseWebhookEventPayload(payload);
    expect(event.checkoutSession).toBeNull();
  });
});
