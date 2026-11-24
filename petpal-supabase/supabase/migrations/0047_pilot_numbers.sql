-- Pilot numbers (pilot list item 4).
-- Eight counts that say whether the Foster pilot works, readable by moderators
-- in the app and by the team with `select * from public.pilot_numbers();`.
-- Each row has the all-time total and the last 7 days. The last row is a
-- share: "of_total" and "of_last_7_days" hold what it is out of.

create or replace function public.pilot_numbers()
returns table(sort_order integer, metric text, total bigint, last_7_days bigint, of_total bigint, of_last_7_days bigint)
language plpgsql stable security definer set search_path = public as $$
declare week timestamptz := now() - interval '7 days';
begin
  -- Moderators in the app, or the team in the SQL editor (no signed-in app user).
  if not (public.has_admin_role('MODERATOR') or public.has_admin_role('SUPER_ADMIN')
      or (auth.uid() is null and coalesce(auth.role(), '') not in ('authenticated', 'anon'))) then
    raise exception 'Platform moderator required';
  end if;

  return query
  select 1, 'Accounts', count(*), count(*) filter (where p.created_at > week), null::bigint, null::bigint
    from public.profiles p
  union all
  select 2, 'Foster homes listed', count(*), count(*) filter (where h.created_at > week), null, null
    from public.foster_home_profiles h
    where h.published and not h.moderation_hidden and public.foster_actor_active(h.profile_id)
  union all
  select 3, 'Animals posted', count(*), count(*) filter (where l.created_at > week), null, null
    from public.animal_listings l where l.mode = 'FOSTER'
  union all
  select 4, 'Requests sent', count(*), count(*) filter (where r.created_at > week), null, null
    from public.foster_requests r
  union all
  select 5, 'Requests accepted', count(*), count(*) filter (where pl.created_at > week), null, null
    from public.foster_placements pl where pl.request_id is not null
  union all
  select 6, 'Animals received in care', count(*), count(*) filter (where pl.received_at > week), null, null
    from public.foster_placements pl where pl.received_at is not null
  union all
  select 7, 'Animals adopted after care', count(*), count(*) filter (where pl.ended_at > week), null, null
    from public.foster_placements pl where pl.outcome in ('ADOPTED_BY_FOSTER', 'ADOPTED_ELSEWHERE')
  union all
  select 8, 'Danger reports answered within 2 hours',
    count(*) filter (where d.answered_at <= d.created_at + interval '2 hours'),
    count(*) filter (where d.answered_at <= d.created_at + interval '2 hours' and d.created_at > week),
    count(*), count(*) filter (where d.created_at > week)
    -- Answered means a final decision (resolved or dismissed), not "in review".
    from (select r.created_at, r.resolved_at as answered_at
          from public.reports r where r.category = 'ANIMAL_DANGER') d
  order by 1;
end $$;
revoke all on function public.pilot_numbers() from public, anon;
grant execute on function public.pilot_numbers() to authenticated;

notify pgrst, 'reload schema';
