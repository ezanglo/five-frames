import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { unzipWithSystemTool } from "@/test/unzip";
import { buildZipStream, ZipPartError } from "./zip-download";
import {
  chooseZipWriter,
  originalFilename,
  ZIP_PART_SIZE,
  zipFilename,
  zipPartCount,
  zipPartRange,
} from "./zip-parts";

const JPEG = readFileSync(
  path.resolve(import.meta.dirname, "../../test/fixtures/theme-sample-transcoded.jpg"),
);
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);
const NOISE = Buffer.from(Array.from({ length: 70_000 }, (_, i) => (i * 7919) % 256));

function item(id: string, filename: string) {
  return { id, filename, url: `https://r2.test/${id}?sig=1` };
}

/** product.md §11.2.3: parts of up to 500 in gallery order, one ZIP up to 500. */
describe("ZIP parts", () => {
  it("splits at 500: one ZIP up to 500, three parts for 1,500", () => {
    expect(ZIP_PART_SIZE).toBe(500);
    expect([0, 1, 500, 501, 1000, 1500, 1501].map(zipPartCount)).toEqual([0, 1, 1, 2, 2, 3, 4]);
    expect(zipPartRange(0, 1500)).toEqual({ start: 0, end: 500 });
    expect(zipPartRange(2, 1500)).toEqual({ start: 1000, end: 1500 });
    expect(zipPartRange(1, 501)).toEqual({ start: 500, end: 501 });
  });

  it("covers every photo exactly once across the parts, in order", () => {
    const total = 1234;
    const positions: number[] = [];
    for (let part = 0; part < zipPartCount(total); part++) {
      const { start, end } = zipPartRange(part, total);
      for (let i = start; i < end; i++) positions.push(i);
    }
    expect(positions).toEqual(Array.from({ length: total }, (_, i) => i));
  });

  it("gives an out-of-range or malformed part nothing", () => {
    expect(zipPartRange(3, 1500)).toEqual({ start: 1500, end: 1500 });
    expect(zipPartRange(-1, 1500)).toEqual({ start: 0, end: 0 });
    expect(zipPartRange(0.5, 1500)).toEqual({ start: 0, end: 0 });
  });

  it("names each ZIP after the event and its part", () => {
    expect(zipFilename("Ana & Ben’s Wedding", 0, 1)).toBe("ana-ben-s-wedding-photos.zip");
    expect(zipFilename("Ana & Ben’s Wedding", 1, 3)).toBe(
      "ana-ben-s-wedding-photos-part-2-of-3.zip",
    );
    expect(zipFilename("Fiesta de José", 0, 1)).toBe("fiesta-de-jose-photos.zip");
    expect(zipFilename("🎉🎉", 0, 1)).toBe("fiveframes-photos.zip");
  });

  it("names originals by gallery position and guest, sorting correctly past 999", () => {
    expect(originalFilename(1, "Ana Cruz", ".jpg")).toBe("0001-ana-cruz.jpg");
    expect(originalFilename(1500, "", ".png")).toBe("1500-guest.png");
    const names = [originalFilename(999, "z", ".jpg"), originalFilename(1000, "a", ".jpg")];
    expect([...names].sort()).toEqual(names);
  });
});

/** D25: feature-detected, never by user agent. */
describe("chooseZipWriter", () => {
  const base = { ReadableStream, MessageChannel, isSecureContext: true };

  it("prefers File System Access", () => {
    expect(
      chooseZipWriter({
        ...base,
        showSaveFilePicker: () => {},
        serviceWorker: {},
      }),
    ).toBe("file-system");
  });

  it("uses a service worker where there is no save picker", () => {
    expect(chooseZipWriter({ ...base, serviceWorker: {} })).toBe("service-worker");
  });

  it("falls back to one by one without either, or outside a secure context", () => {
    expect(chooseZipWriter({ ...base })).toBe("one-by-one");
    expect(chooseZipWriter({ ...base, serviceWorker: {}, isSecureContext: false })).toBe(
      "one-by-one",
    );
    expect(
      chooseZipWriter({
        ...base,
        showSaveFilePicker: () => {},
        ReadableStream: undefined,
      }),
    ).toBe("one-by-one");
  });
});

