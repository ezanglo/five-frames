import "server-only";

import { createServiceClient } from "@/lib/supabase/service-client";

/**
 * The `operators` grant table (decision D15, architecture §5a). What makes an account
 * an operator is a row here, always read fresh from the database — never inferred from
 * a session claim. See lib/auth/operator-session.ts for the request-facing
 * requireOperator() wrapper; this module is deliberately free of any Next.js import so
 * it can also be called from `pnpm ops:grant-operator` outside a Next.js runtime.
 */

/** True iff the given Supabase Auth user id has an `operators` grant. */
export async function isOperator(userId: string): Promise<boolean> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("operators")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return data !== null;
}

/**
 * Grants operator status to a user id. Idempotent: granting an already-granted user is
 * a no-op, not an error. The only caller is `pnpm ops:grant-operator` — there is no
 * in-app path that calls this.
 */
export async function grantOperator(userId: string): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("operators")
    .upsert({ user_id: userId }, { onConflict: "user_id", ignoreDuplicates: true });

  if (error) throw error;
}
