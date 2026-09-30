export type RevealMode = "after_event" | "immediate" | "custom";
export type GalleryVisibility = "anyone_with_link" | "only_me";

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
  mime_type: string | null;

  hidden_at: string | null;
  deleted_at: string | null;
  favorited_at: string | null;

  expires_at: string;
  committed_at: string | null;
  created_at: string;
};

export type PaymentSource = "provider" | "manual";
export type ManualPaymentMethod = "cash" | "bank_transfer" | "other";

export type PaymentRow = {
  id: string;
  event_id: string;
  source: PaymentSource;

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
