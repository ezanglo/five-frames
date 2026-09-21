-- Slice 7: operator identity model (decision D15, architecture §5a).
-- Operators authenticate through the same Supabase Auth used for hosts; what makes an
-- account an operator is a row here, checked server-side by requireOperator(). This is
-- deliberately not a role column on hosts — operator and host authority are structurally
-- separate even when the same person holds both.

create table public.operators (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.operators enable row level security;

-- Deny-all (decision D4): the DAL uses the service role key, which bypasses RLS entirely.
-- This is insurance against a future leaked anon key or stray client-side call, not the
-- access control mechanism itself — requireOperator() is.
