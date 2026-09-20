"use server";

import { redirect } from "next/navigation";
import { createServerAuthClient } from "@/lib/supabase/server";

export type AuthActionState = { error: string | null; message?: string | null };

function isValidNext(next: FormDataEntryValue | null): next is string {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//");
}

export async function signUp(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const supabase = await createServerAuthClient();
  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    return { error: error.message };
  }

  // With email confirmation required (this project's default), signUp succeeds but
  // issues no session — the account isn't usable until the guest clicks the emailed
  // link. Redirecting into /dashboard here would just bounce straight back to /login.
  if (!data.session) {
    return {
      error: null,
      message: "Check your email to confirm your account, then sign in.",
    };
  }

  redirect("/dashboard");
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

export async function signOut() {
  const supabase = await createServerAuthClient();
  await supabase.auth.signOut();
  redirect("/login");
}
