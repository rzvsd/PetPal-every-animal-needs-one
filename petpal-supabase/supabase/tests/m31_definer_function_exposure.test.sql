begin;
select no_plan();

-- Definer function exposure (0031). Anonymous visitors cannot call any
-- SECURITY DEFINER function, nobody can call trigger functions as RPCs, and
-- the signed-in grants the app relies on are untouched.
select is((select count(*) from pg_proc p where p.pronamespace = 'public'::regnamespace and p.prosecdef
  and has_function_privilege('anon', p.oid, 'execute')), 0::bigint, 'anon cannot execute any definer function in public');
select is((select count(*) from pg_proc p where p.pronamespace = 'public'::regnamespace and p.prorettype = 'trigger'::regtype
  and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'))),
  0::bigint, 'trigger functions are not callable through the API');
select ok(has_function_privilege('authenticated', 'public.my_blocked_profiles()', 'execute')
  and has_function_privilege('authenticated', 'public.send_conversation_message(uuid,text,uuid)', 'execute')
  and has_function_privilege('authenticated', 'public.discover_match_candidates(uuid,text,jsonb,boolean,uuid)', 'execute'),
  'signed-in users keep the RPCs the app uses');

select * from finish();
rollback;
