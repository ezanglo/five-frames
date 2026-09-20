-- Slice 1: host account and draft event.
-- hosts mirrors auth.users; events is the draft configuration a host builds before payment.
-- RLS is deny-all on both tables (decision D4): the DAL uses the service role key, which
-- bypasses RLS entirely, so these policies are insurance against a future leaked anon key or
-- stray client-side call, not the access control mechanism itself.

create table public.hosts (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now()
);

alter table public.hosts enable row level security;

-- Keep public.hosts in sync with auth.users. security definer is required here because the
-- trigger fires as part of the Auth server's own insert into auth.users, a role that has no
-- privileges on public.hosts.
create function public.handle_new_host()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.hosts (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_host();

create table public.events (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.hosts (id) on delete cascade,

  name text not null,
  event_date date,
  timezone text not null default 'Asia/Manila',
  host_message text,

  reveal_mode text not null default 'after_event'
    check (reveal_mode in ('after_event', 'immediate', 'custom')),
  reveal_at timestamptz,
  visibility text not null default 'anyone_with_link'
    check (visibility in ('anyone_with_link', 'only_me')),
  sharing_enabled boolean not null default true,
  hashtag text,

  event_token text unique,
  gallery_token text unique,

  activated_at timestamptz,
  capture_opened_at timestamptz,
  capture_closed_at timestamptz,
  safety_net_closes_at timestamptz,
  hosted_until timestamptz,
  grace_until timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.events enable row level security;

create index events_host_id_idx on public.events (host_id);

create function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger events_set_updated_at
  before update on public.events
  for each row execute function public.set_updated_at();
