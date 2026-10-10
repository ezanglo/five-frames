-- Operator capacity override (decision D24, product.md §9.5, architecture §6a), Slice 22.
--
-- Additive and safe under the code currently deployed against this database: older code never
-- calls the function and never reads the table.
--
--   * `capacity_overrides` — the permanent log. Append-only by grants, not by convention: the
--     service role the DAL uses can insert a row but can't update, delete or truncate one.
--     Foreign-key cascades run as the table owner, so deleting a host account still removes its
--     events' entries.
--   * `override_guest_capacity()` — the check, the raise and the log entry in one transaction.
--     `for update` on the event row serializes concurrent overrides with each other and with
--     joins (`join_guest_session()` updates the same row), so every entry's `previous_cap` is
--     the cap it actually replaced.

create table public.capacity_overrides (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  previous_cap int not null,
  new_cap int not null check (new_cap > previous_cap),
  reason text not null check (char_length(btrim(reason)) between 1 and 500),
  operator_id uuid not null references public.operators (user_id),
  created_at timestamptz not null default clock_timestamp()
);

create index capacity_overrides_event_id_idx
  on public.capacity_overrides (event_id, created_at desc);

alter table public.capacity_overrides enable row level security;
-- Deny-all RLS (decision D4) plus no grants at all for the browser-facing roles.
revoke all on public.capacity_overrides from anon, authenticated;
revoke update, delete, truncate on public.capacity_overrides from service_role;

create function public.override_guest_capacity(
  p_event_id uuid,
  p_operator_id uuid,
  p_new_cap int,
  p_reason text
)
returns setof public.capacity_overrides
language plpgsql
set search_path = ''
as $$
declare
  v_event public.events;
  v_entry public.capacity_overrides;
begin
  if not exists (select 1 from public.operators o where o.user_id = p_operator_id) then
    raise exception 'not_operator' using errcode = 'P0006';
  end if;
  if p_reason is null or char_length(btrim(p_reason)) = 0 then
    raise exception 'reason_required' using errcode = 'P0006';
  end if;
  if char_length(btrim(p_reason)) > 500 then
    raise exception 'reason_too_long' using errcode = 'P0006';
  end if;
  -- A typo guard ("3000" for "300"), not a product limit (architecture §6a).
  if p_new_cap is null or p_new_cap > 5000 then
    raise exception 'cap_too_large' using errcode = 'P0006';
  end if;

  select * into v_event
  from public.events e
  where e.id = p_event_id
  for update;

  if not found then
    return;
  end if;
  if v_event.host_id = p_operator_id then
    raise exception 'owns_event' using errcode = 'P0006';
  end if;
  if v_event.activated_at is null then
    raise exception 'not_activated' using errcode = 'P0006';
  end if;
  -- Raise-only. Read under the lock, so a concurrent override that already went higher wins.
  if p_new_cap <= v_event.guest_session_cap then
    raise exception 'not_a_raise' using errcode = 'P0006';
  end if;

  -- Capacity only: plan, hosted access, payments and frames are untouched (product.md §9.5).
  update public.events
  set guest_session_cap = p_new_cap
  where id = p_event_id;

  -- clock_timestamp(), not now(): taken after the lock, so entries order the way they applied
  -- even when a transaction that started earlier waited behind a later one.
  insert into public.capacity_overrides (event_id, previous_cap, new_cap, reason, operator_id, created_at)
  values (p_event_id, v_event.guest_session_cap, p_new_cap, btrim(p_reason), p_operator_id, clock_timestamp())
  returning * into v_entry;

  return next v_entry;
end;
$$;

revoke execute on function public.override_guest_capacity(uuid, uuid, int, text)
  from public, anon, authenticated;
