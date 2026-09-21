import "server-only";

import { cookies } from "next/headers";
import {
  cookieNameForEventToken,
  signGuestSession,
  verifyGuestSession,
} from "@/lib/auth/guest-session-token";

/**
 * Guest identity is our own signed cookie, never Supabase anonymous auth (decision D3).
 * httpOnly + Secure + SameSite=Lax, scoped to one event, carrying the guest_session_id —
 * signed so a guest can't forge a different session's id even though it's already a UUID.
 * One cookie name per event token, so a browser can hold sessions for several events at
 * once without collision.
 */

function secret(): string {
  const value = process.env.GUEST_SESSION_SECRET;
  if (!value) {
    throw new Error("GUEST_SESSION_SECRET is not set");
  }
  return value;
}

export async function getGuestSessionIdFromCookie(
  eventToken: string,
  eventId: string,
): Promise<string | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(cookieNameForEventToken(eventToken))?.value;
  if (!raw) return null;
  return verifyGuestSession(secret(), raw, eventId);
}

export async function setGuestSessionCookie(
  eventToken: string,
  eventId: string,
  guestSessionId: string,
): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(
    cookieNameForEventToken(eventToken),
    signGuestSession(secret(), eventId, guestSessionId),
    {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 400,
    },
  );
}
