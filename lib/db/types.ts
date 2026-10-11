import type { PaidPlanId, PlanId } from "@/lib/plans/registry";

export type RevealMode = "after_event" | "immediate" | "custom";
export type GalleryVisibility = "anyone_with_link" | "only_me";
/** How the revealed gallery is arranged (D22). Presentation only; see lib/gallery/layouts.ts. */
export type GalleryLayout = "masonry" | "rows" | "grid";

export type EventRow = {
  id: string;
  host_id: string;

  name: string;
  event_date: string | null;
  timezone: string;
  host_message: string | null;

  reveal_mode: RevealMode;
  reveal_at: string | null;
  visibility: GalleryVisibility;
  /** Read through `resolveGalleryLayout`, which renders anything unexpected as Masonry. */
  gallery_layout: GalleryLayout;
  /** Hourly sections in the revealed gallery (§7d); on by default. Presentation only. */
  gallery_time_sections: boolean;
  sharing_enabled: boolean;
  /** Stored without "#"; validated by lib/theme/hashtag.ts on every write. */
  hashtag: string | null;
  /** A key into the curated registry in lib/theme/accents.ts; unknown keys render as violet. */
  accent_color: string;
  /** Normalized theme image in the private `event-theme` bucket, or null (architecture §7a). */
  theme_image_path: string | null;

  event_token: string | null;
  gallery_token: string | null;

  activated_at: string | null;
  activating_payment_id: string | null;
  capture_opened_at: string | null;
  capture_closed_at: string | null;
  safety_net_closes_at: string | null;
  hosted_until: string | null;
  grace_until: string | null;
  media_deleted_at: string | null;

  guest_session_cap: number;
  guest_session_count: number;
  /** The host's choice while Draft (null until chosen); set by activation to what was bought
   *  (architecture §8c, D24). */
  plan: PlanId | null;

  created_at: string;
  updated_at: string;
};

export type GuestSessionRow = {
  id: string;
  event_id: string;
  display_name: string;
  created_at: string;
  last_seen_at: string;
};

export type CaptureStatus = "pending" | "committed" | "expired";

export type CaptureRow = {
  id: string;
  guest_session_id: string;
  event_id: string;

  slot_index: number;
  reserve_key: string;
  status: CaptureStatus;

  message: string | null;

  storage_path: string;
  display_path: string | null;
  thumbnail_path: string | null;
  /** Pixel size of the display derivative; null for captures committed before D22's backfill. */
  display_width: number | null;
  display_height: number | null;
  mime_type: string | null;

  hidden_at: string | null;
  deleted_at: string | null;
  favorited_at: string | null;

  expires_at: string;
  committed_at: string | null;
  created_at: string;
};

export type PaymentSource = "provider" | "manual";
export type ManualPaymentMethod = "cash" | "bank_transfer" | "e_wallet" | "other";

export type PaymentRow = {
  id: string;
  event_id: string;
  source: PaymentSource;
  /** What this payment bought. Null only on rows from before plans; read through
   *  `planForPayment`. */
  plan: PaidPlanId | null;

  provider_checkout_session_id: string | null;
  checkout_url: string | null;
  provider_status: string | null;
  amount: number | null;
  currency: string | null;
  fee_amount: number | null;
  provider_webhook_event_id: string | null;

  manual_method: ManualPaymentMethod | null;
  manual_amount: number | null;
  manual_currency: string | null;
  paid_at: string | null;
  confirmed_at: string | null;
  confirmed_by: string | null;
  reference_note: string | null;

  refunded_at: string | null;
  refunded_by: string | null;
  refund_note: string | null;

  created_at: string;
  updated_at: string;
};

/** One operator capacity override (product.md §9.5, architecture §6a). Append-only: the
 *  database refuses an update or delete, even from the service role. */
export type CapacityOverrideRow = {
  id: string;
  event_id: string;
  previous_cap: number;
  new_cap: number;
  reason: string;
  operator_id: string;
  created_at: string;
};

/** The support log's closed set of action keys (product.md §5.1.3, architecture §5b). The
 *  database refuses any other key. */
export type SupportActionKey =
  | "settings_changed"
  | "gallery_revealed"
  | "capture_opened"
  | "capture_closed"
  | "capture_link_rotated"
  | "capture_link_turned_off"
  | "gallery_link_rotated"
  | "gallery_link_turned_off"
  | "theme_image_changed"
  | "theme_image_removed"
  | "photo_hidden"
  | "photo_unhidden"
  | "photos_viewed"
  | "signage_downloaded"
  | "original_downloaded"
  | "originals_zip_downloaded"
  | "keepsake_made";

/** One support-access log entry (D27). Append-only: the database refuses an update or delete,
 *  even from the service role. Link tokens appear only as whether a link existed. */
export type SupportActionRow = {
  id: string;
  event_id: string;
  operator_id: string;
  action: SupportActionKey;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  created_at: string;
};
