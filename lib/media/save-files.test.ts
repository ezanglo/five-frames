import { describe, expect, it } from "vitest";
import {
  filenameFromSignedUrl,
  outcomeNote,
  progressNote,
  saveFilesOneByOne,
} from "./save-files";

/** HOST-10 and the guest's "Download my photos": one file at a time, and no claim it can't back. */
describe("saveFilesOneByOne", () => {
  it("finishes each file before starting the next, in order, with its own filename", async () => {
    const log: string[] = [];
    let inFlight = 0;
    const outcome = await saveFilesOneByOne(
      [
        { url: "https://s.test/1", filename: "001-a.jpg" },
        { url: "https://s.test/2", filename: "002-b.jpg" },
        { url: "https://s.test/3", filename: "003-c.jpg" },
      ],
      {
        fetchFile: async (url) => {
          inFlight += 1;
          expect(inFlight).toBe(1);
          log.push(`fetch ${url}`);
          await new Promise((r) => setTimeout(r, 5));
          inFlight -= 1;
          return new Response(new Blob(["x"]));
        },
        save: (_blob, filename) => log.push(`save ${filename}`),
      },
    );
    expect(log).toEqual([
      "fetch https://s.test/1",
      "save 001-a.jpg",
      "fetch https://s.test/2",
      "save 002-b.jpg",
      "fetch https://s.test/3",
      "save 003-c.jpg",
    ]);
    expect(outcome).toEqual({ sent: 3, failed: 0, total: 3 });
  });

  it("counts a file that couldn't be fetched as not sent, and carries on", async () => {
    const saved: string[] = [];
    const outcome = await saveFilesOneByOne(
      [
        { url: "https://s.test/ok", filename: "a.jpg" },
        { url: "https://s.test/expired", filename: "b.jpg" },
        { url: "https://s.test/offline", filename: "c.jpg" },
      ],
      {
        fetchFile: async (url) => {
          if (url.endsWith("expired")) return new Response("", { status: 400 });
          if (url.endsWith("offline")) throw new TypeError("Failed to fetch");
          return new Response(new Blob(["x"]));
        },
        save: (_blob, filename) => saved.push(filename),
      },
    );
    expect(saved).toEqual(["a.jpg"]);
    expect(outcome).toEqual({ sent: 1, failed: 2, total: 3 });
  });
});

describe("download copy", () => {
  it("never says the files were saved; the browser decides that", () => {
    const notes = [
      progressNote(2, 6),
      outcomeNote({ sent: 6, failed: 0, total: 6 }, { one: "original", many: "originals" }),
      outcomeNote({ sent: 4, failed: 2, total: 6 }, { one: "photo", many: "photos" }),
    ];
    for (const note of notes) expect(note).not.toMatch(/\bsaved\b/i);
    expect(notes[1]).toBe("6 originals sent to your downloads.");
    expect(notes[2]).toBe("4 of 6 photos sent to your downloads. 2 didn’t download — try again.");
  });
});

describe("filenameFromSignedUrl", () => {
  it("reads the name the signed URL was minted with", () => {
    expect(
      filenameFromSignedUrl(
        "https://x.supabase.co/storage/v1/object/sign/captures/a/original?token=t&download=my-shot-2.jpg",
        "fallback.jpg",
      ),
    ).toBe("my-shot-2.jpg");
    expect(filenameFromSignedUrl("https://x.test/a?token=t", "fallback.jpg")).toBe("fallback.jpg");
    expect(filenameFromSignedUrl("not a url", "fallback.jpg")).toBe("fallback.jpg");
  });
});
