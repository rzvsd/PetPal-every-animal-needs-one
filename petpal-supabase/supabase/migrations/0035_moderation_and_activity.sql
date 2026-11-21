-- Moderation that works for one person (product review items 4 and 5) and an
-- in-app activity list built from the notification rows (stress test).

-- 4. Automatic flags have no reporter: closing them must not try to notify
--    one. The internal moderation note never goes to the reporter's phone.
create or replace function public.admin_resolve_report(report_id_input uuid, target_status_input text, notes_input text)
returns public.reports language plpgsql set search_path = public as $$
declare report_before public.reports; updated_report public.reports;
begin
  if not public.is_admin() then raise exception 'Admin role required'; end if;
  if target_status_input not in ('IN_REVIEW','RESOLVED','DISMISSED') then raise exception 'Unsupported report target status'; end if;
  select * into report_before from public.reports where id = report_id_input;
  if report_before.id is null then raise exception 'Report not found'; end if;
  update public.reports set status = target_status_input,
      resolved_at = case when target_status_input in ('RESOLVED','DISMISSED') then now() else resolved_at end
    where id = report_id_input returning * into updated_report;
  if updated_report.reporter_id is not null and target_status_input in ('RESOLVED','DISMISSED') then
    perform public.enqueue_push_notification(updated_report.reporter_id,'MODERATION_DECISION',
      jsonb_build_object('kind','REPORT','reportId',report_id_input,'status',target_status_input),
      'Your report was reviewed','Thank you. A PetPal moderator reviewed your report.');
  end if;
  insert into public.moderation_actions(actor_id,action,report_id,listing_id,profile_id,notes)
    values(auth.uid(),'REPORT_' || target_status_input,report_id_input,updated_report.listing_id,updated_report.reported_profile_id,notes_input);
  insert into public.audit_logs(actor_id,action,target_table,target_id,metadata)
    values(auth.uid(),'REPORT_STATUS_CHANGED','reports',report_id_input,
      jsonb_build_object('from_status',report_before.status,'to_status',target_status_input,'notes',notes_input));
  return updated_report;
end $$;

-- Remove the note from moderation pushes already queued.
update public.notification_events set payload = payload - 'notes',
  body = 'Thank you. A PetPal moderator reviewed your report.'
  where event_type = 'MODERATION_DECISION' and payload ? 'notes';

-- 5. "Animal in danger" first, then automatic flags, then the rest.
alter table public.reports add column priority integer generated always as (case
  when category = 'ANIMAL_DANGER' then 0
  when category in ('BLOCK_DURING_PLACEMENT','TRANSFER_WITHOUT_OWNER','DISPUTE_OPEN','RESERVATION_NOT_RECEIVED') then 1
  else 2 end) stored;
create index reports_queue_idx on public.reports(priority,created_at) where status in ('OPEN','IN_REVIEW');

-- Every new report alerts every moderator, as a push that always sends.
create or replace function public.alert_moderators_on_report()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.enqueue_push_notification(a.profile_id,'ADMIN_ALERT',jsonb_build_object('reportId',new.id,'category',new.category),
    case when new.category = 'ANIMAL_DANGER' then 'Animal in danger reported' when new.reporter_id is null then 'Automatic flag'
      else 'New report' end,
    'Open the PetPal console: ' || replace(lower(new.category),'_',' ') || '.')
  from public.admin_roles a where a.role in ('MODERATOR','SUPER_ADMIN') and a.profile_id is distinct from new.reporter_id;
  return new;
end $$;
create trigger alert_moderators_on_report after insert on public.reports
  for each row execute function public.alert_moderators_on_report();
revoke all on function public.alert_moderators_on_report() from public,anon,authenticated;

