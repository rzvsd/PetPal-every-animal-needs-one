-- The Activity list showed notices in the language the profile had when the
-- notice was written (Romanian by default), even when the app was in English.
-- Keep the English original next to the push text, and let the list pick the
-- language the app is showing now.

alter table public.notification_events add column if not exists title_en text;
alter table public.notification_events add column if not exists body_en text;

create or replace function public.enqueue_push_notification(profile_id_input uuid, event_type_input text, payload_input jsonb default '{}'::jsonb,
  title_input text default null, body_input text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare event_id_result uuid; prefs jsonb; lang text; category text := public.notification_category(event_type_input); wanted boolean := true;
  title_en_value text; body_en_value text;
  title_value text := coalesce(nullif(trim(title_input),''),public.default_push_title(event_type_input));
  body_value text := coalesce(nullif(trim(body_input),''),public.default_push_body(event_type_input));
begin
  if profile_id_input is null then raise exception 'Notification profile id is required'; end if;
  select notification_preferences,language into prefs,lang from public.profiles where id = profile_id_input;
  if category <> 'CRITICAL' and prefs is not null then
    wanted := coalesce((prefs->>'push')::boolean,true) and (category = 'push' or coalesce((prefs->>category)::boolean,true));
  end if;
  title_en_value := title_value; body_en_value := body_value;
  if coalesce(lang,'ro') = 'ro' then title_value := public.push_text_ro(title_value); body_value := public.push_text_ro(body_value); end if;
  insert into public.notification_events(profile_id,event_type,payload,title,body,title_en,body_en,delivery_status,next_attempt_at)
  values(profile_id_input,event_type_input,coalesce(payload_input,'{}'::jsonb),title_value,body_value,title_en_value,body_en_value,
    case when wanted then 'QUEUED' else 'SKIPPED' end,now())
  returning id into event_id_result;
  return event_id_result;
end $$;

-- New columns go at the end so the view can be replaced in place.
create or replace view public.my_activity_view as
select e.id,e.event_type,e.title,e.body,e.payload,e.created_at,e.read_at,
  coalesce(e.title_en,e.title) as title_en, coalesce(e.body_en,e.body) as body_en,
  case when e.title_en is null then e.title else public.push_text_ro(e.title_en) end as title_ro,
  case when e.body_en is null then e.body else public.push_text_ro(e.body_en) end as body_ro
from public.notification_events e
where e.profile_id = auth.uid() and e.event_type not in ('NEW_MESSAGE','MESSAGE_RECEIVED');
grant select on public.my_activity_view to authenticated;

notify pgrst, 'reload schema';
