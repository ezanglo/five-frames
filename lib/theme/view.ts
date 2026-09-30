import { accentFor, type AccentKey } from "./accents";

/**
 * What a themed surface needs to render an event's theme. Serializable, so a server page can
 * hand it to a client component. `imageUrl` is a short-lived signed URL minted only after that
 * surface's own access check (architecture §7a), or null for the no-image treatment.
 */
export type EventThemeView = {
  accent: AccentKey;
  hashtag: string | null;
  imageUrl: string | null;
};

export const DEFAULT_THEME_VIEW: EventThemeView = { accent: "violet", hashtag: null, imageUrl: null };

export function themeViewFrom(
  event: { accent_color: string; hashtag: string | null },
  imageUrl: string | null,
): EventThemeView {
  return { accent: accentFor(event.accent_color).key, hashtag: event.hashtag, imageUrl };
}
