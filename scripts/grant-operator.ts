/**
 * The sanctioned way to grant operator status (decision D15, architecture §5a). Checked
 * into the repo, reviewable, and runnable only by whoever already holds the service-role
 * credential — the same trust boundary as running a migration. There is no in-app or
 * self-service path that grants operator status; this script is the only one.
 *
 * The target user must already have a Supabase Auth account (signed up the normal way,
 * as a host would) — this script only grants the operator role, it never creates
 * accounts, so an unrecognized email fails loudly instead of silently doing nothing.
 *
 * Before writing, it prints exactly which Supabase project it resolved (from whichever
 * environment variables are set) and requires an interactive "yes" — the same
 * confirmation step for both a local dev project and a real production project, so
 * there is no separate "prod mode" flag to forget. Point it at production by exporting
 * the production SUPABASE_SECRET_KEY / NEXT_PUBLIC_SUPABASE_URL in the shell before
 * running it (e.g. via `vercel env pull`), not by editing this script.
 *
 * Usage: pnpm ops:grant-operator <email>
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import { createClient } from "@supabase/supabase-js";
import { grantOperator } from "@/lib/dal/operators";

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

async function findUserIdByEmail(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  email: string,
): Promise<string | null> {
  // No admin.getUserByEmail in supabase-js; page through admin.listUsers instead.
  // Fine at this project's operator-account scale (product.md §19: expected ~1).
  let page = 1;
  const perPage = 200;
  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const match = data.users.find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (u: any) => u.email?.toLowerCase() === email.toLowerCase(),
    );
    if (match) return match.id;
    if (data.users.length < perPage) return null;
    page += 1;
  }
}

async function main() {
  loadEnvLocal();

  const email = process.argv[2]?.trim();
  if (!email) {
    console.error("Usage: pnpm ops:grant-operator <email>");
    process.exit(1);
  }
  if (!email.includes("@")) {
    console.error(`Refusing: "${email}" does not look like an email address.`);
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    console.error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY must be set (.env.local, or exported for production).",
    );
    process.exit(1);
  }

  console.log(`Target Supabase project: ${url}`);
  console.log(`Granting operator status to: ${email}`);
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question('Type "yes" to continue: ');
  rl.close();
  if (answer.trim().toLowerCase() !== "yes") {
    console.log("Aborted.");
    process.exit(1);
  }

  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const userId = await findUserIdByEmail(supabase, email);
  if (!userId) {
    console.error(
      `No Supabase Auth user found for ${email}. They must sign up (e.g. as a host) before being granted operator status.`,
    );
    process.exit(1);
  }

  await grantOperator(userId);
  console.log(`Done. ${email} (${userId}) is now an operator.`);
}

main();
