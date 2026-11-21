-- Storage cleanup schedule (0041).
--
-- The storage-cleanup Edge Function (0032) retries files left in
-- storage_cleanup_queue. Its caller secret now lives in Vault, generated
-- here, so nobody has to create or copy it by hand: pg_cron reads it to call
-- the function, and the function checks it through
-- storage_cleanup_secret_matches. The project URL is per environment, so the
-- job only runs once a Vault secret named 'petpal_project_url' exists
-- (https://<ref>.supabase.co); see petpal-supabase/README.md.

do $$ begin
  if not exists (select 1 from vault.secrets where name = 'storage_cleanup_secret') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'storage_cleanup_secret',
      'Caller secret for the storage-cleanup Edge Function');
  end if;
exception when others then raise notice 'vault unavailable; set STORAGE_CLEANUP_SECRET on the function instead';
end $$;

create or replace function public.storage_cleanup_secret_matches(secret_input text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(length(secret_input) >= 32 and exists (
    select 1 from vault.decrypted_secrets
    where name = 'storage_cleanup_secret' and decrypted_secret = secret_input
  ), false);
$$;

revoke all on function public.storage_cleanup_secret_matches(text) from public, anon, authenticated;
grant execute on function public.storage_cleanup_secret_matches(text) to service_role;

-- Hourly, where pg_cron and pg_net are available (hosted Supabase).
do $$ begin
  create extension if not exists pg_net;
  create extension if not exists pg_cron;
  perform cron.schedule('petpal-storage-cleanup', '41 * * * *', $job$
    select net.http_post(
      url := u.decrypted_secret || '/functions/v1/storage-cleanup',
      headers := jsonb_build_object('content-type', 'application/json', 'x-petpal-cleanup-secret', s.decrypted_secret),
      body := '{}'::jsonb
    )
    from vault.decrypted_secrets u, vault.decrypted_secrets s
    where u.name = 'petpal_project_url' and s.name = 'storage_cleanup_secret'
  $job$);
exception when others then raise notice 'pg_cron or pg_net unavailable; call storage-cleanup from another scheduler';
end $$;
