/**
 * One-off, idempotent cleanup for decision D19 (architecture §7b "Migration from share cards",
 * roadmap Slice 16): deletes the retired Slice 10 share-card objects (`…/{capture}/share` in the
 * private `captures` bucket). Keepsakes are rendered on demand and never stored, so nothing
 * replaces them. Originals, display and thumbnail derivatives are never touched: the only path
 * this script can delete is a capture's `share` sibling.
 *
 * It derives each candidate from the capture's own `storage_path`, never from `share_path`, so it
 * works before and after migration 20260930020000 drops that column, and a rerun is a no-op.
 * Dry run by default: it lists what it would delete. Pass `--apply` to delete.
 *
 * Usage: pnpm ops:retire-share-cards [--apply]
 * Talks only to the project .env.local points at. Never run against production without its own
 * explicit approval.
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const BUCKET = "captures";

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

/** `{prefix}/original` → `{prefix}/share`; anything else is not a capture original. */
export function shareSiblingOf(storagePath: string): string | null {
  return /\/original$/.test(storagePath) ? storagePath.replace(/\/original$/, "/share") : null;
}

async function main() {
  loadEnvLocal();
  const apply = process.argv.includes("--apply");
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const captures: { storage_path: string }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from("captures").select("storage_path").range(from, from + 999);
    if (error) throw error;
    captures.push(...data);
    if (data.length < 1000) break;
  }

  const existing: string[] = [];
  for (const capture of captures) {
    const share = shareSiblingOf(capture.storage_path);
    if (!share) continue;
    const folder = share.slice(0, share.lastIndexOf("/"));
    const { data, error } = await supabase.storage.from(BUCKET).list(folder, { search: "share" });
    if (error) throw error;
    if (data.some((object) => object.name === "share")) existing.push(share);
  }

  console.log(`${captures.length} captures scanned; ${existing.length} share-card object(s) found.`);
  for (const share of existing) console.log(`  ${share}`);

  if (!apply) {
    console.log("Dry run. Pass --apply to delete these objects.");
    return;
  }
  for (let i = 0; i < existing.length; i += 100) {
    const { error } = await supabase.storage.from(BUCKET).remove(existing.slice(i, i + 100));
    if (error) throw error;
  }
  console.log(`Deleted ${existing.length} share-card object(s).`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
