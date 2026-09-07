-- Notify both participants when a block changes, without publishing block records.
create function public.refresh_blocked_conversations()
returns trigger language plpgsql security definer set search_path = public as $$
declare blocker uuid; blocked uuid;
begin
  blocker := coalesce(new.blocker_id,old.blocker_id);
  blocked := coalesce(new.blocked_id,old.blocked_id);
  update public.conversation_participants cp set last_read_seq = cp.last_read_seq
  where exists (select 1 from public.conversation_participants a
    join public.conversation_participants b on b.conversation_id = a.conversation_id
    where a.conversation_id = cp.conversation_id and a.profile_id = blocker and b.profile_id = blocked);
  return null;
end $$;
create trigger refresh_blocked_conversations after insert or delete on public.blocks
for each row execute function public.refresh_blocked_conversations();

-- All clients use a send RPC, which serializes message sequence/read position and queues notifications.
drop policy messages_participant_insert on public.messages;
