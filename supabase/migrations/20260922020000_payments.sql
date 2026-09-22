-- Slice 8/9: unified payments table (architecture §4, decisions D16/D17).
-- Source-agnostic from the start so provider (Slice 8) and manual (Slice 9) payments
-- share one shape and converge on the same activateEvent() function. The row itself is
-- the audit record for manual confirm/refund (D17) — no separate audit-log table.

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,

  source text not null check (source in ('provider', 'manual')),

  -- Provider fields (source = 'provider' only).
  provider_checkout_session_id text,
  provider_status text,
  amount integer,
  currency text,
  fee_amount integer,
  provider_webhook_event_id text,

  -- Manual fields (source = 'manual' only, Slice 9).
  manual_method text check (manual_method in ('cash', 'bank_transfer', 'other')),
  manual_amount integer,
  manual_currency text,
  paid_at timestamptz,
  confirmed_at timestamptz,
  confirmed_by uuid references public.operators (user_id),
  reference_note text,

  -- Refund fields (either source).
  refunded_at timestamptz,
  refunded_by uuid references public.operators (user_id),
  refund_note text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index payments_event_id_idx on public.payments (event_id);

-- Idempotency for webhook replays: one row per PayMongo checkout session, and a unique
-- index on the webhook event id once it's known, so a replayed delivery is a no-op
-- rather than a duplicate payment record.
create unique index payments_provider_checkout_session_id_idx
  on public.payments (provider_checkout_session_id)
  where provider_checkout_session_id is not null;

create unique index payments_provider_webhook_event_id_idx
  on public.payments (provider_webhook_event_id)
  where provider_webhook_event_id is not null;

alter table public.payments enable row level security;

-- Deny-all (decision D4): the DAL uses the service role key, which bypasses RLS entirely.
-- This is insurance against a future leaked anon key or stray client-side call, not the
-- access control mechanism itself.
