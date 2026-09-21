import { describe, expect, it } from "vitest";
import {
  cookieNameForEventToken,
  signGuestSession,
  verifyGuestSession,
} from "@/lib/auth/guest-session-token";

describe("guest session cookie signing", () => {
  const secret = "test-secret";
  const eventId = "11111111-1111-1111-1111-111111111111";
  const guestSessionId = "22222222-2222-2222-2222-222222222222";

  it("round-trips a signed value", () => {
    const value = signGuestSession(secret, eventId, guestSessionId);
    expect(verifyGuestSession(secret, value, eventId)).toBe(guestSessionId);
  });

  it("rejects a value signed for a different event", () => {
    const value = signGuestSession(secret, eventId, guestSessionId);
    expect(verifyGuestSession(secret, value, "other-event")).toBeNull();
  });

  it("rejects a tampered guest session id", () => {
    const value = signGuestSession(secret, eventId, guestSessionId);
    const [, , signature] = value.split(".");
    const forged = `${eventId}.33333333-3333-3333-3333-333333333333.${signature}`;
    expect(verifyGuestSession(secret, forged, eventId)).toBeNull();
  });

  it("rejects a value signed with a different secret", () => {
    const value = signGuestSession("other-secret", eventId, guestSessionId);
    expect(verifyGuestSession(secret, value, eventId)).toBeNull();
  });

  it("rejects malformed values", () => {
    expect(verifyGuestSession(secret, "not-a-valid-cookie", eventId)).toBeNull();
  });

  it("derives a stable, distinct cookie name per event token", () => {
    const nameA = cookieNameForEventToken("token-a");
    const nameB = cookieNameForEventToken("token-b");
    expect(nameA).not.toBe(nameB);
    expect(cookieNameForEventToken("token-a")).toBe(nameA);
  });
});
