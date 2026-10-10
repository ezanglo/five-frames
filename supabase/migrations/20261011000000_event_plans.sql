-- Plans (decision D24, product.md §15.3, architecture §8c): Free / Intimate / Celebration.
--
-- Additive and safe under the code that is currently deployed against this database: nothing
-- here is required by older code, and nothing older code does stops working.
--   * `events.plan` — the host's choice while Draft (null until chosen), then overwritten by
--     activation with what was actually bought (architecture §8c). 'free' is in the domain now
--     so slice (b) needs no further schema change; nothing offers it yet.
--   * `payments.plan` — what this payment bought. Nullable for now only because older deployed
--     code inserts payment rows without it; existing rows were all sold as the single ₱999 /
--     12-month product, so they backfill to 'celebration'. New code always writes it, and
--     activation treats a null as that same legacy product. Making it NOT NULL is a
--     deployment-order follow-up (docs/progress.md), like the share_path drop.
--   * `begin_provider_checkout_for_plan()` — the plan-aware successor of
--     `begin_provider_checkout()`, which stays in place for older code until that follow-up.

alter table public.events
  add column plan text check (plan in ('free', 'intimate', 'celebration'));

alter table public.payments
  add column plan text check (plan in ('intimate', 'celebration'));

-- Every event activated so far was sold as the single ₱999 / 12-month product. Their stored
-- guest_session_cap (250) and hosted_until are deliberately left alone: re-stamping them would
-- change what those hosts already have.
update public.events set plan = 'celebration' where activated_at is not null;
update public.payments set plan = 'celebration' where plan is null;

-- Same row-lock-then-decide shape as begin_provider_checkout (Slice 8), plus the plan:
--   * the event's chosen plan is read under the lock, so a concurrent plan change can't slip
--     between the read and the placeholder insert;
--   * a pending checkout created for a different plan is superseded here rather than reused,
--     so the host is never sent to pay a price for a plan they no longer chose. Its PayMongo
--     session id is returned so the caller can expire it there (best-effort, never under a
--     database lock — the same split as before).
create function public.begin_provider_checkout_for_plan(p_event_id uuid)
returns table (
  payment_id uuid,
  checkout_session_id text,
  checkout_url text,
  is_new boolean,
  already_activated boolean,
  plan text,
  superseded_checkout_session_id text
)
language plpgsql
set search_path = ''
as $$
declare
  v_activated_at timestamptz;
  v_plan text;
  v_new_id uuid;
  v_existing public.payments;
  v_superseded text;
begin
  select e.activated_at, e.plan into v_activated_at, v_plan
  from public.events e
  where e.id = p_event_id
  for update;

  if not found then
    raise exception 'event_not_found' using errcode = 'P0002';
  end if;

  if v_activated_at is not null then
    return query select null::uuid, null::text, null::text, false, true, v_plan, null::text;
    return;
  end if;

  if v_plan is null or v_plan not in ('intimate', 'celebration') then
    raise exception 'plan_not_payable' using errcode = 'P0004';
  end if;

  select * into v_existing
  from public.payments p
  where p.event_id = p_event_id
    and p.source = 'provider'
    and p.provider_status = 'pending'
  limit 1;

  if v_existing.id is not null and v_existing.plan is distinct from v_plan then
    update public.payments
    set provider_status = 'superseded', updated_at = now()
    where id = v_existing.id and provider_status = 'pending';
    v_superseded := v_existing.provider_checkout_session_id;
    v_existing := null;
  end if;

  if v_existing.id is not null then
    return query
      select v_existing.id, v_existing.provider_checkout_session_id, v_existing.checkout_url,
             false, false, v_plan, null::text;
    return;
  end if;

  insert into public.payments (event_id, source, provider_status, plan)
  values (p_event_id, 'provider', 'pending', v_plan)
  returning id into v_new_id;

  return query select v_new_id, null::text, null::text, true, false, v_plan, v_superseded;
end;
$$;

revoke execute on function public.begin_provider_checkout_for_plan(uuid)
  from public, anon, authenticated;
