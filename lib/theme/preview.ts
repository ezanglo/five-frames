import { accentFor, type AccentKey } from "./accents";
import { normalizeHashtag } from "./hashtag";

/**
 * The live state the host's Look studio sends to its guest-screen preview frame (a same-origin,
 * host-only page rendering the real guest components at phone width). Every field is validated
 * on arrival: the accent must be a registry key, the hashtag passes the same validator as the
 * DAL, and the image may only be a signed https URL or a same-origin blob URL.
 */
export type LookPreviewState = {
  name: string;
  dateLabel: string | null;
  message: string | null;
  accent: AccentKey;
  hashtag: string | null;
  imageUrl: string | null;
};

export const LOOK_PREVIEW_MESSAGE = "ff-look-preview";

export function parseLookPreviewMessage(data: unknown): LookPreviewState | null {
  if (!data || typeof data !== "object") return null;
  const record = data as Record<string, unknown>;
  if (record.type !== LOOK_PREVIEW_MESSAGE) return null;
  const state = record.state as Record<string, unknown> | undefined;
  if (!state || typeof state !== "object") return null;

  const text = (value: unknown, max: number) =>
    typeof value === "string" && value.trim() ? value.slice(0, max) : null;
  const hashtag = normalizeHashtag(typeof state.hashtag === "string" ? state.hashtag : "");
  const imageUrl =
    typeof state.imageUrl === "string" && /^(https:\/\/|blob:)/.test(state.imageUrl)
      ? state.imageUrl
      : null;

  return {
    name: text(state.name, 120) ?? "Your event",
    dateLabel: text(state.dateLabel, 80),
    message: text(state.message, 400),
    accent: accentFor(typeof state.accent === "string" ? state.accent : null).key,
    hashtag: hashtag.ok ? hashtag.value : null,
    imageUrl,
  };
}
