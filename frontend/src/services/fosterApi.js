import { supabase } from './supabaseClient';

export async function fosterRpc(name, args) {
  if (!supabase) throw new Error('Foster requires a connected account.');
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw error;
  return data;
}

async function result(query) {
  const response = await query;
  if (response.error) throw response.error;
  return response;
}

// Quote PostgREST values so punctuation in a name cannot become another filter.
function searchValue(value) {
  return JSON.stringify(`%${value.trim().replace(/[\\%_]/g, '\\$&')}%`);
}

export async function loadFosterOverview(accountId) {
  const [homes, team, saved, admin, organizations, spaces] = await Promise.all([
    result(supabase.from('foster_homes_directory').select('*').not('my_role', 'is', null).order('name')),
    result(supabase.from('foster_team_view').select('*').order('display_name')),
    result(supabase.from('foster_saved').select('case_id,home_id')),
    result(supabase.from('admin_profile_view').select('role').maybeSingle()),
    result(supabase.from('organization_members').select('organization_id,role,organizations(name)').eq('profile_id', accountId)),
    result(supabase.from('foster_spaces').select('*').order('name')),
  ]);
  return { homes: homes.data, team: team.data, saved: saved.data, spaces: spaces.data, adminRole: admin.data?.role,
    organizations: organizations.data.filter(row => ['OWNER', 'MANAGER'].includes(row.role)) };
}

export async function loadFosterDirectory({ type, query = '', species = '', urgent = false, page = 0, savedIds, ownerId, excludeOwnerId }) {
  let request = supabase.from(type === 'homes' ? 'foster_homes_directory' : 'foster_cases_directory').select('*', { count: 'exact' });
  if (type === 'homes') {
    request = request.eq('published', true);
    if (species) request = request.contains('species', [species]);
  } else {
    if (ownerId) request = request.eq('responsible_id', ownerId);
    else request = request.eq('status', 'ACTIVE');
    if (excludeOwnerId) request = request.neq('responsible_id', excludeOwnerId);
    if (species) request = request.eq('species', species);
    if (urgent) request = request.eq('urgency', 'HIGH');
  }
  if (query.trim()) request = request.or(`name.ilike.${searchValue(query)},city.ilike.${searchValue(query)}`);
  if (savedIds) {
    if (!savedIds.length) return { rows: [], count: 0 };
    request = request.in('id', savedIds);
  }
  const response = await result(request.order('name').order('id').range(page * 25, page * 25 + 24));
  return { rows: response.data, count: response.count };
}

export async function loadFosterRegistry({ homeId, query = '', species = '', status = '', spaceId = '', carerId = '', careState = '', page = 0 }) {
  let request = supabase.from('foster_registry_view').select('*', { count: 'exact' }).eq('home_id', homeId);
  if (query.trim()) request = request.or(`name.ilike.${searchValue(query)},animal_code.ilike.${searchValue(query)}`);
  if (species) request = request.eq('species', species);
  if (status) request = request.eq('status', status);
  else request = request.in('status', ['IN_CARE', 'RESERVED']);
  if (spaceId) request = request.eq('space_id', spaceId);
  if (carerId) request = request.eq('carer_id', carerId);
  if (careState) request = request.eq('care_state', careState);
  const response = await result(request.order('created_at', { ascending: false }).order('id').range(page * 25, page * 25 + 24));
  return { rows: response.data, count: response.count };
}

export async function loadFosterHomeDetails(homeId) {
  const [spaces, dogs, cats, tasks] = await Promise.all([
    result(supabase.from('foster_spaces').select('*').eq('home_id', homeId).order('name')),
    result(supabase.from('foster_registry_view').select('id', { count: 'exact', head: true }).eq('home_id', homeId).eq('status', 'IN_CARE').eq('species', 'DOG')),
    result(supabase.from('foster_registry_view').select('id', { count: 'exact', head: true }).eq('home_id', homeId).eq('status', 'IN_CARE').eq('species', 'CAT')),
    result(supabase.from('foster_registry_view').select('overdue_tasks').eq('home_id', homeId).in('status', ['IN_CARE', 'RESERVED'])),
  ]);
  return { spaces: spaces.data, dogs: dogs.count, cats: cats.count, overdue: tasks.data.reduce((sum, row) => sum + row.overdue_tasks, 0) };
}

export async function loadFosterRequests(accountId, direction, page = 0) {
  const column = { incoming: 'recipient_id', outgoing: 'sender_id', consent: 'consent_owner_id' }[direction];
  const response = await result(supabase.from('foster_requests_view').select('*', { count: 'exact' })
    .eq(column, accountId)
    .order('created_at', { ascending: false }).order('id').range(page * 25, page * 25 + 24));
  return { rows: response.data, count: response.count };
}

