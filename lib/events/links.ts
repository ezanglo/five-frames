/**
 * Shareable capture and gallery links (architecture §5 "Link tokens"). A link reads
 * `/e/<slug>/<token>` or `/g/<slug>/<token>`: the slug is the event name, for people reading the
 * link in a chat; the token is still the whole credential. The slug is decoration. Nothing
 * resolves by it or checks it, so a renamed event's old links keep working and a wrong slug
 * changes nothing. `next.config.ts` rewrites the slugged form onto the `[token]` routes, and the
 * bare `/e/<token>` form stays valid forever (printed QR codes, links already shared).
 *
 * QR codes keep encoding the bare token path: a shorter URL is a less dense code, and nobody
 * reads a QR's text.
 */

const SLUG_MAX_LENGTH = 48;

/** Lowercase ASCII words joined by hyphens, or null when the name has none to offer. */
export function slugifyEventName(name: string): string | null {
  const words = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    // "Jon's" reads as one word, not "jon-s".
    .replace(/['’]/g, "")
    .replace(/&/g, " and ")
    .match(/[a-z0-9]+/g);
  if (!words) return null;

  let slug = "";
  for (const word of words) {
    const next = slug ? `${slug}-${word}` : word;
    if (next.length > SLUG_MAX_LENGTH) break;
    slug = next;
  }
  return slug || words[0].slice(0, SLUG_MAX_LENGTH);
}

function linkPath(prefix: "e" | "g", name: string, token: string): string {
  const slug = slugifyEventName(name);
  // Only a token the rewrite can match gets a slug; anything else keeps its working bare path.
  return slug && TOKEN_PATTERN.test(token) ? `/${prefix}/${slug}/${token}` : `/${prefix}/${encodeURIComponent(token)}`;
}

/** The capture link to share, or null while the event has no capture token. */
export function captureLinkPath(event: { name: string; event_token: string | null }): string | null {
  return event.event_token ? linkPath("e", event.name, event.event_token) : null;
}

/** The gallery link to share, or null while the event has no gallery token. */
export function galleryLinkPath(event: { name: string; gallery_token: string | null }): string | null {
  return event.gallery_token ? linkPath("g", event.name, event.gallery_token) : null;
}

/** What a QR code encodes: the bare token path, which is shorter and never changes with a rename. */
export function captureQrPath(event: { event_token: string | null }): string | null {
  return event.event_token ? `/e/${encodeURIComponent(event.event_token)}` : null;
}

/**
 * The `next.config.ts` rewrite sources. A token is 16 random bytes as base64url, so exactly 22
 * characters (lib/auth/link-tokens.ts). A slug is lowercase words and hyphens. No fixed child
 * route of `/e/[token]` or `/g/[token]` may be 22 characters long, or a request for it could be
 * read as a slugged link.
 */
export const SLUG_SOURCE = "[a-z0-9]+(?:-[a-z0-9]+)*";
export const TOKEN_SOURCE = "[A-Za-z0-9_-]{22}";

const TOKEN_PATTERN = new RegExp(`^${TOKEN_SOURCE}$`);
