/**
 * Development-only stand-in for payment (roadmap Slice 2, architecture §13). Activates an
 * event directly against the linked dev database — sets activated_at, issues event_token
 * and gallery_token, and opens capture — so the guest capture flow can be built and tested
 * before Slice 6 wires up real PayMongo activation. Never run against production: it talks
 * only to whatever project .env.local points at, and there is no route or UI path in the
 * application itself that can trigger this (invariant 7 stays intact in the shipped app).
 *
 * Usage: pnpm dev:activate-event <eventId>
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { generateLinkToken } from "@/lib/auth/link-tokens";

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

async function main() {
  loadEnvLocal();

  const eventId = process.argv[2];
  if (!eventId) {
    console.error("Usage: pnpm dev:activate-event <eventId>");
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY must be set (.env.local).");
    process.exit(1);
  }

  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("events")
    .update({
      event_token: generateLinkToken(),
      gallery_token: generateLinkToken(),
      activated_at: now,
      capture_opened_at: now,
      safety_net_closes_at: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
      hosted_until: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    })
    .eq("id", eventId)
    .select()
    .maybeSingle();

  if (error) {
    console.error(error.message);
    process.exit(1);
  }
  if (!data) {
    console.error(`No event with id ${eventId}`);
    process.exit(1);
  }

  console.log(`Activated: ${data.name}`);
  console.log(`Capture link: /e/${data.event_token}`);
  console.log(`Gallery link: /g/${data.gallery_token}`);
}

main();