export async function loadFosterPlacement(id) {
  const [placement, journal, tasks, reviews] = await Promise.all([
    result(supabase.from('foster_registry_view').select('*').eq('id', id).single()),
    result(supabase.from('foster_journal_view').select('*').eq('placement_id', id).order('created_at', { ascending: false }).order('id').limit(50)),
    result(supabase.from('foster_tasks').select('*').eq('placement_id', id).order('completed_at', { nullsFirst: true }).order('due_at', { nullsFirst: false }).order('id').limit(100)),
    result(supabase.from('foster_reviews_view').select('*').eq('placement_id', id)),
  ]);
  return { placement: placement.data, journal: journal.data, tasks: tasks.data, reviews: reviews.data };
}

// Placements of my animals in homes I am not part of, across transfers,
// including finished ones from the last 60 days so I can review the home.
export async function loadMyAnimalsElsewhere(accountId, myHomeIds) {
  const since = new Date(Date.now() - 60 * 86400000).toISOString();
  let request = supabase.from('foster_registry_view').select('*').neq('home_owner_id', accountId)
    .or(`status.in.(RESERVED,IN_CARE),ended_at.gte."${since}"`);
  if (myHomeIds.length) request = request.not('home_id', 'in', `(${myHomeIds.join(',')})`);
  return (await result(request.order('created_at', { ascending: false }).limit(50))).data;
}

// Open tasks due by the end of tomorrow, for the Today screen.
export async function loadDueFosterTasks(placementIds) {
  if (!placementIds.length) return [];
  const until = new Date();
  until.setDate(until.getDate() + 2);
  until.setHours(0, 0, 0, 0);
  return (await result(supabase.from('foster_tasks').select('*').in('placement_id', placementIds).is('completed_at', null)
    .lt('due_at', until.toISOString()).order('due_at').limit(50))).data;
}

export async function loadMoreFosterJournal(placementId, offset) {
  return (await result(supabase.from('foster_journal_view').select('*').eq('placement_id', placementId)
    .order('created_at', { ascending: false }).order('id').range(offset, offset + 49))).data;
}

export async function loadMoreFosterTasks(placementId, offset) {
  return (await result(supabase.from('foster_tasks').select('*').eq('placement_id', placementId)
    .order('completed_at', { nullsFirst: true }).order('due_at', { nullsFirst: false }).order('id').range(offset, offset + 99))).data;
}

export async function loadRequestHistory(id) {
  return (await result(supabase.from('foster_request_events_view').select('*').eq('request_id', id)
    .order('created_at', { ascending: false }).limit(50))).data;
}

export async function saveFosterItem(type, id, saved) {
  const key = type === 'homes' ? 'home_id' : 'case_id';
  const query = saved ? supabase.from('foster_saved').insert({ [key]: id }) : supabase.from('foster_saved').delete().eq(key, id);
  const { error } = await query;
  if (error && !(saved && error.code === '23505')) throw error;
}

export async function reportFosterItem({ profileId, listingId, category, details }) {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw error;
  await result(supabase.from('reports').insert({ reporter_id: user.id, reported_profile_id: profileId,
    listing_id: listingId || null, category, details }));
}

export async function loadActivity(offset = 0) {
  return (await result(supabase.from('my_activity_view').select('*').order('created_at', { ascending: false }).order('id')
    .range(offset, offset + 29))).data;
}

export async function countUnreadActivity() {
  return (await result(supabase.from('my_activity_view').select('id', { count: 'exact', head: true }).is('read_at', null))).count || 0;
}

export async function markActivityRead(before) {
  return fosterRpc('mark_activity_read', { before_input: before });
}

export async function loadPlatformQueue(type, query = '', page = 0) {
  let request;
  // Animal in danger first, then automatic flags, then the rest, oldest first.
  if (type === 'REPORT') request = supabase.from('platform_reports_view').select('*', { count: 'exact' }).in('status', ['OPEN', 'IN_REVIEW'])
    .order('priority').order('created_at');
  else if (type === 'ACCOUNT') request = supabase.from('platform_accounts_view').select('*', { count: 'exact' }).order('display_name');
  else request = supabase.from('platform_listings_view').select('*', { count: 'exact' }).order('title');
  if (query.trim()) {
    const field = type === 'REPORT' ? 'category' : type === 'ACCOUNT' ? 'display_name' : 'title';
    request = request.ilike(field, `%${query.trim().replace(/[\\%_]/g, '\\$&')}%`);
  }
  const response = await result(request.order('id').range(page * 25, page * 25 + 24));
  return { rows: response.data, count: response.count };
}

export async function loadPlatformAudit() {
  return (await result(supabase.from('audit_logs').select('id,actor_id,action,target_table,target_id,metadata,created_at')
    .order('created_at', { ascending: false }).limit(25))).data;
}

export async function loadPlatformRole() {
  return (await result(supabase.from('admin_profile_view').select('role').maybeSingle())).data?.role || null;
}

export async function loadPlatformItem(type, id) {
  const table = type === 'ACCOUNT' ? 'platform_accounts_view' : type === 'LISTING' ? 'platform_listings_view' : 'platform_reports_view';
  return (await result(supabase.from(table).select('*').eq('id', id).single())).data;
}
