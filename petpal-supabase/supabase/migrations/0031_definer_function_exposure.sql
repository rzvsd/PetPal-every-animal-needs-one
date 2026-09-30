-- Supabase's security advisor flagged SECURITY DEFINER functions that anonymous
-- visitors could call through the REST API, and trigger functions exposed as
-- RPCs. Every client call in PetPal is made signed in, and trigger functions
-- are only ever run by Postgres, so neither exposure is needed.

do $$ declare f record; begin
  for f in
    select p.oid::regprocedure as signature, p.prorettype = 'trigger'::regtype as is_trigger
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and (p.prosecdef or p.prorettype = 'trigger'::regtype)
  loop
    execute format('revoke execute on function %s from public, anon', f.signature);
    if f.is_trigger then
      execute format('revoke execute on function %s from authenticated', f.signature);
    end if;
  end loop;
end $$;

-- Definer functions created later default to being callable by anon again;
-- keep new ones closed unless a migration grants them on purpose.
alter default privileges in schema public revoke execute on functions from public, anon;

-- The three pure helpers had no fixed search_path (advisor warning).
alter function public.default_push_title(text) set search_path = public;
alter function public.default_push_body(text) set search_path = public;
alter function public.calculate_owner_animal_completeness(text, public.species, text, integer, text, text, text, text, text[], text, text, text[]) set search_path = public;
