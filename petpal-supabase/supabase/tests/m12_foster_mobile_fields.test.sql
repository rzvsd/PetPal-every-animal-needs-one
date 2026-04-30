begin;

select plan(5);

select ok(
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'animal_listings'
      and column_name = 'foster_duration'
  ),
  'foster mobile duration field exists on listings'
);

select ok(
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'discovery_listings_view'
      and column_name = 'food_covered'
  ),
  'safe discovery view exposes foster coverage fields'
);

select ok(
  exists (
    select 1
    from public.discovery_listings_view
    where animal_name = 'Bruno'
      and mode = 'FOSTER'
      and foster_urgency = 'HIGH'
      and foster_duration = 'ONE_TWO_WEEKS'
      and food_covered = true
      and vet_covered = true
      and transport_available = true
  ),
  'Bruno seed exposes practical foster card fields'
);

select ok(
  not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'discovery_listings_view'
      and column_name in ('exact_location', 'private_handover_notes', 'contact_email', 'contact_phone')
  ),
  'foster mobile view still hides exact location and private contact data'
);

select lives_ok(
  $$ insert into public.animal_listings (
       animal_id,
       organization_id,
       mode,
       status,
       title,
       description,
       city,
       foster_urgency,
       foster_duration
     )
     values (
       '30000000-0000-4000-8000-000000000002',
       '20000000-0000-4000-8000-000000000001',
       'FOSTER',
       'DRAFT',
       'Temporary foster draft',
       'Draft for mobile foster field validation.',
       'Bucharest',
       'LOW',
       'UNKNOWN'
     ) $$,
  'foster listings accept the supported mobile foster enums'
);

select * from finish();

rollback;
