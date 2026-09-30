import "server-only";

import { getEventByToken } from "@/lib/dal/events";
import { getGuestSessionIdFromCookie } from "@/lib/auth/guest-session";
import type { KeepsakeOutcome } from "@/lib/dal/keepsakes";

/**
 * The keepsake routes' shared response contract (architecture §7b). GETs with no side effects.
 * Success is `image/jpeg`, `private, no-store`, named `fiveframes-{event}-{style}.jpg`;
 * `?download=1` makes it an attachment so Save works by plain navigation in in-app browsers.
 * Every refusal is the same generic 404, except "sharing disabled" (403); a render failure is a
 * retryable 503. None of them says why a capture isn't available.
 */

/** The signed guest cookie's session for the event this token names, or null. */
export async function guestSessionForToken(token: string): Promise<string | null> {
  const event = await getEventByToken(token);
  if (!event) return null;
  return getGuestSessionIdFromCookie(token, event.id);
}

const NO_STORE = { "Cache-Control": "private, no-store" } as const;

export function keepsakeResponse(outcome: KeepsakeOutcome, request: Request, token: string): Response {
  const download = new URL(request.url).searchParams.get("download") === "1";

  if (outcome.kind === "ok") {
    const disposition = download ? "attachment" : "inline";
    return new Response(new Uint8Array(outcome.bytes), {
      status: 200,
      headers: {
        ...NO_STORE,
        "Content-Type": "image/jpeg",
        "Content-Length": String(outcome.bytes.length),
        "Content-Disposition": `${disposition}; filename="${outcome.filename}"`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  }

  const status = outcome.kind === "sharing_disabled" ? 403 : outcome.kind === "render_failed" ? 503 : 404;
  const code = outcome.kind;

  if (download) {
    // A Save is a plain navigation, so a refusal lands on a page: keep it calm and give a way back.
    const message =
      outcome.kind === "render_failed"
        ? "We couldn’t get this keepsake ready. Your photo is safe — go back and try again."
        : "This keepsake isn’t available right now. Your photos are unaffected.";
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>FiveFrames</title></head><body style="font-family:system-ui,sans-serif;margin:0;padding:32px 20px;color:#15141A;background:#fff"><p style="font-size:17px;line-height:1.5;max-width:420px">${message}</p><p><a href="/e/${encodeURIComponent(token)}" style="color:#6B2BD9;font-weight:600">Back to your photos</a></p></body></html>`;
    return new Response(html, { status, headers: { ...NO_STORE, "Content-Type": "text/html; charset=utf-8" } });
  }

  return Response.json({ error: code }, { status, headers: NO_STORE });
}
