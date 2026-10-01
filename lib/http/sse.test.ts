import { describe, expect, it } from "vitest";
import { createVersionStream, type VersionStreamOptions } from "@/lib/http/sse";

/** Reads a whole stream as text (every test stream ends by itself). */
async function readAll(stream: ReadableStream<Uint8Array>): Promise<string> {
  const decoder = new TextDecoder();
  let text = "";
  for await (const chunk of stream as unknown as AsyncIterable<Uint8Array>) {
    text += decoder.decode(chunk, { stream: true });
  }
  return text;
}

function versions(text: string): string[] {
  return [...text.matchAll(/^event: version\ndata: (.*)$/gm)].map((m) => m[1]);
}

function stream(overrides: Partial<VersionStreamOptions>) {
  return createVersionStream({
    read: async () => "v1",
    first: "v1",
    pollMs: 5,
    heartbeatMs: 10_000,
    lifetimeMs: 60,
    retryMs: 3000,
    ...overrides,
  });
}

describe("createVersionStream (D21)", () => {
  it("opens with a retry delay and the caller's first version", async () => {
    const text = await readAll(stream({}));
    expect(text.startsWith("retry: 3000\n\nevent: version\ndata: v1\n\n")).toBe(true);
  });

  it("emits only when the version changes, so duplicate reads send nothing", async () => {
    const reads = ["v1", "v1", "v2", "v2", "v2", "v3", "v3"];
    const text = await readAll(
      stream({ read: async () => reads.shift() ?? "v3", lifetimeMs: 200 }),
    );
    expect(versions(text)).toEqual(["v1", "v2", "v3"]);
  });

  it("ends when the resource stops being reachable (read returns null)", async () => {
    const reads: (string | null)[] = ["v2", null, "v3"];
    const read = async () => (reads.length ? reads.shift()! : "v9");
    const text = await readAll(stream({ read, lifetimeMs: 10_000 }));
    expect(versions(text)).toEqual(["v1", "v2"]);
  });

  it("ends itself at its lifetime", async () => {
    const started = Date.now();
    await readAll(stream({ lifetimeMs: 40 }));
    expect(Date.now() - started).toBeLessThan(2000);
  });

  it("ends promptly when the request is aborted", async () => {
    const controller = new AbortController();
    const started = Date.now();
    setTimeout(() => controller.abort(), 20);
    await readAll(stream({ pollMs: 50, lifetimeMs: 60_000, signal: controller.signal }));
    expect(Date.now() - started).toBeLessThan(2000);
  });

  it("stops reading once the client cancels", async () => {
    let reads = 0;
    const s = stream({ read: async () => `v${++reads}`, lifetimeMs: 60_000 });
    const reader = s.getReader();
    await reader.read();
    await reader.cancel();
    const after = reads;
    await new Promise((r) => setTimeout(r, 40));
    expect(reads).toBeLessThanOrEqual(after + 1);
  });

  it("sends a comment heartbeat when idle, which EventSource ignores", async () => {
    const text = await readAll(stream({ heartbeatMs: 10, lifetimeMs: 80 }));
    expect(text).toContain(": ping\n\n");
    expect(versions(text)).toEqual(["v1"]);
  });

  it("tolerates a transient read failure and ends after repeated ones", async () => {
    const errors: unknown[] = [];
    let n = 0;
    const flaky = await readAll(
      stream({
        read: async () => {
          n++;
          if (n === 1) throw new Error("blip");
          return "v2";
        },
        lifetimeMs: 100,
        onError: (e) => errors.push(e),
      }),
    );
    expect(versions(flaky)).toEqual(["v1", "v2"]);
    expect(errors).toHaveLength(1);

    const started = Date.now();
    const broken = await readAll(
      stream({
        read: async () => {
          throw new Error("down");
        },
        lifetimeMs: 60_000,
        maxConsecutiveErrors: 3,
      }),
    );
    expect(versions(broken)).toEqual(["v1"]);
    expect(Date.now() - started).toBeLessThan(2000);
  });
});
