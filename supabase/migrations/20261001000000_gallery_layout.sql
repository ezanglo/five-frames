-- Gallery layouts (decision D22, architecture §7d): the host chooses how the revealed gallery is
-- arranged — Masonry, Rows or Grid. Presentation only: it changes no capture, moderation, reveal,
-- visibility or access rule, and nothing reads it outside the revealed gallery page and the
-- host's own settings.
--
-- Additive and backward compatible. Existing events take the default, Masonry, from the column
-- default; old application code never reads or writes the column.

alter table public.events
  add column if not exists gallery_layout text not null default 'masonry'
    check (gallery_layout in ('masonry', 'rows', 'grid'));

-- The pixel size of the display derivative (`display_path`), so Masonry and Rows can reserve each
-- photo's natural shape before it loads. Written at commit from the derivative the server just
-- produced; null for captures committed before this migration until the idempotent
-- `pnpm ops:backfill-display-dimensions --apply` reads their display derivative. The gallery
-- renders a null pair as a square tile, so a missing value is never an error.
alter table public.captures
  add column if not exists display_width integer
    check (display_width is null or display_width > 0),
  add column if not exists display_height integer
    check (display_height is null or display_height > 0);
