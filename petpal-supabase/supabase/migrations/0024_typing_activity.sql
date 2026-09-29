-- Ephemeral, participant-scoped typing activity. Clients may use the RPCs only.
alter table public.profiles
  add column show_typing_activity boolean not null default true;

create table public.conversation_typing (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  is_typing boolean not null default false,
  updated_at timestamptz not null default clock_timestamp(),
  primary key (conversation_id, profile_id)
);

create index conversation_typing_active_idx
  on public.conversation_typing(conversation_id, updated_at desc)
  where is_typing;

alter table public.conversation_typing enable row level security;
revoke all on public.conversation_typing from public, anon, authenticated;

create or replace function public.can_type_in_conversation(target_conversation_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  conversation public.conversations;
  foster_status text;
begin
  if auth.uid() is null
    or not public.foster_actor_active(auth.uid())
    or not public.is_conversation_participant(target_conversation_id)
    or public.is_conversation_blocked(target_conversation_id, auth.uid()) then
    return false;
  end if;

  select * into conversation
  from public.conversations
  where id = target_conversation_id;

  if conversation.id is null then return false; end if;

  if conversation.source = 'MATCH'
    and conversation.social_request_status is not null
    and conversation.social_request_status <> 'ACCEPTED' then
    return false;
  end if;

  if conversation.foster_request_id is not null then
    select status into foster_status
    from public.foster_requests
    where id = conversation.foster_request_id;
    if foster_status not in ('PENDING', 'ACCEPTED') then return false; end if;
  elsif conversation.application_id is not null then
    if not exists (
      select 1 from public.applications
      where id = conversation.application_id and status = 'ACCEPTED'
    ) then return false; end if;
  elsif conversation.foster_invite_id is not null then
    if not exists (
      select 1 from public.foster_invites
      where id = conversation.foster_invite_id and status = 'ACCEPTED'
    ) then return false; end if;
  end if;

  return true;
end;
$$;

create or replace function public.set_conversation_typing(
  conversation_id_input uuid,
  is_typing_input boolean
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  preference boolean;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if is_typing_input is null then raise exception 'Typing state is required'; end if;
  if not public.can_type_in_conversation(conversation_id_input) then
    raise exception 'Conversation is not available for typing';
  end if;

  if not is_typing_input then
    delete from public.conversation_typing
    where conversation_id = conversation_id_input and profile_id = auth.uid();
    return false;
  end if;

  select coalesce(show_typing_activity, true) into preference
  from public.profiles where id = auth.uid();
  if not coalesce(preference, true) then
    delete from public.conversation_typing
    where conversation_id = conversation_id_input and profile_id = auth.uid();
    return false;
  end if;

  insert into public.conversation_typing(conversation_id, profile_id, is_typing, updated_at)
  values (conversation_id_input, auth.uid(), true, clock_timestamp())
  on conflict (conversation_id, profile_id) do update set
    is_typing = true,
    updated_at = clock_timestamp()
  where public.conversation_typing.updated_at <= clock_timestamp() - interval '2 seconds';
  return true;
end;
$$;

create or replace function public.get_conversation_typing(conversation_id_input uuid)
returns table (is_typing boolean, updated_at timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or not public.can_type_in_conversation(conversation_id_input) then
    return;
  end if;

  return query
  select ct.is_typing, ct.updated_at
  from public.conversation_typing ct
  join public.profiles actor on actor.id = ct.profile_id
  where ct.conversation_id = conversation_id_input
    and ct.profile_id <> auth.uid()
    and public.foster_actor_active(ct.profile_id)
    and exists (
      select 1
      from public.conversation_participants current_participant
      where current_participant.conversation_id = ct.conversation_id
        and current_participant.profile_id = ct.profile_id
    )
    and ct.is_typing
    and coalesce(actor.show_typing_activity, true)
    and ct.updated_at > clock_timestamp() - interval '6 seconds'
  order by ct.updated_at desc
  limit 1;
end;
$$;

create or replace function public.update_typing_preference(enabled_input boolean)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare result boolean;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not public.foster_actor_active(auth.uid()) then raise exception 'Account unavailable'; end if;
  if enabled_input is null then raise exception 'Typing preference is required'; end if;

  update public.profiles
  set show_typing_activity = enabled_input,
      updated_at = clock_timestamp()
  where id = auth.uid()
  returning show_typing_activity into result;

  if result is null then raise exception 'Profile not found'; end if;
  return result;
end;
$$;

revoke all on function public.can_type_in_conversation(uuid) from public, anon, authenticated;
revoke all on function public.set_conversation_typing(uuid, boolean) from public, anon, authenticated;
revoke all on function public.get_conversation_typing(uuid) from public, anon, authenticated;
revoke all on function public.update_typing_preference(boolean) from public, anon, authenticated;
grant execute on function public.set_conversation_typing(uuid, boolean) to authenticated;
grant execute on function public.get_conversation_typing(uuid) to authenticated;
grant execute on function public.update_typing_preference(boolean) to authenticated;
