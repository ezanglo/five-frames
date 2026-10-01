import type {
  GalleryLayout,
  GalleryVisibility,
  ManualPaymentMethod,
  RevealMode,
} from "@/lib/db/types";

/**
 * Human-readable labels for stored event/payment enums. Every control or summary that shows one
 * of these values renders the label, never the stored identifier. Plain data, so both server
 * and client components can import it.
 */
export const REVEAL_MODE_LABEL: Record<RevealMode, string> = {
  after_event: "When capture closes",
  immediate: "Immediately",
  custom: "At a time I choose",
};

export const VISIBILITY_LABEL: Record<GalleryVisibility, string> = {
  anyone_with_link: "Anyone with the gallery link",
  only_me: "Only me",
};

/** In the order the host sees them; Masonry is the default (D22). */
export const GALLERY_LAYOUT_LABEL: Record<GalleryLayout, string> = {
  masonry: "Masonry",
  rows: "Rows",
  grid: "Grid",
};

export const MANUAL_PAYMENT_METHOD_LABEL: Record<ManualPaymentMethod, string> = {
  cash: "Cash",
  bank_transfer: "Bank transfer (verified)",
  other: "Other (explicitly agreed)",
};

/** `{ value, label }` pairs in display order, for selects. */
export function labelItems<T extends string>(labels: Record<T, string>) {
  return (Object.entries(labels) as [T, string][]).map(([value, label]) => ({ value, label }));
}
