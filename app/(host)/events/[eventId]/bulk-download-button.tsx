"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { getBulkDownloadPartAction } from "@/app/(host)/events/actions";
import { Button } from "@/components/ff/button";
import { outcomeNote, saveFilesOneByOne } from "@/lib/media/save-files";
import {
  buildZipStream,
  pickZipFile,
  writeZipToFile,
  writeZipViaServiceWorker,
  ZipWriterUnavailableError,
} from "@/lib/media/zip-download";
import {
  chooseZipWriter,
  ZIP_PART_SIZE,
  zipFilename,
  zipPartCount,
  zipPartRange,
} from "@/lib/media/zip-parts";

type PartState =
  | { kind: "idle" }
  | { kind: "running"; note: string }
  | { kind: "done"; note: string }
  | { kind: "failed"; note: string };

const IDLE: PartState = { kind: "idle" };

/**
 * "Download all" (product.md §11.2.3, decision D25): the event's originals as ZIP files of up
 * to 500 photos, built in this browser (lib/media/zip-download.ts). Up to 500 photos is one
 * click and one ZIP. More come as parts the host downloads, and retries, one at a time. Where
 * this browser can't save a generated file, a part's photos download one by one instead, and
 * the copy says so. Copy says a file was sent to the browser, never that it was saved (HOST-10).
 */
export function BulkDownloadButton({
  eventId,
  eventName,
  photoCount,
  className,
}: {
  eventId: string;
  eventName: string;
  photoCount: number;
  className?: string;
}) {
  const partCount = zipPartCount(photoCount);
  const [parts, setParts] = useState<Record<number, PartState>>({});
  const [open, setOpen] = useState(false);
  const running = Object.values(parts).some((part) => part.kind === "running");

  function setPart(partIndex: number, state: PartState) {
    setParts((current) => ({ ...current, [partIndex]: state }));
  }

  async function downloadPart(partIndex: number) {
    const filename = zipFilename(eventName, partIndex, partCount);
    let writer = chooseZipWriter({
      showSaveFilePicker: (window as { showSaveFilePicker?: unknown }).showSaveFilePicker,
      serviceWorker: navigator.serviceWorker,
      isSecureContext: window.isSecureContext,
      MessageChannel: window.MessageChannel,
      ReadableStream: window.ReadableStream,
    });

    // The save picker needs the click's user gesture, so it comes before any other await.
    let handle: Awaited<ReturnType<typeof pickZipFile>> = null;
    if (writer === "file-system") {
      try {
        handle = await pickZipFile(filename);
        if (!handle) return; // The host closed the picker.
      } catch {
        writer =
          navigator.serviceWorker && window.isSecureContext ? "service-worker" : "one-by-one";
      }
    }

    setPart(partIndex, { kind: "running", note: "Preparing the ZIP…" });
    try {
      const part = await getBulkDownloadPartAction(eventId, partIndex);
      if (part.items.length === 0) {
        setPart(partIndex, {
          kind: "done",
          note: "No photos left in this part.",
        });
        return;
      }

      const makeStream = () =>
        buildZipStream(part.items, {
          refresh: async () => (await getBulkDownloadPartAction(eventId, partIndex)).items,
          onEntry: (current, total) =>
            setPart(partIndex, {
              kind: "running",
              note: `Adding photo ${current} of ${total} to the ZIP…`,
            }),
        });

      if (handle) {
        await writeZipToFile(handle, await makeStream());
      } else if (writer === "service-worker") {
        try {
          await writeZipViaServiceWorker(filename, makeStream);
        } catch (error) {
          if (!(error instanceof ZipWriterUnavailableError)) throw error;
          writer = "one-by-one";
        }
      }

      if (writer === "one-by-one") {
        const outcome = await saveFilesOneByOne(part.items, {
          onProgress: (current, total) =>
            setPart(partIndex, {
              kind: "running",
              note: `This browser can’t save a ZIP, so photos download one by one. Downloading ${current} of ${total}… If your browser asks, allow multiple downloads.`,
            }),
        });
        const note = `This browser can’t save a ZIP, so photos downloaded one by one. ${outcomeNote(outcome, { one: "original", many: "originals" })}`;
        setPart(partIndex, {
          kind: outcome.failed === 0 ? "done" : "failed",
          note,
        });
        return;
      }

      setPart(partIndex, {
        kind: "done",
        note: `${filename} sent to your browser.`,
      });
    } catch {
      setPart(partIndex, {
        kind: "failed",
        note:
          partCount > 1
            ? `Part ${partIndex + 1} didn’t finish. Try this part again.`
            : "The ZIP didn’t finish. Try again.",
      });
    }
  }

  if (partCount <= 1) {
    const state = parts[0] ?? IDLE;
    return (
      <div className="flex flex-col items-end gap-1">
        <Button
          variant="dark"
          size="sm"
          onClick={() => downloadPart(0)}
          disabled={photoCount === 0 || running}
          className={className}
          title="Saves every original photo in one ZIP file"
        >
          <Download aria-hidden />
          {running ? "Downloading…" : state.kind === "failed" ? "Try again" : "Download all"}
        </Button>
        {state.kind !== "idle" && (
          <p className="max-w-72 text-right text-micro font-medium text-ink-muted" role="status">
            {state.note}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="relative flex flex-col items-end">
      <Button
        variant="dark"
        size="sm"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className={className}
        title={`Saves every original photo in ZIP files of up to ${ZIP_PART_SIZE}`}
      >
        <Download aria-hidden />
        Download all
      </Button>
      {open && (
        <div className="absolute top-full right-0 z-20 mt-2 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-3 rounded-lg border border-line bg-surface p-4 shadow-[0_8px_24px_rgb(0_0_0/0.12)]">
          <p className="text-caption font-medium text-ink-muted">
            {photoCount.toLocaleString("en")} photos come in {partCount} ZIP files of up to{" "}
            {ZIP_PART_SIZE}. Download each part on its own.
          </p>
          <ul className="flex flex-col gap-3">
            {Array.from({ length: partCount }, (_, partIndex) => {
              const state = parts[partIndex] ?? IDLE;
              const { start, end } = zipPartRange(partIndex, photoCount);
              return (
                <li key={partIndex} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex flex-col">
                      <span className="text-label font-semibold text-ink">
                        Part {partIndex + 1} of {partCount}
                      </span>
                      <span className="tabular text-micro font-medium text-ink-muted">
                        Photos {(start + 1).toLocaleString("en")}–{end.toLocaleString("en")}
                      </span>
                    </div>
                    <Button
                      variant="outline"
                      size="compact"
                      onClick={() => downloadPart(partIndex)}
                      disabled={running}
                    >
                      {state.kind === "running"
                        ? "Downloading…"
                        : state.kind === "failed"
                          ? "Try again"
                          : state.kind === "done"
                            ? "Download again"
                            : "Download"}
                    </Button>
                  </div>
                  {state.kind !== "idle" && (
                    <p className="text-micro font-medium text-ink-muted" role="status">
                      {state.note}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
