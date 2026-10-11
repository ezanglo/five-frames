import "server-only";

import { getEventByToken } from "@/lib/dal/events";
import { getGuestSessionIdFromCookie } from "@/lib/auth/guest-session";
import type { KeepsakeOutcome } from "@/lib/dal/keepsakes";
import { keepsakeResponse as respond } from "@/lib/keepsakes/respond";

/** The signed guest cookie's session for the event this token names, or null. */
export async function guestSessionForToken(token: string): Promise<string | null> {
  const event = await getEventByToken(token);
  if (!event) return null;
  return getGuestSessionIdFromCookie(token, event.id);
}

/** The shared contract (`lib/keepsakes/respond.ts`), with a way back to the guest's photos. */
export function keepsakeResponse(outcome: KeepsakeOutcome, request: Request, token: string): Response {
  return respond(outcome, request, { href: `/e/${encodeURIComponent(token)}`, label: "Back to your photos" });
}
