import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/**
 * Pure signing/verification for the guest session cookie value — split out from
 * lib/auth/guest-session.ts so it can be unit tested without Next's cookies() API.
 */

export function cookieNameForEventToken(eventToken: string): string {
  const hash = createHash("sha256").update(eventToken).digest("hex").slice(0, 16);
  return `ff_gs_${hash}`;
}

export function signGuestSession(
  secret: string,
  eventId: string,
  guestSessionId: string,
): string {
  const payload = `${eventId}.${guestSessionId}`;
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifyGuestSession(
  secret: string,
  value: string,
  eventId: string,
): string | null {
  const parts = value.split(".");
  if (parts.length !== 3) return null;
  const [payloadEventId, guestSessionId, signature] = parts;
  if (payloadEventId !== eventId) return null;

  const expected = createHmac("sha256", secret)
    .update(`${payloadEventId}.${guestSessionId}`)
    .digest("base64url");

  const expectedBuf = Buffer.from(expected);
  const actualBuf = Buffer.from(signature);
  if (expectedBuf.length !== actualBuf.length) return null;
  if (!timingSafeEqual(expectedBuf, actualBuf)) return null;

  return guestSessionId;
}
