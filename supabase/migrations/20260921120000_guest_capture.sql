-- Slice 2: guest join and photo capture — the frame-limit mechanism (architecture §6,
-- decisions D5/D6). RLS is deny-all here too, for the same reason as slice 1: the DAL uses
-- the service role key and bypasses RLS entirely, so these policies are insurance against a
-- future leaked anon key or stray client-side call, not the access control mechanism itself.

create table public.guest_sessions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,

  display_name text not null,

  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

alter table public.guest_sessions enable row level security;

create index guest_sessions_event_id_idx on public.guest_sessions (event_id);

create table public.captures (
  id uuid primary key default gen_random_uuid(),
  guest_session_id uuid not null references public.guest_sessions (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,

  slot_index int not null check (slot_index between 0 and 4),
  reserve_key uuid not null,
  status text not null default 'pending'
    check (status in ('pending', 'committed', 'expired')),

  message text,

  storage_path text not null,
  display_path text,
  thumbnail_path text,
  mime_type text,

  hidden_at timestamptz,
  deleted_at timestamptz,
  favorited_at timestamptz,

  expires_at timestamptz not null,
  committed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.captures enable row level security;

create index captures_guest_session_id_idx on public.captures (guest_session_id);
create index captures_event_id_idx on public.captures (event_id);

-- Product invariant 3 (decision D6): one reserve_key maps to at most one row for its
-- lifetime, so a duplicate confirm or retry that reuses the key collides here instead of
-- creating a second capture.
create unique index captures_reserve_key_unique
  on public.captures (guest_session_id, reserve_key);

-- Product invariants 1 and 5 (decision D5): a guest session can occupy each slot at most
-- once, and only while the row is live (pending or committed). An expired row falls outside
-- this index, freeing its slot for a fresh attempt.
create unique index captures_slot_unique
  on public.captures (guest_session_id, slot_index)
  where status in ('pending', 'committed');

-- The reserve step of architecture §6: takes a row lock on the guest_sessions row (so
-- concurrent reserves for one guest session serialize instead of racing), lazily expires
-- abandoned reservations past their TTL, and is idempotent on reserve_key. Runs under
-- whatever role calls it — the DAL always calls this with the service-role client, which
-- already bypasses RLS, so no security definer is needed.
create function public.reserve_capture(
  p_guest_session_id uuid,
  p_reserve_key uuid
)
returns public.captures
language plpgsql
set search_path = ''
as $$
declare
  v_row public.captures;
  v_event_id uuid;
  v_slot int;
begin
  select event_id into v_event_id
  from public.guest_sessions
  where id = p_guest_session_id
  for update;

  if not found then
    raise exception 'guest_session_not_found' using errcode = 'P0002';
  end if;

  update public.captures
  set status = 'expired'
  where guest_session_id = p_guest_session_id
    and status = 'pending'
    and expires_at < now();

  select * into v_row
  from public.captures
  where guest_session_id = p_guest_session_id
    and reserve_key = p_reserve_key;

  if found then
    return v_row;
  end if;

  select gs.slot into v_slot
  from generate_series(0, 4) as gs(slot)
  where not exists (
    select 1 from public.captures c
    where c.guest_session_id = p_guest_session_id
      and c.slot_index = gs.slot
      and c.status in ('pending', 'committed')
  )
  order by gs.slot
  limit 1;

  if v_slot is null then
    raise exception 'no_frames_remaining' using errcode = 'P0001';
  end if;

  insert into public.captures (
    guest_session_id, event_id, slot_index, reserve_key, status, storage_path, expires_at
  )
  values (
    p_guest_session_id,
    v_event_id,
    v_slot,
    p_reserve_key,
    'pending',
    v_event_id::text || '/' || p_guest_session_id::text || '/' || p_reserve_key::text || '/original',
    now() + interval '30 minutes'
  )
  returning * into v_row;

  return v_row;
end;
$$;

revoke execute on function public.reserve_capture(uuid, uuid) from public, anon, authenticated;

-- Private bucket for original photos and their derivatives (architecture §7). No public
-- read; every access goes through a short-lived signed URL minted by the DAL after an
-- access check (invariant 8). Uploads happen directly from the guest's browser via a
-- server-issued, path-scoped signed upload URL (D7) — the one narrow exception to "the
-- browser never touches Supabase directly" (D3/D4).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'captures',
  'captures',
  false,
  52428800,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do nothing;
