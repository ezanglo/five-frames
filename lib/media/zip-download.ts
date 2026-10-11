/**
 * Builds one "Download all" ZIP part in the browser and writes it out (decision D25,
 * architecture §7 "Bulk download"). Each original is fetched from its signed URL only when the
 * ZIP reaches it and streamed straight into a stored (uncompressed) ZIP64-capable entry by
 * `client-zip`, so memory stays flat whatever the part's size and the bytes inside are the
 * original's, unchanged (invariant 10).
 *
 * A part either finishes whole or fails: an original that can't be fetched errors the stream,
 * which aborts the file being written, rather than leaving a ZIP that's silently missing
 * photos. The host then retries that part alone.
 */

import type { OriginalDownload } from "@/lib/dal/captures";

export class ZipPartError extends Error {}

/** The chosen streaming route isn't usable here after all; the caller falls back to one by one. */
export class ZipWriterUnavailableError extends Error {}

type ZipDeps = {
  fetchFile?: (url: string) => Promise<Response>;
  /** The same part again with freshly signed URLs, for when one expired mid-part. */
  refresh: () => Promise<OriginalDownload[]>;
  onEntry?: (current: number, total: number) => void;
};

async function fetchOriginal(
  item: OriginalDownload,
  deps: ZipDeps,
  urls: Map<string, string>,
): Promise<Response | null> {
  const fetchFile = deps.fetchFile ?? ((url: string) => fetch(url));
  let refreshed = false;
  for (let attempt = 0; attempt < 3; attempt++) {
    let response: Response | null = null;
    try {
      response = await fetchFile(urls.get(item.id)!);
    } catch {
      // A dropped connection: try once more before failing the part.
    }
    if (response?.ok && response.body) return response;
    response?.body?.cancel().catch(() => {});
    if (response?.status === 403 && !refreshed) {
      // The signed URL lapsed during a long part. Ask for the part again, matched by id.
      refreshed = true;
      const fresh = await deps.refresh();
      for (const entry of fresh) urls.set(entry.id, entry.url);
      // Deleted by the host since this part started: it no longer belongs in the download.
      if (!fresh.some((entry) => entry.id === item.id)) return null;
      continue;
    }
    if (attempt >= 1) break;
  }
  throw new ZipPartError(`Couldn’t fetch ${item.filename}`);
}

async function* zipEntries(items: OriginalDownload[], deps: ZipDeps) {
  const urls = new Map(items.map((item) => [item.id, item.url]));
  for (const [index, item] of items.entries()) {
    deps.onEntry?.(index + 1, items.length);
    const response = await fetchOriginal(item, deps, urls);
    if (!response) continue;
    // A Response input keeps the original's Last-Modified as the entry's date.
    yield { name: item.filename, input: response };
  }
}

/** The part's ZIP as a stream. Originals are fetched as it is read, one at a time, so build it
 *  only once its destination is ready. */
export async function buildZipStream(
  items: OriginalDownload[],
  deps: ZipDeps,
): Promise<ReadableStream<Uint8Array>> {
  const { makeZip } = await import("client-zip");
  return makeZip(zipEntries(items, deps));
}

type SaveFilePicker = (options: {
  suggestedName: string;
  types: { description: string; accept: Record<string, string[]> }[];
}) => Promise<{ createWritable: () => Promise<WritableStream<Uint8Array>> }>;

/**
 * Asks where to save, through File System Access. Must run in the click handler before any
 * other await, while the click still counts as a user gesture. Resolves to null when the host
 * cancels the picker.
 */
