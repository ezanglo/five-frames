-- Slice 10: sharing and branded share cards (product.md §10, architecture §7 "share cards").
-- share_path caches the generated derived share-card object for a capture, the same caching
-- role display_path/thumbnail_path already play for their derivatives. It lives at a
-- deterministic sibling path under the capture's own storage prefix, so generation stays
-- idempotent (regeneration overwrites the same object rather than creating a new one) and
-- there is no new access-control surface: every read of this column goes through the same
-- guest-session-scoped queries already governing every other capture field.

alter table public.captures
  add column share_path text;
