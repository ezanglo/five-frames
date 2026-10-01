/**
 * One-off, idempotent backfill for decision D22 (architecture §7d): records `display_width` /
 * `display_height` for committed captures made before migration 20261001000000, so Masonry and
 * Rows can show them in their own shape. Until then the gallery renders such a capture as a
 * square tile, so this is an improvement, never a prerequisite.
 *
 * It reads only each capture's display derivative (never the original) and writes only those two
 * columns, and only where they are still null, so a rerun is a no-op. A capture whose display
 * object is gone (for example after D18 permanent deletion) is skipped and reported.
 * Dry run by default: it lists what it would write. Pass `--apply` to write.
 *
 * Usage: pnpm ops:backfill-display-dimensions [--apply]
 * Talks only to the project .env.local points at. Never run against production without its own
 * explicit approval.
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

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

/** Upright pixel size from image metadata (EXIF orientations 5–8 swap the axes). */
export function uprightSize(meta: { width?: number; height?: number; orientation?: number }) {
  if (!meta.width || !meta.height) return null;
  return (meta.orientation ?? 1) >= 5
    ? { width: meta.height, height: meta.width }
    : { width: meta.width, height: meta.height };
}

async function main() {
  loadEnvLocal();
  const apply = process.argv.includes("--apply");
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const pending: { id: string; display_path: string }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("captures")
      .select("id, display_path")
      .eq("status", "committed")
      .not("display_path", "is", null)
      .is("display_width", null)
      .order("id")
      .range(from, from + 999);
    if (error) throw error;
    pending.push(...(data as { id: string; display_path: string }[]));
    if (data.length < 1000) break;
  }

  let written = 0;
  const missing: string[] = [];
  for (const capture of pending) {
    const { data: blob, error } = await supabase.storage.from(BUCKET).download(capture.display_path);
    if (error || !blob) {
      missing.push(capture.id);
      continue;
    }
    const size = uprightSize(await sharp(Buffer.from(await blob.arrayBuffer())).metadata());
    if (!size) {
      missing.push(capture.id);
      continue;
    }
    console.log(`  ${capture.id}: ${size.width}×${size.height}`);
    if (!apply) continue;
    const { error: updateError } = await supabase
      .from("captures")
      .update({ display_width: size.width, display_height: size.height })
      .eq("id", capture.id)
      .is("display_width", null);
    if (updateError) throw updateError;
    written += 1;
  }

  console.log(
    `${pending.length} committed capture(s) without dimensions; ${missing.length} without a readable display derivative.`,
  );
  for (const id of missing) console.log(`  skipped ${id}`);
  console.log(apply ? `Wrote dimensions for ${written} capture(s).` : "Dry run. Pass --apply to write.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
