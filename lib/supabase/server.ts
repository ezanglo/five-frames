import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Auth-capable Supabase client for Server Components/Actions, scoped to the current
 * request's cookies. Uses the publishable key — this is what runs `supabase.auth.*`,
 * never table queries. See lib/dal/ for the service-role client that touches data.
 */
export async function createServerAuthClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component, which can't write cookies.
            // The Proxy is responsible for refreshing the session in that case.
          }
        },
      },
    },
  );
}