-- Automatic flags for a dispute open over 48 hours and a reservation not
-- received after 7 days. Each placement is flagged once per reason.
create or replace function public.flag_stale_placements()
returns integer language plpgsql security definer set search_path = public as $$
declare created integer := 0; n integer;
begin
  insert into public.reports(reporter_id,reported_profile_id,category,details)
  select null,h.profile_id,'DISPUTE_OPEN','Automatic flag: a discrepancy on ' || a.name || ' has been open for more than 48 hours. Placement ' || p.id || '.'
  from public.foster_placements p join public.animals a on a.id = p.animal_id join public.foster_home_profiles h on h.id = p.home_id
  where p.discrepancy and (select max(j.created_at) from public.foster_journal j where j.placement_id = p.id and j.event = 'DISPUTE') < now() - interval '48 hours'
    and not exists(select 1 from public.reports r where r.category = 'DISPUTE_OPEN' and r.details like '%' || p.id::text || '%' and r.status in ('OPEN','IN_REVIEW'));
  get diagnostics n = row_count; created := created + n;
  insert into public.reports(reporter_id,reported_profile_id,category,details)
  select null,h.profile_id,'RESERVATION_NOT_RECEIVED','Automatic flag: ' || a.name || ' was reserved more than 7 days ago and arrival was never confirmed. Placement ' || p.id || '.'
  from public.foster_placements p join public.animals a on a.id = p.animal_id join public.foster_home_profiles h on h.id = p.home_id
  where p.status = 'RESERVED' and p.created_at < now() - interval '7 days'
    and not exists(select 1 from public.reports r where r.category = 'RESERVATION_NOT_RECEIVED' and r.details like '%' || p.id::text || '%');
  get diagnostics n = row_count; created := created + n;
  return created;
end $$;
revoke all on function public.flag_stale_placements() from public,anon,authenticated;
grant execute on function public.flag_stale_placements() to service_role;

-- Run hourly where pg_cron is available (hosted Supabase and the local stack).
do $$ begin
  create extension if not exists pg_cron;
  perform cron.schedule('petpal-flag-stale-placements','17 * * * *','select public.flag_stale_placements()');
exception when others then raise notice 'pg_cron unavailable; call public.flag_stale_placements() from a scheduler';
end $$;

-- Reports with names instead of ids, for both consoles.
create or replace view public.platform_reports_view as
select r.id,r.category,r.details,r.status,r.priority,r.created_at,r.updated_at,r.listing_id,r.message_id,
  r.reporter_id,coalesce(rp.display_name,'Automatic flag') as reporter_name,
  r.reported_profile_id,tp.display_name as reported_name,l.title as listing_title
from public.reports r left join public.profiles rp on rp.id = r.reporter_id
left join public.profiles tp on tp.id = r.reported_profile_id left join public.animal_listings l on l.id = r.listing_id
where public.has_admin_role('MODERATOR') or public.has_admin_role('SUPER_ADMIN');
grant select on public.platform_reports_view to authenticated;

-- Activity list: every notification about me except chat messages, which
-- have their own unread badges. Read state is per row.
alter table public.notification_events add column read_at timestamptz;
create index notification_events_activity_idx on public.notification_events(profile_id,created_at desc)
  where event_type not in ('NEW_MESSAGE','MESSAGE_RECEIVED');

create or replace view public.my_activity_view as
select e.id,e.event_type,e.title,e.body,e.payload,e.created_at,e.read_at
from public.notification_events e
where e.profile_id = auth.uid() and e.event_type not in ('NEW_MESSAGE','MESSAGE_RECEIVED');
grant select on public.my_activity_view to authenticated;

create or replace function public.mark_activity_read(before_input timestamptz default now())
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  update public.notification_events set read_at = now()
    where profile_id = auth.uid() and read_at is null and created_at <= before_input
      and event_type not in ('NEW_MESSAGE','MESSAGE_RECEIVED');
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.mark_activity_read(timestamptz) from public,anon;
grant execute on function public.mark_activity_read(timestamptz) to authenticated;

notify pgrst, 'reload schema';
