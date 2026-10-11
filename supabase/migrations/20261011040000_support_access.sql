-- Operator support access (decision D27, product.md §5.1.3, architecture §5b), Slice 27.
--
-- Additive and safe under the code currently deployed against this database: older code never
-- calls these functions and never reads the table.
--
--   * `support_actions` — the permanent support log. Append-only by grants, like
--     `capacity_overrides`: the service role can insert a row but can't update, delete or
--     truncate one. Foreign-key cascades run as the table owner, so deleting an event (or its
--     host's account) still removes the event's entries.
--   * `support_update_event()` — the operator check, the event change and its log entry in one
--     transaction. Each action key admits a closed set of columns, so no action can touch plan,
--     payment, activation, hosted access, capacity or ownership columns.
--   * `support_set_capture_hidden()` — hide/unhide only, with its entry. Delete and favorite
--     have no support function at all.
--   * `log_support_access()` — the non-change entries: viewing photos (at most once per operator,
--     event and 30 minutes) and downloading signage.
--
-- An operator on their own event is its owner, not support (product.md §5.1.3): every function
-- here refuses that case with `owns_event`, so an owner's own changes never land in the log.

create table public.support_actions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  operator_id uuid not null references public.operators (user_id),
  action text not null check (action in (
    'settings_changed',
    'gallery_revealed',
    'capture_opened',
    'capture_closed',
    'capture_link_rotated',
    'capture_link_turned_off',
    'gallery_link_rotated',
    'gallery_link_turned_off',
    'theme_image_changed',
    'theme_image_removed',
    'photo_hidden',
    'photo_unhidden',
    'photos_viewed',
    'signage_downloaded'
  )),
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz not null default clock_timestamp()
);

create index support_actions_event_id_idx
  on public.support_actions (event_id, created_at desc);

alter table public.support_actions enable row level security;
-- Deny-all RLS (decision D4) plus no grants at all for the browser-facing roles.
revoke all on public.support_actions from anon, authenticated;
revoke update, delete, truncate on public.support_actions from service_role;

-- Shared preamble: the caller is an operator, the event exists and isn't theirs. Returns the
-- locked event row, or null when there is no such event.
create function public.support_lock_event(p_operator_id uuid, p_event_id uuid)
returns public.events
language plpgsql
set search_path = ''
as $$
declare
  v_event public.events;
begin
  if not exists (select 1 from public.operators o where o.user_id = p_operator_id) then
    raise exception 'not_operator' using errcode = 'P0007';
  end if;

  select * into v_event
  from public.events e
  where e.id = p_event_id
  for update;

  if not found then
    return null;
  end if;
  if v_event.host_id = p_operator_id then
    raise exception 'owns_event' using errcode = 'P0007';
  end if;
  return v_event;
end;
$$;

create function public.support_update_event(
  p_operator_id uuid,
  p_event_id uuid,
  p_action text,
  p_patch jsonb
)
returns setof public.events
language plpgsql
set search_path = ''
as $$
declare
  v_allowed text[];
  v_event public.events;
  v_next public.events;
  v_old jsonb;
  v_new jsonb;
  v_old_values jsonb := '{}'::jsonb;
  v_new_values jsonb := '{}'::jsonb;
  v_key text;
