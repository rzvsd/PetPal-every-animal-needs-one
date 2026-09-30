-- Team invites by short code instead of copying account ids.
-- The home owner creates a single-use code (valid 48 hours) and shares it any
-- way they like; the helper types it in and joins the home. Codes are only
-- reachable through the two functions below, never read directly.

create table public.foster_home_invites (
  code text primary key check (code ~ '^[A-HJ-NP-Z2-9]{8}$'),
  home_id uuid not null references public.foster_home_profiles(id),
  role text not null check (role in ('CARER','READER')),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '48 hours',
  redeemed_by uuid references public.profiles(id),
  redeemed_at timestamptz
);
create index foster_home_invites_creator on public.foster_home_invites(created_by,created_at);

-- Wrong codes are counted so codes cannot be guessed by trying many.
create table public.foster_invite_attempts (
  profile_id uuid not null references public.profiles(id),
  attempted_at timestamptz not null default now()
);
create index foster_invite_attempts_profile on public.foster_invite_attempts(profile_id,attempted_at);

alter table public.foster_home_invites enable row level security;
alter table public.foster_invite_attempts enable row level security;
revoke all on public.foster_home_invites,public.foster_invite_attempts from anon,authenticated;

create function public.create_foster_invite_code(home_id_input uuid, role_input text default 'CARER')
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  -- No 0/O or 1/I, so codes read aloud or copied by hand stay unambiguous.
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  random_bytes bytea;
  new_code text;
  i integer;
  invite public.foster_home_invites;
begin
  if not public.foster_actor_active(auth.uid()) then raise exception 'Account unavailable'; end if;
  if public.foster_home_role(home_id_input) is distinct from 'OWNER' then raise exception 'Only the home owner can invite helpers'; end if;
  if role_input not in ('CARER','READER') then raise exception 'Unsupported member role'; end if;
  if (select count(*) from public.foster_home_invites where created_by = auth.uid() and created_at > now() - interval '1 day') >= 20 then
    raise exception 'Invite code limit reached for today';
  end if;
  loop
    -- gen_random_uuid() is cryptographically random; these bytes carry no version bits.
    random_bytes := uuid_send(gen_random_uuid());
    new_code := '';
    foreach i in array array[0,1,2,3,4,5,10,11] loop
      new_code := new_code || substr(alphabet, get_byte(random_bytes, i) % 32 + 1, 1);
    end loop;
    exit when not exists(select 1 from public.foster_home_invites where code = new_code);
  end loop;
  insert into public.foster_home_invites(code,home_id,role,created_by)
    values(new_code,home_id_input,role_input,auth.uid()) returning * into invite;
  return jsonb_build_object('code',invite.code,'expiresAt',invite.expires_at);
end $$;

create function public.redeem_foster_invite_code(code_input text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  clean text := upper(regexp_replace(coalesce(code_input,''),'[^A-Za-z0-9]','','g'));
  invite public.foster_home_invites;
  home public.foster_home_profiles;
begin
  if not public.foster_actor_active(auth.uid()) then raise exception 'Account unavailable'; end if;
  if (select count(*) from public.foster_invite_attempts where profile_id = auth.uid() and attempted_at > now() - interval '1 hour') >= 10 then
    return jsonb_build_object('status','LIMIT');
  end if;
  select * into invite from public.foster_home_invites
    where code = clean and redeemed_at is null and expires_at > now() for update;
  if found then select * into home from public.foster_home_profiles where id = invite.home_id for update; end if;
  -- Blocked contacts see the same answer as a wrong code.
  if not found or public.is_profile_blocked_between(auth.uid(),home.profile_id) then
    insert into public.foster_invite_attempts(profile_id) values(auth.uid());
    return jsonb_build_object('status','INVALID');
  end if;
  if home.profile_id = auth.uid() then return jsonb_build_object('status','OWN_HOME'); end if;

  insert into public.foster_home_members(home_id,profile_id,role,status,invited_by)
    values(invite.home_id,auth.uid(),invite.role,'ACTIVE',invite.created_by) on conflict(home_id,profile_id)
    do update set role = excluded.role,status = 'ACTIVE',invited_by = excluded.invited_by,updated_at = now();
  update public.foster_home_invites set redeemed_by = auth.uid(),redeemed_at = now() where code = invite.code;
  perform public.enqueue_push_notification(home.profile_id,'FOSTER_TEAM_JOINED',jsonb_build_object('homeId',home.id),
    'A helper joined your home','Someone used your invite code. Open Foster to see your team.');
  return jsonb_build_object('status','JOINED','homeId',home.id,'homeName',home.name);
end $$;

revoke all on function public.create_foster_invite_code(uuid,text),public.redeem_foster_invite_code(text) from public,anon;
grant execute on function public.create_foster_invite_code(uuid,text),public.redeem_foster_invite_code(text) to authenticated;
