-- Address advisor findings on the functions added in the previous migration.

alter function public.set_updated_at() set search_path = '';

revoke execute on function public.handle_new_host() from public, anon, authenticated;
