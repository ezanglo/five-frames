-- Time sections in the revealed gallery (product.md §7.5, decision D24, architecture §7d "Time
-- sections"): the gallery is divided into one section per local hour that has photos, on by
-- default for every event and plan. The host may switch it off for one continuous page.
-- Presentation only: it changes no capture, moderation, reveal, visibility or access rule, and
-- nothing reads it outside the revealed gallery page and the host's own settings.
--
-- Additive and backward compatible. Existing events take the default, on, from the column
-- default; old application code never reads or writes the column.

alter table public.events
  add column if not exists gallery_time_sections boolean not null default true;
