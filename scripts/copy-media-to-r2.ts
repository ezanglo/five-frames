/**
 * One-off copy of existing media from Supabase Storage to R2 (decision D26, Slice 25): every
 * object a committed capture or an event's current theme image points at, from the `captures`
 * bucket to `captures/` and from `event-theme` to `theme/`, at the same paths the database
 * stores, so rows need no change. Nothing else is copied (share-card siblings, abandoned uploads,
 * pruned files).
 *
 * Idempotent: an object already present in R2 is skipped, so a rerun copies only what is left.
 * It only reads from Supabase Storage and never deletes anything there.
 * Dry run by default: it lists what it would copy. Pass `--apply` to copy.
 *
 * Usage: pnpm ops:copy-media-to-r2 [--apply]
 * Talks only to the project and bucket .env.local points at. Never run against production
 * without its own explicit approval.
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { CAPTURES_PREFIX, THEME_PREFIX, headObject, putObject } from "@/lib/storage/r2";

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
  const apply = process.argv.includes("--apply");
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  async function selectAll<T>(
    table: string,
    columns: string,
    filter: (query: ReturnType<ReturnType<typeof supabase.from>["select"]>) => typeof query,
  ): Promise<T[]> {
    const rows: T[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await filter(supabase.from(table).select(columns)).order("id").range(from, from + 999);
      if (error) throw error;
      rows.push(...(data as T[]));
      if (data.length < 1000) return rows;
    }
  }

  // Only objects a row still points at: committed captures' original and derivatives, and each
  // event's current theme image. Abandoned uploads, pruned theme files and test leftovers stay.
  type CaptureRefs = { storage_path: string; display_path: string | null; thumbnail_path: string | null };
  const captures = await selectAll<CaptureRefs>("captures", "storage_path, display_path, thumbnail_path", (q) =>
    q.eq("status", "committed"),
  );
  const themes = await selectAll<{ theme_image_path: string }>("events", "theme_image_path", (q) =>
    q.not("theme_image_path", "is", null),
  );

  const work: { bucket: string; path: string; key: string }[] = [
    ...captures.flatMap((c) =>
      [c.storage_path, c.display_path, c.thumbnail_path]
        .filter((p): p is string => !!p)
        .map((p) => ({ bucket: "captures", path: p, key: `${CAPTURES_PREFIX}${p}` })),
    ),
    ...themes.map((e) => ({ bucket: "event-theme", path: e.theme_image_path, key: `${THEME_PREFIX}${e.theme_image_path}` })),
  ];

  let present = 0;
  let copied = 0;
  const missing: string[] = [];
  for (const item of work) {
    if (await headObject(item.key)) {
      present += 1;
      continue;
    }
    if (!apply) {
      copied += 1;
      continue;
    }
    const { data, error } = await supabase.storage.from(item.bucket).download(item.path);
    if (error || !data) {
      missing.push(`${item.bucket}/${item.path}`);
      continue;
    }
    await putObject(item.key, Buffer.from(await data.arrayBuffer()), data.type || "application/octet-stream");
    copied += 1;
  }

  console.log(
    `${work.length} referenced object(s): ${present} already in R2, ${copied} ${apply ? "copied" : "to copy"}, ${missing.length} missing in Supabase Storage.`,
  );
  for (const path of missing) console.log(`  missing: ${path}`);
  if (!apply) console.log("Dry run. Pass --apply to copy.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
