import { defineConfig } from "vitest/config";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

function readEnvLocal(): Record<string, string> {
  const envPath = path.resolve(import.meta.dirname, ".env.local");
  if (!existsSync(envPath)) return {};

  const env: Record<string, string> = {};
  for (const line of readFileSync(envPath, "utf-8").split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) env[match[1].trim()] = match[2].trim();
  }
  return env;
}

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "."),
      // Next.js swaps this to a no-op outside its own bundler; tests run under Vite,
      // which has no equivalent, so alias it away rather than pull it into every test.
      "server-only": path.resolve(import.meta.dirname, "test/server-only-shim.ts"),
    },
  },
  test: {
    environment: "node",
    env: readEnvLocal(),
  },
});
