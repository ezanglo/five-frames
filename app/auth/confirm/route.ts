import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createServerAuthClient } from "@/lib/supabase/server";

function safeNext(next: string | null): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
}

/**
 * Landing point for Supabase Auth email links (signup confirmation, password recovery).
 * Exchanges the link's PKCE `code` — or a `token_hash` + `type`, depending on the project's
 * email template — for a session on this browser, then forwards to `next`. A failed or expired
 * link never grants anything; it sends the host back to request a new one.
 *
 * A signup link that arrives with a `code` has already been verified by Supabase: the email is
 * confirmed even when the exchange fails, which it does whenever the link is opened in a
 * different browser from the one that signed up (the PKCE verifier lives in that browser's
 * cookie). That case says "confirmed, sign in", not "expired".
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const next = safeNext(searchParams.get("next"));
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const isSignup = searchParams.get("flow") === "signup" || type === "signup";
  const linkError = searchParams.get("error") ?? searchParams.get("error_code");

  const supabase = await createServerAuthClient();

  let ok = false;
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    ok = !error;
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    ok = !error;
  }

  if (ok) {
    return NextResponse.redirect(new URL(next, request.url));
  }

  if (isSignup && code && !linkError) {
    return NextResponse.redirect(new URL("/login?confirmed=1", request.url));
  }

  const failure = next === "/reset-password" ? "/forgot-password?expired=1" : "/login?link=expired";
  return NextResponse.redirect(new URL(failure, request.url));
}
