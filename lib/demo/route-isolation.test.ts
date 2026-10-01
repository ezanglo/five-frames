import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

/**
 * Enforces decision D14 (product.md §7.1) by reading the demo route's own source, the same way
 * the roadmap's Slice 13 verification criterion asks for ("verified by code inspection"): no
 * file under app/(demo)/ may import anything that could reach Postgres or Storage, mint a real
 * event token, or issue a real capture/gallery link. A future edit that accidentally wires the
 * demo into the DAL fails this test rather than silently opening a free real-event path.
 */

const DEMO_ROUTE_DIR = path.resolve(import.meta.dirname, "../../app/(demo)");

const FORBIDDEN_IMPORT_PATTERNS: RegExp[] = [
  /from\s+["']@\/lib\/dal\//,
  /from\s+["']@\/lib\/auth\/(guest-session|host-session|operator-session)/,
  /from\s+["']@\/lib\/media\/storage/,
  /from\s+["']@\/lib\/auth\/link-tokens/,
  /from\s+["']@supabase\//,
  /import\s+["']server-only["']/,
  /createSignedUploadUrl|createSignedReadUrl|generateLinkToken/,
  // Slice 18 (demo keepsakes): no production keepsake route or picker, no signage, no QR.
  /from\s+["']@\/components\/ff\/keepsakes\/keepsake-picker/,
  /from\s+["']@\/lib\/keepsakes\/render/,
  /from\s+["']@\/lib\/media\/(qr|signage)/,
  /from\s+["']qrcode["']/,
  /\/keepsake\/(photo|set)\//,
];

function collectSourceFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const stats = statSync(full);
    if (stats.isDirectory()) {
      files.push(...collectSourceFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry) && !entry.endsWith(".test.ts")) {
      files.push(full);
    }
  }
  return files;
}

describe("demo route isolation (decision D14)", () => {
  const files = collectSourceFiles(DEMO_ROUTE_DIR);

  it("finds the demo route's source files to check", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it("contains no import or call that could reach the DAL, Supabase, or a real link/token", () => {
    const offenders: string[] = [];
    for (const file of files) {
      const source = readFileSync(file, "utf-8");
      for (const pattern of FORBIDDEN_IMPORT_PATTERNS) {
        if (pattern.test(source)) {
          offenders.push(`${path.relative(DEMO_ROUTE_DIR, file)}: ${pattern}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("never fetches a same-origin API/webhook route that could persist state", () => {
    for (const file of files) {
      const source = readFileSync(file, "utf-8");
      expect(source).not.toMatch(/fetch\(\s*["']\/api\//);
    }
  });
});
