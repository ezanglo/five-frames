-- Slice 16 / decision D19: keepsakes replace the Slice 10 share card and are rendered on demand,
-- never stored (architecture §7b "Migration from share cards"). The share-card cache column is
-- retired. Its storage objects are removed first by the idempotent `pnpm ops:retire-share-cards
-- --apply`, which derives each object from the capture's own storage_path, so it doesn't need
-- this column and can be rerun after this migration. Nothing reads or writes the column any more,
-- and D18 permanent deletion no longer lists it.

alter table public.captures
  drop column if exists share_path;
