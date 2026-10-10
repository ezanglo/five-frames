-- Free first event (decision D24, product.md §7.2 / §15.3, architecture §8c), Slice 21.
--
-- Additive and safe under the code currently deployed against this database: older code never
-- calls these functions and never reads the new columns.
--
--   * `hosts.free_event_claimed_at` / `hosts.free_event_id` — "one Free event per host account,
--     ever" is a claim on the host row, not a count of Free events. `free_event_id` has no
--     foreign key on purpose: deleting the Free event must never give the claim back.
--   * `activate_event()` — the one guarded activation update (D16), now shared by every source:
--     a payment (provider or manual) and the Free event. For Free it also claims the host row in
--     the same transaction, so the claim and the activation commit together or not at all. That
--     closes the gap a separate claim-then-activate pair would leave: an operator confirming a
--     payment for the same draft between the two statements would otherwise burn the account's
--     Free event on a paid event.
--   * `choose_free_plan()` — the Share step's "Free" choice, refused once the account has
--     claimed its Free event.

alter table public.hosts
  add column free_event_claimed_at timestamptz,
  add column free_event_id uuid;

-- The claim is all or nothing: a claimed account always names the event that used it.
alter table public.hosts
  add constraint hosts_free_event_claim_consistent
  check ((free_event_claimed_at is null) = (free_event_id is null));

create function public.activate_event(
  p_event_id uuid,
  p_payment_id uuid,
  p_plan text,
  p_guest_session_cap int,
  p_activated_at timestamptz,
  p_hosted_until timestamptz,
  p_grace_until timestamptz,
  p_event_token text,
  p_gallery_token text
)
returns setof public.events
language plpgsql
set search_path = ''
as $$
declare
  v_event public.events;
  v_claimed_for uuid;
begin
  if p_plan not in ('free', 'intimate', 'celebration') then
    raise exception 'plan_unknown' using errcode = 'P0004';
  end if;
  -- A paid plan activates only from its payment; Free never has one (product.md §7.2).
  if (p_plan = 'free') <> (p_payment_id is null) then
    raise exception 'activation_source_mismatch' using errcode = 'P0004';
  end if;

  if p_plan = 'free' then
    -- Once per account, ever. The host row is locked before any event row, so two Free
    -- activations on one account queue here (never deadlock on each other's events), and the
    -- second sees the first's claim once it commits.
    select h.free_event_id into v_claimed_for
    from public.hosts h
    join public.events e on e.host_id = h.id
    where e.id = p_event_id
    for update of h;

    if not found then
      return;
    end if;
    if v_claimed_for is not null and v_claimed_for <> p_event_id then
      raise exception 'free_event_unavailable' using errcode = 'P0005';
    end if;
  end if;

  -- The single atomic guard (D16). Zero rows: already active, from this source or another.
  update public.events
  set activated_at = p_activated_at,
      event_token = p_event_token,
      gallery_token = p_gallery_token,
      activating_payment_id = p_payment_id,
      plan = p_plan,
      guest_session_cap = p_guest_session_cap,
      hosted_until = p_hosted_until,
      grace_until = p_grace_until
  where id = p_event_id and activated_at is null
  returning * into v_event;

  if not found then
    return;
  end if;

  if p_plan = 'free' then
    -- Same transaction as the activation: the claim never exists without the Free event, and
    -- a payment that activated this draft first (zero rows above) never touches the claim.
    update public.hosts
    set free_event_claimed_at = coalesce(free_event_claimed_at, p_activated_at),
        free_event_id = p_event_id
    where id = v_event.host_id;

    -- Other drafts that had picked Free can't have it now; they go back to "choose a plan".
    update public.events
    set plan = null
    where host_id = v_event.host_id
      and id <> p_event_id
      and activated_at is null
      and plan = 'free';
  end if;

  return next v_event;
end;
$$;

revoke execute on function public.activate_event(
  uuid, uuid, text, int, timestamptz, timestamptz, timestamptz, text, text
) from public, anon, authenticated;

-- The host's "Free" choice on a draft. Refused (zero rows) when the event isn't the host's, is
-- already active, or the account has already claimed its Free event. `for share` makes a choice
-- racing a Free activation wait for it and re-check the claim, rather than reading a stale one.
create function public.choose_free_plan(p_host_id uuid, p_event_id uuid)
returns setof public.events
language sql
set search_path = ''
as $$
  update public.events e
  set plan = 'free'
  where e.id = p_event_id
    and e.host_id = p_host_id
    and e.activated_at is null
    and exists (
      select 1 from public.hosts h
      where h.id = p_host_id and h.free_event_claimed_at is null
      for share
    )
  returning e.*;
$$;

revoke execute on function public.choose_free_plan(uuid, uuid)
  from public, anon, authenticated;
