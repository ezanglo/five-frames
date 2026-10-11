-- Support access may download originals and make a guest's Full Set keepsake (decision D30).
-- Nothing here changes data: three more log keys, and `log_support_access()` admits them. Every
-- download and keepsake is logged before anything is signed or rendered, so a failed write
-- serves nothing. `keepsake_made` keeps one entry per operator, event and guest session per 30
-- minutes (browsing styles re-renders, like a live refresh re-views photos); downloads log
-- every time.

alter table public.support_actions drop constraint support_actions_action_check;
alter table public.support_actions add constraint support_actions_action_check check (action in (
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
  'signage_downloaded',
  'original_downloaded',
  'originals_zip_downloaded',
  'keepsake_made'
));

create or replace function public.log_support_access(
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
  if p_action not in (
    'photos_viewed',
    'signage_downloaded',
    'original_downloaded',
    'originals_zip_downloaded',
    'keepsake_made'
  ) then
    raise exception 'unknown_action' using errcode = 'P0007';
  end if;

  -- The event row lock also serializes concurrent requests, so the 30-minute windows hold.
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

  if p_action = 'keepsake_made' and exists (
    select 1 from public.support_actions s
    where s.event_id = p_event_id
      and s.operator_id = p_operator_id
      and s.action = 'keepsake_made'
      and s.new_value ->> 'guest_session_id' = p_value ->> 'guest_session_id'
      and s.created_at > clock_timestamp() - interval '30 minutes'
  ) then
    return true;
  end if;

  insert into public.support_actions (event_id, operator_id, action, new_value)
  values (p_event_id, p_operator_id, p_action, p_value);
  return true;
end;
$$;

revoke execute on function public.log_support_access(uuid, uuid, text, jsonb)
  from public, anon, authenticated;
