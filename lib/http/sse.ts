/**
 * A bounded Server-Sent Events stream of opaque version strings (decision D21, architecture §9).
 *
 * The server observes an authoritative value by re-reading it every `pollMs` and emits
 * `event: version` only when it differs from the last one sent. This is **server-side polling**
 * pushed over one connection, not a database push. The client never learns what changed, only
 * that something did, and then re-reads the page from the server.
 *
 * The stream ends on its own before the platform's function limit (`lifetimeMs`), when the read
 * reports the resource is gone (`null`), after repeated read failures, or when the request is
 * aborted. The browser's EventSource reconnects after `retryMs`.
 */

export type VersionStreamOptions = {
  /** Current version, or null when the resource is no longer reachable (ends the stream). */
  read: () => Promise<string | null>;
  /** A version already read by the caller; sent first so the connection costs one read. */
  first: string;
  pollMs: number;
  heartbeatMs: number;
  lifetimeMs: number;
  retryMs: number;
  /** Consecutive read failures tolerated before the stream ends. */
  maxConsecutiveErrors?: number;
  signal?: AbortSignal;
  onError?: (error: unknown) => void;
};

const encoder = new TextEncoder();

export function sseEvent(event: string, data: string): string {
  return `event: ${event}\ndata: ${data}\n\n`;
}

export function createVersionStream(options: VersionStreamOptions): ReadableStream<Uint8Array> {
  const { read, first, pollMs, heartbeatMs, lifetimeMs, retryMs, signal, onError } = options;
  const maxErrors = options.maxConsecutiveErrors ?? 3;
  let stopped = false;
  let wake: (() => void) | null = null;

  const stop = () => {
    stopped = true;
    wake?.();
  };

  const sleep = (ms: number) =>
    new Promise<void>((resolve) => {
      const timer = setTimeout(done, ms);
      function done() {
        clearTimeout(timer);
        wake = null;
        resolve();
      }
      wake = done;
    });

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      signal?.addEventListener("abort", stop, { once: true });
      const startedAt = Date.now();
      let lastWriteAt = startedAt;
      const write = (chunk: string) => {
        controller.enqueue(encoder.encode(chunk));
        lastWriteAt = Date.now();
      };

      write(`retry: ${retryMs}\n\n`);
      write(sseEvent("version", first));
      let last = first;
      let errors = 0;

      while (!stopped && !signal?.aborted) {
        await sleep(pollMs);
        if (stopped || signal?.aborted) break;
        if (Date.now() - startedAt >= lifetimeMs) break;

        let next: string | null;
        try {
          next = await read();
          errors = 0;
        } catch (error) {
          onError?.(error);
          if (++errors >= maxErrors) break;
          continue;
        }
        if (stopped || signal?.aborted) break;
        if (next === null) break;

        if (next !== last) {
          last = next;
          write(sseEvent("version", next));
        } else if (Date.now() - lastWriteAt >= heartbeatMs) {
          // A comment line: ignored by EventSource, keeps idle HTTP/1.1 intermediaries open.
          write(": ping\n\n");
        }
      }

      signal?.removeEventListener("abort", stop);
      try {
        controller.close();
      } catch {
        // Already closed by a cancel.
      }
    },
    cancel() {
      stop();
    },
  });
}
