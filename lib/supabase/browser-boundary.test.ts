import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * D3/D4 (restated by D21): the browser never holds a Supabase client or session. Live dashboard
 * updates go through the app's own SSE route, not Supabase Realtime. This reads the source so
 * the boundary fails loudly if a client component ever imports Supabase or the DAL, or if a
 * browser client constructor appears anywhere.
 */

const ROOT = path.resolve(import.meta.dirname, "../..");
const DIRS = ["app", "components", "hooks", "lib"];

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full));
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(full);
  }
  return out;
}

function code(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\/|^\s*\/\/.*$/gm, "");
}

const files = DIRS.flatMap((d) => sourceFiles(path.join(ROOT, d))).map((file) => ({
  file: path.relative(ROOT, file),
  source: readFileSync(file, "utf8"),
}));

/** Value imports only: `import type` is erased and never reaches the bundle. */
function valueImports(source: string): string[] {
  return [...source.matchAll(/^import\s+(?!type\s)[^;]*?from\s+["']([^"']+)["']/gm)].map((m) => m[1]);
}

describe("no browser Supabase client (D3, D4, D21)", () => {
  const clientFiles = files.filter(({ source }) => /^\s*["']use client["']/.test(source));

  it("finds the client components it is guarding", () => {
    expect(clientFiles.length).toBeGreaterThan(10);
    expect(clientFiles.map((f) => f.file)).toContain(
      path.join("app", "(host)", "events", "[eventId]", "dashboard-live.tsx"),
    );
  });

  it("no client component imports Supabase, the DAL or server-only modules", () => {
    const offenders = clientFiles.flatMap(({ file, source }) =>
      valueImports(source)
        .filter((spec) => /^@supabase\/|^@\/lib\/supabase\/|^@\/lib\/dal\/|^server-only$/.test(spec))
        .map((spec) => `${file} → ${spec}`),
    );
    expect(offenders).toEqual([]);
  });

  it("no browser client constructor or Realtime channel exists anywhere", () => {
    const offenders = files
      .filter(({ source }) => /createBrowserClient|\.channel\(|realtime/i.test(code(source)))
      .map(({ file }) => file);
    expect(offenders).toEqual([]);
  });

  it("the live dashboard reaches only the app's own stream", () => {
    const live = clientFiles.find(({ file }) => file.endsWith("dashboard-live.tsx"))!;
    expect(live.source).toContain("new EventSource(`/events/");
    expect(code(live.source)).not.toMatch(/supabase/i);
  });
});
