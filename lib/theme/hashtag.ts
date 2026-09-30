/**
 * Event hashtag rules (product.md §10.1, architecture §7a). One server-side constant set, shared
 * with the client field so the live validation and the DAL agree. Stored without "#".
 */

export const HASHTAG_MAX = 30;

/** Letters (including accented), digits and underscore. No spaces, no punctuation. */
const HASHTAG_PATTERN = /^[\p{L}\p{M}\p{Nd}_]+$/u;

export type HashtagResult =
  | { ok: true; value: string | null }
  | { ok: false; reason: "invalid" | "too_long" };

/**
 * Normalizes what a host typed. Empty (or just "#") clears the hashtag. One leading "#" is
 * stripped because the field shows a fixed "#" prefix and hosts type one anyway.
 */
export function normalizeHashtag(raw: string | null | undefined): HashtagResult {
  const trimmed = (raw ?? "").normalize("NFC").trim().replace(/^#+/, "");
  if (trimmed === "") return { ok: true, value: null };
  if (!HASHTAG_PATTERN.test(trimmed)) return { ok: false, reason: "invalid" };
  if ([...trimmed].length > HASHTAG_MAX) return { ok: false, reason: "too_long" };
  return { ok: true, value: trimmed };
}

export const HASHTAG_ERROR = {
  invalid: "Hashtags can’t have spaces. Letters, numbers and _ only.",
  too_long: `Keep it to ${HASHTAG_MAX} characters or fewer.`,
} as const;

export class InvalidHashtagError extends Error {
  constructor(readonly reason: "invalid" | "too_long") {
    super(HASHTAG_ERROR[reason]);
    this.name = "InvalidHashtagError";
  }
}
