import type { SupportActionKey } from "@/lib/db/types";

/**
 * What the host and the Console read for each support-log key (product.md §5.1.3). The raw key
 * is never shown. A Record, so a new key can't ship without a label.
 */
export const SUPPORT_ACTION_LABELS: Record<SupportActionKey, string> = {
  settings_changed: "Changed event settings",
  gallery_revealed: "Revealed the gallery",
  capture_opened: "Opened capture",
  capture_closed: "Closed capture",
  capture_link_rotated: "Replaced the capture link",
  capture_link_turned_off: "Turned off the capture link",
  gallery_link_rotated: "Replaced the gallery link",
  gallery_link_turned_off: "Turned off the gallery link",
  theme_image_changed: "Changed the event image",
  theme_image_removed: "Removed the event image",
  photo_hidden: "Hid a photo",
  photo_unhidden: "Unhid a photo",
  photos_viewed: "Viewed photos",
  signage_downloaded: "Downloaded signage",
};

export function supportActionLabel(action: SupportActionKey): string {
  return SUPPORT_ACTION_LABELS[action];
}

/** The settings a `settings_changed` entry can name, for the Console's log (never raw columns). */
const SETTINGS_FIELD_LABELS: Record<string, string> = {
  name: "name",
  event_date: "date",
  timezone: "timezone",
  host_message: "welcome message",
  reveal_mode: "reveal",
  reveal_at: "reveal time",
  visibility: "visibility",
  gallery_layout: "layout",
  gallery_time_sections: "time sections",
  sharing_enabled: "guest keepsakes",
  hashtag: "hashtag",
  accent_color: "color",
};

export function settingsFieldLabel(column: string): string {
  return SETTINGS_FIELD_LABELS[column] ?? "other setting";
}
