import "server-only";

import { redirect } from "next/navigation";
import { createServerAuthClient } from "@/lib/supabase/server";

export type HostSession = {
  id: string;
  email: string;
};

/**
 * Verified host identity for the current request, or null if unauthenticated.
 * Uses getClaims(), which verifies the token's signature — the session cookie itself
 * is never trusted on its own (architecture §5, product invariant 9).
 */
export async function getAuthenticatedHost(): Promise<HostSession | null> {
  const supabase = await createServerAuthClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims) {
    return null;
  }

  return { id: data.claims.sub, email: data.claims.email as string };
}

/** Same as getAuthenticatedHost, but redirects to /login when unauthenticated. */
export async function requireHost(): Promise<HostSession> {
  const host = await getAuthenticatedHost();
  if (!host) {
    redirect("/login");
  }
  return host;
}
