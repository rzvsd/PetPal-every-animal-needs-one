-- The people someone has blocked, with their names, so a block can be reviewed
-- and undone from Profile. Profiles are readable only by their owner, so this
-- runs as definer and returns nothing but the caller's own blocks. Undoing a
-- block is a plain delete on public.blocks, which blocks_self_manage allows.

create function public.my_blocked_profiles()
returns table(blocked_id uuid, display_name text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select b.blocked_id, coalesce(p.display_name, ''), b.created_at
  from public.blocks b
  left join public.profiles p on p.id = b.blocked_id
  where b.blocker_id = auth.uid()
  order by b.created_at desc
$$;

revoke all on function public.my_blocked_profiles() from public, anon;
grant execute on function public.my_blocked_profiles() to authenticated;