/** Criterion 88: byte-for-byte originals, in gallery order, readable unique names. */
describe("buildZipStream", () => {
  const files: Record<string, Buffer> = { a: JPEG, b: PNG, c: NOISE };
  const fetchFixture = async (url: string) => {
    const id = new URL(url).pathname.slice(1);
    return new Response(new Uint8Array(files[id]));
  };

  it("re-extracts byte-identical with the system unzip, in order, and fetches one at a time", async () => {
    const items = [item("a", "0001-ana.jpg"), item("b", "0002-ben.png"), item("c", "0003-ana.jpg")];
    const fetched: string[] = [];
    const entries = await unzipWithSystemTool(
      await buildZipStream(items, {
        fetchFile: async (url) => {
          fetched.push(url);
          return fetchFixture(url);
        },
        refresh: async () => items,
      }),
    );
    expect(entries.map((e) => e.name)).toEqual(["0001-ana.jpg", "0002-ben.png", "0003-ana.jpg"]);
    expect(entries[0].bytes.equals(JPEG)).toBe(true);
    expect(entries[1].bytes.equals(PNG)).toBe(true);
    expect(entries[2].bytes.equals(NOISE)).toBe(true);
    expect(fetched).toHaveLength(3);
  });

  it("fails the whole part, never a ZIP missing a photo, when an original can't be fetched", async () => {
    const items = [item("a", "0001-a.jpg"), item("b", "0002-b.png")];
    const stream = await buildZipStream(items, {
      fetchFile: async (url) =>
        url.includes("/b") ? new Response("nope", { status: 500 }) : fetchFixture(url),
      refresh: async () => items,
    });
    await expect(new Response(stream).arrayBuffer()).rejects.toBeInstanceOf(ZipPartError);
  });

  it("rides out one dropped connection", async () => {
    let failures = 0;
    const items = [item("a", "0001-a.jpg")];
    const entries = await unzipWithSystemTool(
      await buildZipStream(items, {
        fetchFile: async (url) => {
          if (failures++ === 0) throw new TypeError("Failed to fetch");
          return fetchFixture(url);
        },
        refresh: async () => items,
      }),
    );
    expect(entries.map((e) => e.name)).toEqual(["0001-a.jpg"]);
  });

  it("asks for the part again when a signed URL lapsed mid-part, and skips a photo deleted meanwhile", async () => {
    const items = [item("a", "0001-a.jpg"), item("b", "0002-b.png"), item("c", "0003-c.jpg")];
    let refreshes = 0;
    const entries = await unzipWithSystemTool(
      await buildZipStream(items, {
        fetchFile: async (url) =>
          url.includes("sig=1") && !url.includes("/a")
            ? new Response("", { status: 403 })
            : fetchFixture(url),
        refresh: async () => {
          refreshes += 1;
          // b was deleted by the host since the part started; c gets a fresh URL.
          return [
            { id: "a", filename: "0001-a.jpg", url: "https://r2.test/a?sig=2" },
            { id: "c", filename: "0002-c.jpg", url: "https://r2.test/c?sig=2" },
          ];
        },
      }),
    );
    expect(entries.map((e) => e.name)).toEqual(["0001-a.jpg", "0003-c.jpg"]);
    expect(entries[1].bytes.equals(NOISE)).toBe(true);
    // One refresh brought fresh URLs for the rest of the part too.
    expect(refreshes).toBe(1);
  });

  it("writes ZIP64 records for an entry past the classic 4 GiB limit", async () => {
    const size = 2 ** 32 + 1024;
    const chunk = new Uint8Array(4 * 1024 * 1024);
    const big = new ReadableStream<Uint8Array>({
      start() {},
      pull: (() => {
        let left = size;
        return (controller: ReadableStreamDefaultController<Uint8Array>) => {
          const n = Math.min(left, chunk.length);
          left -= n;
          controller.enqueue(n === chunk.length ? chunk : chunk.subarray(0, n));
          if (left === 0) controller.close();
        };
      })(),
    });
    const stream = await buildZipStream([item("big", "0001-big.jpg")], {
      fetchFile: async () => new Response(big),
      refresh: async () => [],
    });

    // Keep only the tail: the central directory and end records.
    const reader = stream.getReader();
    let total = 0;
    let tail = new Uint8Array(0);
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      const joined = new Uint8Array(tail.length + value.length);
      joined.set(tail);
      joined.set(value, tail.length);
      tail = joined.slice(-4096);
    }
    expect(total).toBeGreaterThan(size);

    const view = Buffer.from(tail);
    const find = (sig: number) => view.lastIndexOf(Buffer.from(new Uint32Array([sig]).buffer));
    expect(find(0x06064b50)).toBeGreaterThan(-1); // ZIP64 end of central directory
    expect(find(0x07064b50)).toBeGreaterThan(-1); // ZIP64 locator
    const central = find(0x02014b50);
    expect(central).toBeGreaterThan(-1);
    // Classic size fields are saturated; the real size lives in the ZIP64 extra field.
    expect(view.readUInt32LE(central + 24)).toBe(0xffffffff);
    const nameLength = view.readUInt16LE(central + 28);
    const extra = central + 46 + nameLength;
    expect(view.readUInt16LE(extra)).toBe(0x0001);
    expect(view.readBigUInt64LE(extra + 4)).toBe(BigInt(size));
  }, 120_000);
});
