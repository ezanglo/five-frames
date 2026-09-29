"use server";

import { redirect } from "next/navigation";
import { createServerAuthClient } from "@/lib/supabase/server";
import { getRequestBaseUrl } from "@/lib/http/base-url";

export type AuthActionState = {
  error: string | null;
  message?: string | null;
  /** Set once Supabase has accepted the request and an email is on its way. */
  sentTo?: string | null;
};

function isValidNext(next: FormDataEntryValue | null): next is string {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//");
}

const MIN_PASSWORD_LENGTH = 8;

export async function signUp(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const fullName = String(formData.get("fullName") ?? "").trim().slice(0, 80);
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!fullName) return { error: "Add your name so your events can greet you." };
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { error: `Use at least ${MIN_PASSWORD_LENGTH} characters for your password.` };
  }

  const supabase = await createServerAuthClient();
  // The name lives in the auth user's own metadata — a host-side greeting only; it is never
  // shown to guests.
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });

  if (error) {
    return { error: error.message };
  }

  // With email confirmation required (this project's default), signUp succeeds but issues
  // no session — the account isn't usable until the host clicks the emailed link.
  // Redirecting into /dashboard here would just bounce straight back to /login.
  if (!data.session) {
    return { error: null, sentTo: email };
  }

  redirect("/dashboard");
}

/** Re-sends the signup confirmation email. Same calm result whether or not it was needed. */
export async function resendSignupConfirmation(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "").trim();
  const supabase = await createServerAuthClient();
  const { error } = await supabase.auth.resend({ type: "signup", email });
  if (error && error.status === 429) {
    return { error: "Too many requests — wait a minute, then try again.", sentTo: email };
  }
  return { error: null, sentTo: email, message: "Sent again." };
}

export async function signIn(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const next = formData.get("next");

  const supabase = await createServerAuthClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: error.message };
  }

  redirect(isValidNext(next) ? next : "/dashboard");
}

/**
 * Starts a password reset. The confirmation is identical whether or not the address has an
 * account, so this can't be used to discover which emails are registered. The emailed link
 * returns through /auth/confirm, which exchanges it for a recovery session and forwards to
 * /reset-password.
 */
export async function requestPasswordReset(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: "Enter the email you signed up with." };

  const baseUrl = await getRequestBaseUrl();
  const supabase = await createServerAuthClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${baseUrl}/auth/confirm?next=/reset-password`,
  });

  if (error && error.status === 429) {
    return { error: "Too many requests — wait a minute, then try again.", sentTo: email };
  }

  return { error: null, sentTo: email };
}

/** Sets a new password for the recovery session /auth/confirm established. */
export async function updatePassword(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirmPassword") ?? "");

  if (password.length < MIN_PASSWORD_LENGTH) {
    return { error: `Use at least ${MIN_PASSWORD_LENGTH} characters.` };
  }
  if (password !== confirm) {
    return { error: "Those passwords don’t match." };
  }

  const supabase = await createServerAuthClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) {
    return { error: "This reset link has expired. Request a new one to continue." };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return { error: error.message };
  }

  redirect("/dashboard");
}

export async function signOut() {
  const supabase = await createServerAuthClient();
  await supabase.auth.signOut();
  redirect("/login");
}
