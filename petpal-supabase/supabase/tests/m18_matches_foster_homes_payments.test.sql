begin;

select plan(33);

select has_table('public', 'animal_match_likes', 'animal match likes table exists');
select has_table('public', 'animal_matches', 'animal matches table exists');
select has_table('public', 'foster_home_profiles', 'foster home profiles table exists');
select has_table('public', 'foster_invites', 'foster invites table exists');
select has_table('public', 'foster_home_reviews', 'foster home reviews table exists');
select has_table('public', 'payment_sessions', 'payment sessions table exists');

select has_view('public', 'match_candidates_view', 'match candidates view exists');
select has_view('public', 'foster_home_profiles_view', 'foster home profiles view exists');
select has_view('public', 'my_foster_invites_view', 'my foster invites view exists');

select has_function(
  'public',
  'like_match_candidate',
  ARRAY['uuid', 'uuid', 'text'],
  'match candidate like RPC exists'
);

select has_function(
  'public',
  'send_foster_invite',
  ARRAY['uuid', 'uuid', 'text'],
  'foster invite send RPC exists'
);

select has_function(
  'public',
  'respond_to_foster_invite',
  ARRAY['uuid', 'text'],
  'foster invite response RPC exists'
);

select has_function(
  'public',
  'rate_foster_home',
  ARRAY['uuid', 'uuid', 'integer', 'text'],
  'foster home rating RPC exists'
);

select has_function(
  'public',
  'create_payment_session',
  ARRAY['text', 'text', 'integer', 'text', 'jsonb'],
  'payment session RPC exists'
);

select ok(
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'my_conversations_view'
      and column_name in ('source', 'match_id', 'foster_invite_id')
  ),
  'conversation summaries expose source and new context ids'
);

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);

select is(
  (
    select count(*)::integer
    from public.match_candidates_view
    where animal_id in ('50000000-0000-4000-8000-000000000003','50000000-0000-4000-8000-000000000004')
  ),
  2,
  'demo adopter can browse two seeded external match candidates'
);

select ok(
  exists (
    select 1
    from public.match_candidates_view
    where animal_id = '50000000-0000-4000-8000-000000000003'
      and name = 'Luna'
      and has_liked_back = true
  ),
  'match candidate view exposes reciprocal like state for Luna'
);

select ok(
  not exists (
    select 1
    from public.match_candidates_view
    where owner_id = '10000000-0000-4000-8000-000000000002'
  ),
  'match candidate view excludes current user animals'
);

select throws_ok(
  $$
  update public.owner_animal_profiles
  set admin_mate_approval_status = 'UNVERIFIED'
  where id = '50000000-0000-4000-8000-000000000004';

  select * from public.like_match_candidate(
    '50000000-0000-4000-8000-000000000001',
    '50000000-0000-4000-8000-000000000004',
    'VERIFIED_MATE'
  );
  $$,
  'Match mode is not available for both animals',
  'match likes cannot bypass an animal mode or Verified Mate safety gate'
);

create temp table m18_match_like as
select *
from public.like_match_candidate(
  '50000000-0000-4000-8000-000000000001',
  '50000000-0000-4000-8000-000000000003',
  'PLAY'
);

select ok(
  (select matched from m18_match_like),
  'reciprocal like creates a mutual animal match'
);

select ok(
  exists (
    select 1
    from public.conversations c
    join m18_match_like ml on ml.conversation_id = c.id
    where c.source = 'MATCH'
      and c.match_id = ml.match_id
      and c.application_id is null
  ),
  'mutual animal match creates a match-scoped conversation'
);

select is(
  (
    select count(*)::integer
    from public.conversation_participants cp
    join m18_match_like ml on ml.conversation_id = cp.conversation_id
  ),
  2,
  'match conversation has both owners as participants'
);

select ok(
  exists (
    select 1
    from public.my_conversations_view
    where conversation_id = (select conversation_id from m18_match_like)
      and source = 'MATCH'
      and animal_name = 'Max'
      and related_animal_name = 'Luna'
      and match_mode = 'PLAY'
  ),
  'match conversation appears with source-aware context'
);

select is(
  (
    select count(*)::integer
    from public.foster_home_profiles_view
  ),
  1,
  'demo data exposes one available foster home profile'
);

select ok(
  exists (
    select 1
    from public.foster_home_profiles_view
    where id = '60000000-0000-4000-8000-000000000001'
      and display_name = 'Ana Popescu'
      and verified_status = 'VERIFIED'
      and 'CAT' = any(accepts_species)
  ),
  'foster home profile view exposes safe public foster-home details'
);

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);

create temp table m18_invite as
select public.send_foster_invite(
  '40000000-0000-4000-8000-000000000001',
  '60000000-0000-4000-8000-000000000001',
  'Bruno needs a calm temporary foster home.'
) as invite_id;

select ok(
  exists (
    select 1
    from public.foster_invites fi
    join m18_invite inv on inv.invite_id = fi.id
    where fi.status = 'SENT'
      and fi.sent_by_user_id = '10000000-0000-4000-8000-000000000001'
  ),
  'case manager can invite a foster home for a case'
);

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000003', true);

select ok(
  exists (
    select 1
    from public.my_foster_invites_view
    where id = (select invite_id from m18_invite)
      and status = 'SENT'
  ),
  'foster home owner can see incoming foster invite'
);

create temp table m18_invite_response as
select public.respond_to_foster_invite(
  (select invite_id from m18_invite),
  'ACCEPTED'
) as conversation_id;

select ok(
  exists (
    select 1
    from public.conversations c
    join m18_invite_response response on response.conversation_id = c.id
    where c.source = 'FOSTER_INVITE'
      and c.foster_invite_id = (select invite_id from m18_invite)
      and c.application_id is null
  ),
  'accepted foster invite creates an invite-scoped conversation'
);

select ok(
  exists (
    select 1
    from public.my_conversations_view
    where conversation_id = (select conversation_id from m18_invite_response)
      and source = 'FOSTER_INVITE'
      and animal_name = 'Luna'
      and related_animal_name = 'Ana Popescu'
  ),
  'accepted foster invite appears in conversation summaries with context'
);

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);

create temp table m18_review as
select public.rate_foster_home(
  '60000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000001',
  5,
  'Ana was responsive and safe in the foster flow.'
) as review_id;

select ok(
  exists (
    select 1
    from public.foster_home_reviews fhr
    join m18_review review on review.review_id = fhr.id
    where fhr.rating = 5
      and fhr.reviewer_id = '10000000-0000-4000-8000-000000000001'
  ),
  'foster home rating is persisted'
);

create temp table m18_payment as
select *
from public.create_payment_session(
  'STRIPE',
  'DONATION',
  2500,
  'RON',
  '{"source":"m18-test"}'::jsonb
);

select is(
  (
    select profile_id
    from m18_payment
  ),
  '10000000-0000-4000-8000-000000000001'::uuid,
  'payment session is owned by the current user'
);

select ok(
  (
    select checkout_url
    from m18_payment
  ) like 'petpal://payments/%',
  'payment session receives backend-created checkout placeholder'
);

select throws_ok(
  $$
  select public.create_payment_session(
    'STRIPE',
    'PREMIUM',
    2500,
    'RON',
    '{}'::jsonb
  );
  $$,
  'Premium payments are not enabled yet',
  'premium convenience payments stay disabled until the premium layer is designed'
);

select * from finish();

rollback;