export async function pickZipFile(filename: string) {
  // Called on `window` itself: a detached reference throws "Illegal invocation".
  const host = window as unknown as { showSaveFilePicker: SaveFilePicker };
  try {
    return await host.showSaveFilePicker({
      suggestedName: filename,
      types: [{ description: "ZIP file", accept: { "application/zip": [".zip"] } }],
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return null;
    throw new ZipWriterUnavailableError(String(error));
  }
}

/** Streams the ZIP into the picked file. On failure the write is aborted, not left half-done. */
export async function writeZipToFile(
  handle: { createWritable: () => Promise<WritableStream<Uint8Array>> },
  stream: ReadableStream<Uint8Array>,
): Promise<void> {
  const writable = await handle.createWritable();
  await stream.pipeTo(writable);
}

const WORKER_URL = "/zip-download/sw.js";
const WORKER_SCOPE = "/zip-download/";

async function activeZipWorker(): Promise<ServiceWorker> {
  const registration = await navigator.serviceWorker.register(WORKER_URL, {
    scope: WORKER_SCOPE,
  });
  const worker = registration.active ?? registration.waiting ?? registration.installing;
  if (!worker) throw new ZipWriterUnavailableError("no worker");
  if (worker.state === "activated") return worker;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new ZipWriterUnavailableError("worker didn’t activate")),
      10_000,
    );
    worker.addEventListener("statechange", () => {
      if (worker.state === "activated") {
        clearTimeout(timer);
        resolve(worker);
      } else if (worker.state === "redundant") {
        clearTimeout(timer);
        reject(new ZipWriterUnavailableError("worker redundant"));
      }
    });
  });
}

/**
 * Hands the ZIP stream to the scoped service worker (`public/zip-download/sw.js`), which
 * answers a one-time URL with it as an attachment, so the browser saves it as an ordinary
 * download. Chunks cross over only when the worker asks for one, so a slow disk slows the
 * fetches instead of filling memory.
 *
 * `makeStream` runs only once the browser has actually requested the URL from the worker. If
 * that doesn't happen, nothing has been fetched and the caller can fall back to one by one.
 */
export async function writeZipViaServiceWorker(
  filename: string,
  makeStream: () => Promise<ReadableStream<Uint8Array>>,
): Promise<void> {
  if (!("serviceWorker" in navigator)) throw new ZipWriterUnavailableError("no service worker");
  let worker: ServiceWorker;
  try {
    worker = await activeZipWorker();
  } catch (error) {
    throw error instanceof ZipWriterUnavailableError
      ? error
      : new ZipWriterUnavailableError(String(error));
  }

  const id = crypto.randomUUID();
  const channel = new MessageChannel();
  const port = channel.port1;
  // Browsers stop an idle worker even while it feeds a download; a message every few seconds
  // keeps it alive (client-zip's known issue with Firefox).
  const keepAlive = setInterval(() => worker.postMessage({ type: "keepalive" }), 5_000);
  const frame = document.createElement("iframe");

  try {
    await new Promise<void>((resolve, reject) => {
      let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
      let failed = false;
      const startTimer = setTimeout(
        () => reject(new ZipWriterUnavailableError("download URL not answered by the worker")),
        15_000,
      );

      const fail = (error: unknown) => {
        if (failed) return;
        failed = true;
        port.postMessage({ type: "error" });
        reject(error);
      };

      let pullWaiting = false;
      const pull = async () => {
        if (!reader || failed) {
          pullWaiting = true;
          return;
        }
        pullWaiting = false;
        try {
          const { done, value } = await reader.read();
          if (done) {
            port.postMessage({ type: "done" });
            resolve();
          } else {
            const chunk = value.slice().buffer;
            port.postMessage({ type: "chunk", chunk }, [chunk]);
          }
        } catch (error) {
          fail(error);
        }
      };

      port.onmessage = async ({ data }) => {
        if (data?.type === "started") {
          clearTimeout(startTimer);
          try {
            reader = (await makeStream()).getReader();
          } catch (error) {
            fail(error);
            return;
          }
          if (pullWaiting) void pull();
        } else if (data?.type === "pull") {
          void pull();
        } else if (data?.type === "cancel") {
          // The host cancelled the download in the browser's own download UI.
          reader?.cancel().catch(() => {});
          fail(new ZipPartError("Download cancelled"));
        }
      };

      worker.postMessage({ type: "zip-download", id, filename }, [channel.port2]);
      frame.hidden = true;
      frame.src = `${WORKER_SCOPE}${id}/${encodeURIComponent(filename)}`;
      document.body.appendChild(frame);
    });
  } finally {
    clearInterval(keepAlive);
    port.close();
    // The download has its own life once started; removing the frame later is harmless.
    setTimeout(() => frame.remove(), 60_000);
  }
}
