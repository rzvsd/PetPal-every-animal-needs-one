-- Availability pause (pilot list item 6). A home set to "Not now"
-- (availability_status = 'UNAVAILABLE') cannot be invited to take an animal.
-- Its owner can still apply to an animal on purpose.

create or replace function public.reject_invite_to_paused_home()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.kind = 'INVITE' and exists(select 1 from public.foster_home_profiles h
      where h.id = new.home_id and h.availability_status = 'UNAVAILABLE') then
    raise exception 'This home is not taking animals right now.';
  end if;
  return new;
end $$;
revoke all on function public.reject_invite_to_paused_home() from public, anon, authenticated;
create trigger reject_invite_to_paused_home before insert on public.foster_requests
  for each row execute function public.reject_invite_to_paused_home();
