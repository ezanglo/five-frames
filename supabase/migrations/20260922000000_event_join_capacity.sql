-- Slice 6: event join capacity enforcement (decision D13). Distinct from the five-frame
-- allowance (D5/D6): this is a configurable, revisitable launch hypothesis, not a permanent
-- invariant, so it lives as plain columns rather than a check constraint on a fixed value.

alter table public.events
  add column guest_session_cap int not null default 250,
  add column guest_session_count int not null default 0;

-- Atomic join: a single UPDATE ... WHERE guest_session_count < guest_session_cap acts as
-- both the lock and the guard, the same pattern reserve_capture() uses for frames (D5/D6),
-- applied to sessions instead (D13). Two concurrent joins racing the last slot cannot both
-- succeed — Postgres serializes concurrent UPDATEs to the same row, so the loser's WHERE
-- clause re-evaluates against the winner's already-committed increment and fails to match.
create function public.join_guest_session(
  p_event_id uuid,
  p_display_name text
)
returns public.guest_sessions
language plpgsql
set search_path = ''
as $$
declare
  v_updated_id uuid;
  v_session public.guest_sessions;
begin
  update public.events
  set guest_session_count = guest_session_count + 1
  where id = p_event_id
    and guest_session_count < guest_session_cap
  returning id into v_updated_id;

  if v_updated_id is null then
    raise exception 'event_at_capacity' using errcode = 'P0003';
  end if;

  insert into public.guest_sessions (event_id, display_name)
  values (p_event_id, p_display_name)
  returning * into v_session;

  return v_session;
end;
$$;

revoke execute on function public.join_guest_session(uuid, text) from public, anon, authenticated;
