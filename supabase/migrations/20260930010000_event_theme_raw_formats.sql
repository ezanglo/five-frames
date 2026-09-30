-- Slice 15 reconciliation (2026-09-30): raw HEIC/HEIF is not supported for theme images in MVP.
-- The deployed `sharp` has no HEVC decoder (architecture §7a), so Storage stops accepting those
-- types at upload time instead of the server discovering the problem after the bytes arrive.
-- JPEG, PNG and static WebP stay. The `captures` bucket is deliberately unchanged here.
update storage.buckets
set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'event-theme';
