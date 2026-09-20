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
  hashtag: string | null;

  event_token: string | null;
  gallery_token: string | null;

  activated_at: string | null;
  capture_opened_at: string | null;
  capture_closed_at: string | null;
  safety_net_closes_at: string | null;
  hosted_until: string | null;
  grace_until: string | null;

  created_at: string;
  updated_at: string;
};
