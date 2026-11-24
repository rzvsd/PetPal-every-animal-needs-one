import { supabase } from '../lib/supabase'

export type QueueType = 'listing' | 'report' | 'suspension'
export type QueueStatus = 'pending' | 'active' | 'open' | 'in_review'
export type QueueRisk = 'low' | 'medium' | 'high'

export type AdminRoleInfo = {
  profileId: string
  displayName: string
  role: 'MODERATOR' | 'DOCUMENT_REVIEWER' | 'SUPER_ADMIN'
  adminSince: string
}

export type ReportMessage = {
  from: string
  reporter: boolean
  body: string
  at: string
}

export type AdminQueueItem = {
  id: string
  type: QueueType
  title: string
  subtitle: string
  owner: string
  status: QueueStatus
  risk: QueueRisk
  submittedAt: string
  details: string
  messages: ReportMessage[]
  payload: Record<string, unknown>
}

export type AuditItem = {
  id: string
  action: string
  target: string
  actor: string
  note: string
  createdAt: string
}

type AdminRoleRow = {
  profile_id: string
  display_name: string
  role: AdminRoleInfo['role']
  admin_since: string
}

type AuditRow = {
  id: string
  action: string
  target_table: string | null
  target_id: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

function requireClient() {
  if (!supabase) {
    throw new Error('Supabase admin client is not configured.')
  }

  return supabase
}

export async function signInAdmin(email: string, password: string) {
  const client = requireClient()
  const { error } = await client.auth.signInWithPassword({ email, password })

  if (error) throw error
}

export async function signOutAdmin() {
  const client = requireClient()
  const { error } = await client.auth.signOut()

  if (error) throw error
}

export async function getAdminEmail() {
  const client = requireClient()
  const { data, error } = await client.auth.getUser()

  if (error) return null

  return data.user?.email ?? null
}

export async function fetchAdminRole() {
  const client = requireClient()
  const { data, error } = await client
    .from('admin_profile_view')
    .select('profile_id, display_name, role, admin_since')
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  const row = data as AdminRoleRow

  return {
    profileId: row.profile_id,
    displayName: row.display_name,
    role: row.role,
    adminSince: formatDate(row.admin_since),
  } satisfies AdminRoleInfo
}

export async function fetchAdminQueues() {
  const client = requireClient()
  const responses = await Promise.all([
    client.from('platform_reports_view').select('*').in('status', ['OPEN', 'IN_REVIEW']).order('priority').order('created_at').limit(500),
    client.from('platform_listings_view').select('*').in('status', ['ACTIVE', 'PAUSED']).order('updated_at').limit(500),
    client.from('platform_accounts_view').select('*').eq('suspended', true).order('updated_at').limit(500),
  ])
  for (const response of responses) if (response.error) throw response.error
  return responses.flatMap((response, index) => (response.data ?? []).map(row => ({
    id: row.id,
    type: (['report', 'listing', 'suspension'] as const)[index],
    title: row.category || row.title || row.display_name,
    subtitle: index === 0 ? `Reported by ${row.reporter_name ?? 'Automatic flag'}` : 'Platform moderation only',
    owner: (index === 0 ? row.reported_name || 'Deleted account' : row.responsible_name || row.display_name),
    status: mapStatus(row.status || 'ACTIVE'),
    risk: (index === 0 && row.priority === 0 ? 'high' : 'medium') as 'high' | 'medium',
    submittedAt: formatDate(row.created_at || row.updated_at),
    details: [row.listing_title && `Animal: ${row.listing_title}`, row.context?.animal && `Chat about ${row.context.animal}`, row.details || row.city]
      .filter(Boolean).join('\n'),
    messages: (row.context?.messages ?? []) as ReportMessage[],
    payload: { ...row, reportedProfileId: row.reported_profile_id, profileId: row.id },
  })))
}

export async function fetchAuditTrail() {
  const client = requireClient()

  const { data, error } = await client
    .from('audit_logs')
    .select('id, action, target_table, target_id, metadata, created_at')
    .order('created_at', { ascending: false })
    .limit(12)

  if (error) throw error

  return ((data as AuditRow[] | null) ?? []).map(mapAuditRow)
}

async function moderate(item: AdminQueueItem, kind: string, action: string, note: string) {
  const { error } = await requireClient().rpc('moderate_platform', {
    kind_input: kind, item_id_input: item.id, action_input: action,
    expected_updated_at_input: item.payload.updated_at, reason_input: note,
  })
  if (error) throw error
}

export async function approveListing(item: AdminQueueItem, note: string) {
  await moderate(item, 'LISTING', 'RESTORE', note)
}
export async function pauseListing(item: AdminQueueItem, note: string) {
  await moderate(item, 'LISTING', 'PAUSE', note)
}
export async function resolveReport(item: AdminQueueItem, note: string) {
  await moderate(item, 'REPORT', 'RESOLVED', note)
}
export async function suspendReportedProfile(item: AdminQueueItem, note: string) {
  const id = item.payload.reportedProfileId
  if (typeof id !== 'string') throw new Error('Report has no reported account.')
  const { data, error } = await requireClient().from('platform_accounts_view').select('*').eq('id', id).single()
  if (error) throw error
  await moderate({ ...item, id, payload: data }, 'ACCOUNT', 'SUSPEND', note)
  // Report remains open for an explicit independent resolution.
}
export async function closeSuspension(item: AdminQueueItem, note: string) {
  await moderate(item, 'ACCOUNT', 'RESTORE', note)
}

function mapAuditRow(row: AuditRow): AuditItem {
  return {
    id: row.id,
    action: row.action,
    target: row.target_table ? `${row.target_table}${row.target_id ? ` / ${row.target_id.slice(0, 8)}` : ''}` : 'Unknown target',
    actor: 'Supabase admin RPC',
    note: noteFromMetadata(row.metadata),
    createdAt: formatDate(row.created_at),
  }
}

function mapStatus(value: string): QueueStatus {
  if (value === 'OPEN') return 'open'
  if (value === 'IN_REVIEW') return 'in_review'
  if (value === 'PENDING' || value === 'PENDING_REVIEW') return 'pending'
  return 'active'
}

function noteFromMetadata(metadata: Record<string, unknown> | null) {
  if (!metadata) return 'No metadata recorded.'

  const reason = metadata.reason
  const notes = metadata.notes
  const toStatus = metadata.to_status

  if (typeof reason === 'string' && reason.length > 0) return reason
  if (typeof notes === 'string' && notes.length > 0) return notes
  if (typeof toStatus === 'string') return `Changed status to ${toStatus}.`

  return JSON.stringify(metadata)
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}
