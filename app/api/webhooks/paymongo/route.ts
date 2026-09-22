import { NextResponse, type NextRequest } from "next/server";
import {
  parseWebhookEventPayload,
  verifyWebhookSignature,
} from "@/lib/payments/paymongo-client";
import { recordProviderWebhookAndActivate } from "@/lib/dal/payments";

/**
 * Signed PayMongo webhook → activation (architecture §8). Activation is webhook-driven,
 * never redirect-driven: a host who closes the browser mid-redirect still gets an
 * activated event, and a forged redirect activates nothing (invariant 7).
 *
 * The raw body is read once, before any JSON parsing, and verified against the
 * `Paymongo-Signature` header first — any byte change before verification breaks the
 * check on a legitimate request (PayMongo's go-live checklist). An unsigned or
 * wrongly-signed request is rejected with 401 before anything else runs.
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("Paymongo-Signature");

  let verified: boolean;
  try {
    verified = verifyWebhookSignature(rawBody, signature);
  } catch (error) {
    console.error("PayMongo webhook: signature verification unavailable", error);
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  if (!verified) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event;
  try {
    event = parseWebhookEventPayload(rawBody);
  } catch (error) {
    console.error("PayMongo webhook: malformed payload", error);
    return NextResponse.json({ error: "Malformed payload" }, { status: 400 });
  }

  try {
    await recordProviderWebhookAndActivate(event);
  } catch (error) {
    console.error("PayMongo webhook: failed to process", error);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
