/*
 * "Download all" ZIP saver (decision D25, architecture §7 "Bulk download"). Scoped to
 * /zip-download/ only: it never sees any other request of the app.
 *
 * The page registers a one-time download id with a MessagePort, then opens
 * /zip-download/<id>/<name>. This worker answers that request once with a streamed attachment
 * whose bytes it pulls from the page chunk by chunk. It holds no media, stores nothing, and
 * answers only ids the page itself registered in this browser.
 */

const pending = new Map();
const ID = /^\/zip-download\/([0-9a-f-]{36})\//;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("message", (event) => {
  const data = event.data;
  if (!data || data.type !== "zip-download" || !event.ports[0]) return; // keepalive and others
  pending.set(data.id, { port: event.ports[0], filename: String(data.filename) });
  // An id nobody opens doesn't linger.
  setTimeout(() => pending.delete(data.id), 60_000);
});

function attachmentDisposition(filename) {
  const ascii = filename.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  const match = url.pathname.match(ID);
  if (!match) return;

  const entry = pending.get(match[1]);
  pending.delete(match[1]);
  if (!entry) {
    event.respondWith(new Response("This download link has already been used.", { status: 404 }));
    return;
  }

  const { port, filename } = entry;
  let settle = null;
  let aborted = false;
  port.onmessage = ({ data }) => {
    const done = settle;
    settle = null;
    if (done) done(data);
    else if (data && data.type === "error") aborted = true;
  };

  const stream = new ReadableStream(
    {
      start() {
        port.postMessage({ type: "started" });
      },
      pull(controller) {
        if (aborted) {
          controller.error(new Error("The ZIP couldn’t be finished."));
          return;
        }
        return new Promise((resolve) => {
          settle = (data) => {
            if (data && data.type === "chunk") controller.enqueue(new Uint8Array(data.chunk));
            else if (data && data.type === "done") controller.close();
            else controller.error(new Error("The ZIP couldn’t be finished."));
            resolve();
          };
          port.postMessage({ type: "pull" });
        });
      },
      cancel() {
        port.postMessage({ type: "cancel" });
      },
    },
    { highWaterMark: 1 },
  );

  event.respondWith(
    new Response(stream, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": attachmentDisposition(filename),
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    }),
  );
});
