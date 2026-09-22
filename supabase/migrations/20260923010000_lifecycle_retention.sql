-- Slice 12: lifecycle automation and retention (product.md §7.3/§15.2, decision D8).
--
-- `hosted_until`/`grace_until`/`safety_net_closes_at` already existed on `events` since
-- Slice 1 (decision D8 anticipated derived lifecycle state from the start) but nothing in
-- the real activation/capture-open paths ever populated them — only the dev activation
-- script did. This migration adds the one new column those paths still need:
-- `media_deleted_at`, the durable marker that permanent deletion actually completed for an
-- event (distinct from `grace_until` merely having elapsed, which only means deletion is
-- now *eligible*, per D8's "derived state vs. an actual side effect" split).
alter table public.events
  add column media_deleted_at timestamptz;

-- Query shape for the lifecycle cron's permanent-deletion sweep: events whose grace period
-- has elapsed and whose media hasn't been deleted yet. Partial index keeps it cheap since
-- almost every event never matches (unactivated events have a null grace_until and are
-- excluded outright).
create index events_pending_permanent_deletion_idx
  on public.events (grace_until)
  where grace_until is not null and media_deleted_at is null;
