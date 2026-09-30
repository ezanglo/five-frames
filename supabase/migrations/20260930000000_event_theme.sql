-- Slice 15: event theme foundation (product.md §10.1, architecture §7a, decision D19).
--
-- One optional theme per event, as three columns on the row the app already loads:
--   theme_image_path  key of the normalized theme image in the private `event-theme` bucket
--   accent_color      a key into the curated registry in lib/theme/ (never a raw color)
--   hashtag           existing column, now stored without "#" and validated server-side
--
-- Additive and safe for existing events: every existing row gets the default violet accent and
-- no theme image, which is exactly the finished default event.

alter table public.events
  add column theme_image_path text,
  add column accent_color text not null default 'violet';

-- The accent is a registry key, not CSS. An unknown key still renders as violet (lib/theme/), so
-- this only guards the shape of the value, never the palette itself: a palette change needs no
-- migration.
alter table public.events
  add constraint events_accent_color_key check (accent_color ~ '^[a-z]{1,32}$');

-- The theme image always lives in this event's own folder. The server builds the path; this is
-- the database backstop that no event can ever point at another event's object.
alter table public.events
  add constraint events_theme_image_path_scoped check (
    theme_image_path is null or starts_with(theme_image_path, id::text || '/')
  );

-- Existing hashtags were free text. Normalize them to the stored form (no leading "#", no
-- surrounding whitespace) and clear any value the validator would refuse (spaces, punctuation,
-- over 30 characters), so every existing event keeps working without manual repair.
update public.events
  set hashtag = nullif(regexp_replace(btrim(hashtag), '^#+', ''), '')
  where hashtag is not null;

update public.events
  set hashtag = null
  where hashtag is not null
    and (char_length(hashtag) > 30 or hashtag !~ '^[[:alnum:]_]+$');

alter table public.events
  add constraint events_hashtag_shape check (
    hashtag is null or (char_length(hashtag) between 1 and 30 and hashtag !~ '[[:space:]#]')
  );

-- Private theme bucket (architecture §7a). Separate from `captures` so theme media can never be
-- mistaken for, counted with, or downloaded as a capture. Storage itself enforces the 15 MB
-- source limit and the accepted formats at upload time; the server re-validates on commit.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'event-theme',
  'event-theme',
  false,
  15728640,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do nothing;
