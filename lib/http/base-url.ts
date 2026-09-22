import "server-only";

import { headers } from "next/headers";

/**
 * Absolute origin for the current request, derived from the `host`/`x-forwarded-proto`
 * headers Vercel (and `next dev`) set — needed for PayMongo's `success_url`/`cancel_url`,
 * which must be absolute. Mirrors the client-side `window.location.origin` pattern
 * already used for copy-link (app/(host)/events/[eventId]/link-row.tsx), just server-side.
 */
export async function getRequestBaseUrl(): Promise<string> {
  const headerList = await headers();
  const host = headerList.get("host");
  const proto = headerList.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}