begin
  v_allowed := case p_action
    when 'settings_changed' then array[
      'name', 'event_date', 'timezone', 'host_message', 'reveal_mode', 'reveal_at', 'visibility',
      'gallery_layout', 'gallery_time_sections', 'sharing_enabled', 'hashtag', 'accent_color']
    when 'gallery_revealed' then array['reveal_mode', 'reveal_at']
    when 'capture_opened' then array['capture_opened_at', 'capture_closed_at', 'safety_net_closes_at']
    when 'capture_closed' then array['capture_closed_at']
    when 'capture_link_rotated' then array['event_token']
    when 'capture_link_turned_off' then array['event_token']
    when 'gallery_link_rotated' then array['gallery_token']
    when 'gallery_link_turned_off' then array['gallery_token']
    when 'theme_image_changed' then array['theme_image_path']
    when 'theme_image_removed' then array['theme_image_path']
  end;
  if v_allowed is null then
    raise exception 'unknown_action' using errcode = 'P0007';
  end if;
  if p_patch is null or jsonb_typeof(p_patch) <> 'object'
     or exists (select 1 from jsonb_object_keys(p_patch) k where k <> all (v_allowed)) then
    raise exception 'column_not_allowed' using errcode = 'P0007';
  end if;

  v_event := public.support_lock_event(p_operator_id, p_event_id);
  if v_event.id is null then
    return;
  end if;

  v_next := jsonb_populate_record(v_event, p_patch);

  -- Every column any action may set; the rest of the row is written back unchanged.
  update public.events
  set name = v_next.name,
      event_date = v_next.event_date,
      timezone = v_next.timezone,
      host_message = v_next.host_message,
      reveal_mode = v_next.reveal_mode,
      reveal_at = v_next.reveal_at,
      visibility = v_next.visibility,
      gallery_layout = v_next.gallery_layout,
      gallery_time_sections = v_next.gallery_time_sections,
      sharing_enabled = v_next.sharing_enabled,
      hashtag = v_next.hashtag,
      accent_color = v_next.accent_color,
      capture_opened_at = v_next.capture_opened_at,
      capture_closed_at = v_next.capture_closed_at,
      safety_net_closes_at = v_next.safety_net_closes_at,
      event_token = v_next.event_token,
      gallery_token = v_next.gallery_token,
      theme_image_path = v_next.theme_image_path
  where id = p_event_id
  returning * into v_next;

  -- The entry records only what actually changed. Link tokens are credentials, so the log
  -- records whether a link existed, never the token itself.
  v_old := to_jsonb(v_event);
  v_new := to_jsonb(v_next);
  for v_key in select jsonb_object_keys(p_patch) loop
    if v_old -> v_key is distinct from v_new -> v_key then
      if v_key in ('event_token', 'gallery_token') then
        v_old_values := v_old_values || jsonb_build_object(v_key, v_old ->> v_key is not null);
        v_new_values := v_new_values || jsonb_build_object(v_key, v_new ->> v_key is not null);
      else
        v_old_values := v_old_values || jsonb_build_object(v_key, v_old -> v_key);
        v_new_values := v_new_values || jsonb_build_object(v_key, v_new -> v_key);
      end if;
    end if;
  end loop;

  -- A rotation changes the token but not whether one exists; it is still a change.
  if v_old_values <> '{}'::jsonb or p_action in ('capture_link_rotated', 'gallery_link_rotated') then
    insert into public.support_actions (event_id, operator_id, action, old_value, new_value)
    values (p_event_id, p_operator_id, p_action, v_old_values, v_new_values);
  end if;

  return next v_next;
end;
$$;

create function public.support_set_capture_hidden(
  p_operator_id uuid,
  p_event_id uuid,
  p_capture_id uuid,
  p_hidden boolean
)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  v_event public.events;
  v_was_hidden boolean;
begin
  if p_hidden is null then
    raise exception 'hidden_required' using errcode = 'P0007';
  end if;

  v_event := public.support_lock_event(p_operator_id, p_event_id);
  if v_event.id is null then
    return false;
  end if;

  select c.hidden_at is not null into v_was_hidden
  from public.captures c
  where c.id = p_capture_id
    and c.event_id = p_event_id
    and c.status = 'committed'
    and c.deleted_at is null
  for update;

  if not found then
    return false;
  end if;
  if v_was_hidden = p_hidden then
    return true;
  end if;

  -- Only the hidden flag: never slot, status, deletion or favorite (product invariant 4).
  update public.captures
  set hidden_at = case when p_hidden then now() else null end
  where id = p_capture_id;

  insert into public.support_actions (event_id, operator_id, action, old_value, new_value)
  values (
    p_event_id,
    p_operator_id,
    case when p_hidden then 'photo_hidden' else 'photo_unhidden' end,
    jsonb_build_object('capture_id', p_capture_id, 'hidden', v_was_hidden),
    jsonb_build_object('capture_id', p_capture_id, 'hidden', p_hidden)
  );
  return true;
end;
$$;

create function public.log_support_access(
  p_operator_id uuid,
  p_event_id uuid,
  p_action text,
  p_value jsonb default null
)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  v_event public.events;
begin
  if p_action not in ('photos_viewed', 'signage_downloaded') then
    raise exception 'unknown_action' using errcode = 'P0007';
  end if;

  -- The event row lock also serializes concurrent page loads, so the 30-minute window holds.
  v_event := public.support_lock_event(p_operator_id, p_event_id);
  if v_event.id is null then
    return false;
  end if;

  if p_action = 'photos_viewed' and exists (
    select 1 from public.support_actions s
    where s.event_id = p_event_id
      and s.operator_id = p_operator_id
      and s.action = 'photos_viewed'
      and s.created_at > clock_timestamp() - interval '30 minutes'
  ) then
    return true;
  end if;

  insert into public.support_actions (event_id, operator_id, action, new_value)
  values (p_event_id, p_operator_id, p_action, p_value);
  return true;
end;
$$;

revoke execute on function public.support_lock_event(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.support_update_event(uuid, uuid, text, jsonb)
  from public, anon, authenticated;
revoke execute on function public.support_set_capture_hidden(uuid, uuid, uuid, boolean)
  from public, anon, authenticated;
revoke execute on function public.log_support_access(uuid, uuid, text, jsonb)
  from public, anon, authenticated;
