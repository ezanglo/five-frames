-- Slice 8 correction: at most one active PayMongo Checkout Session per unpaid event.
--
-- Real PayMongo test-mode verification showed two distinct Checkout Sessions for one
-- event both reaching "paid" — activateEvent()'s guard correctly activated the event only
-- once, but the host could still be charged twice by the provider. This migration adds
-- the schema needed to prevent that at the source (reuse/replace a canonical session
-- instead of always creating a new one) rather than relying on UI copy.

alter table public.payments
  add column checkout_url text;

-- The bookkeeping invariant: an event can have at most one "active" (pending) provider
-- checkout session at a time. A concurrent begin_provider_checkout() call for the same
-- event either wins this slot or hits the conflict and reuses the winner's row — the same
-- ON CONFLICT idempotent-insert idiom already used for reserve_capture()'s reserve_key
-- (decision D6) and join_guest_session()'s capacity guard (decision D13), applied to
-- checkout sessions instead of frames or guest slots.
create unique index payments_one_active_provider_checkout_idx
  on public.payments (event_id)
  where source = 'provider' and provider_status = 'pending';

-- Which payment actually flipped activated_at — set inside activateEvent()'s own atomic
-- guarded UPDATE (decision D16), so it's race-free by construction. Lets a later webhook
-- delivery for a *different* payment tell "I am the one that activated this event" (a
-- replay, still just 'paid') apart from "someone else already activated this event before
-- me" (a genuine duplicate payment, flagged 'paid_duplicate' for operator follow-up rather
-- than silently treated as a second normal success).
alter table public.events
  add column activating_payment_id uuid references public.payments (id);

-- Serializes concurrent checkout-start attempts for the same event (two tabs, a
-- double-click) so only one can decide "no active session, create one" — the same
-- row-lock-then-decide shape as reserve_capture()'s guest_sessions lock. Doesn't span the
-- external PayMongo API call: the caller fills in checkout_session_id/checkout_url with a
-- separate UPDATE after this function returns, so no DB lock is held across a network
-- call. No security definer: the DAL always calls this with the service-role client,
-- which already bypasses RLS.
create function public.begin_provider_checkout(p_event_id uuid)
returns table (
  payment_id uuid,
  checkout_session_id text,
  checkout_url text,
  is_new boolean,
  already_activated boolean
)
language plpgsql
set search_path = ''
as $$
declare
  v_activated_at timestamptz;
  v_new_id uuid;
  v_existing public.payments;
begin
  select activated_at into v_activated_at
  from public.events
  where id = p_event_id
  for update;

  if not found then
    raise exception 'event_not_found' using errcode = 'P0002';
  end if;

  if v_activated_at is not null then
    return query select null::uuid, null::text, null::text, false, true;
    return;
  end if;

  insert into public.payments (event_id, source, provider_status)
  values (p_event_id, 'provider', 'pending')
  on conflict (event_id) where (source = 'provider' and provider_status = 'pending')
  do nothing
  returning id into v_new_id;

  if v_new_id is not null then
    return query select v_new_id, null::text, null::text, true, false;
    return;
  end if;

  select * into v_existing
  from public.payments
  where event_id = p_event_id
    and source = 'provider'
    and provider_status = 'pending'
  limit 1;

  return query
    select v_existing.id, v_existing.provider_checkout_session_id, v_existing.checkout_url,
           false, false;
end;
$$;
