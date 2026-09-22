/**
 * Provisions the three reusable synthetic identities /e2e-validate needs (E2E host A,
 * E2E host B, E2E operator) so validation runs don't depend on real email confirmation.
 * Idempotent: rerunning it is a no-op for any identity that already exists.
 *
 * Test-infrastructure only — it never touches product code paths. It creates Auth
 * users directly via the Supabase Admin API with email_confirm: true (bypassing the
 * normal confirmation email, which providers only support through this admin
 * mechanism), which is what makes public.hosts rows appear via the existing
 * handle_new_host trigger (see supabase/migrations/20260920172934_host_account_and_draft_event.sql).
 * It never grants operator status itself — run `pnpm ops:grant-operator <email>` for
 * that, same as any real operator grant (decision D15).
 *
 * Reads credentials from the E2E_* variables in .env.local (see .env.example) rather
 * than generating or printing them, so this script never becomes a secret source.
 *
 * Usage: pnpm e2e:provision-identities
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadEnvLocal() {
  const envPath = path.resolve(import.meta.dirname, "..", ".env.local");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf-8").split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match && !process.env[match[1].trim()]) {
      process.env[match[1].trim()] = match[2].trim();
    }
  }
}

const IDENTITIES = [
  { label: "E2E host A", emailVar: "E2E_HOST_A_EMAIL", passwordVar: "E2E_HOST_A_PASSWORD" },
  { label: "E2E host B", emailVar: "E2E_HOST_B_EMAIL", passwordVar: "E2E_HOST_B_PASSWORD" },
  { label: "E2E operator", emailVar: "E2E_OPERATOR_EMAIL", passwordVar: "E2E_OPERATOR_PASSWORD" },
] as const;

async function main() {
  loadEnvLocal();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY must be set (.env.local).");
    process.exit(1);
  }

  // Refuse to run against anything that doesn't look like the dev project, so this
  // script can never accidentally create synthetic identities in a real environment.
  if (!url.includes("lrheuifbgbplekxnljfv")) {
    console.error(
      `Refusing: ${url} does not look like the five-frames-dev Supabase project. ` +
        "This script only provisions synthetic E2E identities in the dev/test environment.",
    );
    process.exit(1);
  }

  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  for (const { label, emailVar, passwordVar } of IDENTITIES) {
    const email = process.env[emailVar];
    const password = process.env[passwordVar];
    if (!email || !password) {
      console.error(`Skipping ${label}: ${emailVar} / ${passwordVar} not set in .env.local.`);
      continue;
    }

    const { data: existing, error: signInProbeError } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    if (signInProbeError) throw signInProbeError;
    const already = existing.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());

    if (already) {
      console.log(`${label}: already exists (${already.id}), skipping.`);
      continue;
    }

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error) throw error;
    console.log(`${label}: created (${data.user.id}).`);
  }

  console.log("Done. Grant operator status separately: pnpm ops:grant-operator <email>");
}

main();
