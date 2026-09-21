import "server-only";

import { notFound, redirect } from "next/navigation";
import { createServerAuthClient } from "@/lib/supabase/server";
import { isOperator } from "@/lib/dal/operators";

/**
 * Operator Console request-facing session checks, structurally parallel to
 * lib/auth/host-session.ts. Kept separate from lib/dal/operators.ts (which does the
 * actual `operators` table read) because that module must stay importable from
 * `pnpm ops:grant-operator`, which runs outside a Next.js request and can't resolve
 * next/navigation.
 */

export type OperatorSession = {
  id: string;
  email: string;
};

/**
 * Verified operator identity for the current request, or null if the signed-in user
 * (if any) is not an operator. Uses getClaims(), which verifies the token's signature —
 * the session cookie itself is never trusted on its own (architecture §5/§5a).
 */
export async function getAuthenticatedOperator(): Promise<OperatorSession | null> {
  const supabase = await createServerAuthClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims) {
    return null;
  }

  const userId = data.claims.sub;
  if (!(await isOperator(userId))) {
    return null;
  }

  return { id: userId, email: data.claims.email as string };
}

/**
 * Same as getAuthenticatedOperator, but enforces access for an Operator Console route:
 * redirects an unauthenticated visitor to sign in, and 404s an authenticated but
 * unauthorized one (e.g. an ordinary host with no operator grant) rather than revealing
 * the Console exists.
 */
export async function requireOperator(): Promise<OperatorSession> {
  const supabase = await createServerAuthClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims) {
    redirect("/login?next=/operator");
  }

  const userId = data.claims.sub;
  if (!(await isOperator(userId))) {
    notFound();
  }

  return { id: userId, email: data.claims.email as string };
}
