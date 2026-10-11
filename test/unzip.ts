import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

/**
 * Extracts a generated ZIP with the system's real `unzip` (Info-ZIP), not with the library that
 * wrote it, so a test proves an ordinary tool reads it. Returns entries in archive order.
 */
export async function unzipWithSystemTool(
  stream: ReadableStream<Uint8Array>,
): Promise<{ name: string; bytes: Buffer }[]> {
  const dir = mkdtempSync(path.join(tmpdir(), "ff-zip-"));
  try {
    const zipPath = path.join(dir, "part.zip");
    writeFileSync(zipPath, Buffer.from(await new Response(stream).arrayBuffer()));
    execFileSync("unzip", ["-tq", zipPath]); // throws on any CRC or structure error
    const names = execFileSync("unzip", ["-Z1", zipPath], { encoding: "utf8" })
      .split("\n")
      .filter(Boolean);
    const out = path.join(dir, "out");
    execFileSync("unzip", ["-q", zipPath, "-d", out]);
    return names.map((name) => ({
      name,
      bytes: readFileSync(path.join(out, name)),
    }));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
