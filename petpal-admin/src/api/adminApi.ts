import { supabase } from '../lib/supabase'

export type QueueType = 'organization' | 'listing' | 'document' | 'report' | 'suspension'
export type QueueStatus = 'pending' | 'active' | 'open' | 'in_review'
export type QueueRisk = 'low' | 'medium' | 'high'

export type AdminRoleInfo = {
  profileId: string
  displayName: string
  role: 'MODERATOR' | 'DOCUMENT_REVIEWER' | 'SUPER_ADMIN'
  adminSince: string
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

type AdminQueueRow = {
  queue_type: string
  item_id: string
  status: string
  title: string
  city: string | null
  created_at: string
  payload: Record<string, unknown> | null
}

type AdminDocumentRow = {
  document_id: string
  status: string
  document_type: string
  storage_path: string
  profile_id: string | null
  profile_display_name: string | null
  organization_id: string | null
  organization_name: string | null
  city: string | null
  created_at: string
}

type AdminRoleRow = {
  profile_id: string
  display_name: string
  role: AdminRoleInfo['role']
  admin_since: string
}

type SuspensionRow = {
  id: string
  profile_id: string
  reason: string
  starts_at: string
  ends_at: string | null
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

  const { data: queueRows, error: queueError } = await client
    .from('admin_moderation_queue')
    .select('*')
    .order('created_at', { ascending: true })

  if (queueError) throw queueError

  const { data: documentRows, error: documentError } = await client
    .from('admin_document_queue')
    .select('*')
    .order('created_at', { ascending: true })

  if (documentError) throw documentError

  const { data: suspensions, error: suspensionError } = await client
    .from('user_suspensions')
    .select('id, profile_id, reason, starts_at, ends_at')
    .is('ends_at', null)
    .order('starts_at', { ascending: false })

  if (suspensionError) throw suspensionError

  return [
    ...((queueRows as AdminQueueRow[] | null) ?? []).map(mapQueueRow),
    ...((documentRows as AdminDocumentRow[] | null) ?? []).map(mapDocumentRow),
    ...((suspensions as SuspensionRow[] | null) ?? []).map(mapSuspensionRow),
  ]
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

export async function approveOrganization(item: AdminQueueItem, note: string) {
  const client = requireClient()
  const { error } = await client.rpc('admin_set_organization_verification_status', {
    request_id_input: item.id,
    target_status_input: 'VERIFIED',
    reason_input: note,
  })

  if (error) throw error
}

export async function rejectOrganization(item: AdminQueueItem, note: string) {
  const client = requireClient()
  const { error } = await client.rpc('admin_set_organization_verification_status', {
    request_id_input: item.id,
    target_status_input: 'REJECTED',
    reason_input: note,
  })

  if (error) throw error
}

export async function approveListing(item: AdminQueueItem, note: string) {
  const client = requireClient()
  const { error } = await client.rpc('admin_set_listing_review_status', {
    listing_id_input: item.id,
    target_status_input: 'ACTIVE',
    reason_input: note,
  })

  if (error) throw error
}

export async function pauseListing(item: AdminQueueItem, note: string) {
  const client = requireClient()
  const { error } = await client.rpc('admin_set_listing_review_status', {
    listing_id_input: item.id,
    target_status_input: 'PAUSED',
    reason_input: note,
  })

  if (error) throw error
}

export async function approveDocument(item: AdminQueueItem, note: string) {
  await reviewDocument(item, 'VERIFIED', note)
}

export async function rejectDocument(item: AdminQueueItem, note: string) {
  await reviewDocument(item, 'REJECTED', note)
}

export async function resolveReport(item: AdminQueueItem, note: string) {
  const client = requireClient()
  const { error } = await client.rpc('admin_resolve_report', {
    report_id_input: item.id,
    target_status_input: 'RESOLVED',
    notes_input: note,
  })

  if (error) throw error
}

export async function suspendReportedProfile(item: AdminQueueItem, note: string) {
  const profileId = item.payload.reportedProfileId

  if (typeof profileId !== 'string') {
    throw new Error('Report has no reported profile to suspend.')
  }

  await suspendProfile(profileId, note)
  await resolveReport(item, `${note} Report resolved after suspension.`)
}

export async function closeSuspension(item: AdminQueueItem, note: string) {
  const client = requireClient()
  const { error } = await client.rpc('admin_close_suspension', {
    suspension_id_input: item.id,
    notes_input: note,
  })

  if (error) throw error
}

async function reviewDocument(item: AdminQueueItem, targetStatus: 'VERIFIED' | 'REJECTED', note: string) {
  const client = requireClient()
  const { error } = await client.rpc('admin_review_verification_document', {
    document_id_input: item.id,
    target_status_input: targetStatus,
    notes_input: note,
  })

  if (error) throw error
}

async function suspendProfile(profileId: string, reason: string) {
  const client = requireClient()
  const { error } = await client.rpc('admin_suspend_profile', {
    profile_id_input: profileId,
    reason_input: reason,
    ends_at_input: null,
  })

  if (error) throw error
}

function mapQueueRow(row: AdminQueueRow): AdminQueueItem {
  const type = mapQueueType(row.queue_type)
  const payload = row.payload ?? {}

  return {
    id: row.item_id,
    type,
    title: row.title,
    subtitle: subtitleFor(type),
    owner: ownerFromPayload(payload),
    status: mapStatus(row.status),
    risk: riskFor(type),
    submittedAt: formatDate(row.created_at),
    details: detailsFor(row, payload),
    payload,
  }
}

function mapDocumentRow(row: AdminDocumentRow): AdminQueueItem {
  const owner = row.organization_name ?? row.profile_display_name ?? row.organization_id ?? row.profile_id ?? 'PetPal verification'

  return {
    id: row.document_id,
    type: 'document',
    title: row.document_type.replaceAll('_', ' ').toLowerCase(),
    subtitle: 'Document review',
    owner,
    status: mapStatus(row.status),
    risk: 'medium',
    submittedAt: formatDate(row.created_at),
    details: `${owner} uploaded ${row.document_type} for verification. Review the private storage path and linked request before approving.`,
    payload: {
      documentType: row.document_type,
      storagePath: row.storage_path,
      profileId: row.profile_id,
      organizationId: row.organization_id,
      city: row.city,
    },
  }
}

function mapSuspensionRow(row: SuspensionRow): AdminQueueItem {
  return {
    id: row.id,
    type: 'suspension',
    title: 'Active user suspension',
    subtitle: 'Suspension review',
    owner: row.profile_id,
    status: 'active',
    risk: 'high',
    submittedAt: formatDate(row.starts_at),
    details: row.reason,
    payload: { profileId: row.profile_id, endsAt: row.ends_at },
  }
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

function mapQueueType(value: string): QueueType {
  if (value === 'ORGANIZATION_VERIFICATION') return 'organization'
  if (value === 'LISTING_REVIEW') return 'listing'
  if (value === 'REPORT') return 'report'
  return 'report'
}

function mapStatus(value: string): QueueStatus {
  if (value === 'OPEN') return 'open'
  if (value === 'IN_REVIEW') return 'in_review'
  if (value === 'PENDING' || value === 'PENDING_REVIEW') return 'pending'
  return 'active'
}

function subtitleFor(type: QueueType) {
  if (type === 'organization') return 'Organization verification'
  if (type === 'listing') return 'Listing approval'
  if (type === 'document') return 'Document review'
  if (type === 'report') return 'Open report'
  return 'Suspension review'
}

function ownerFromPayload(payload: Record<string, unknown>) {
  const representative = payload.representativeName
  const email = payload.contactEmail
  const reportedProfileId = payload.reportedProfileId
  const organizationId = payload.organizationId

  if (typeof representative === 'string') return representative
  if (typeof email === 'string') return email
  if (typeof reportedProfileId === 'string') return reportedProfileId
  if (typeof organizationId === 'string') return organizationId
  return 'PetPal moderation'
}

function riskFor(type: QueueType): QueueRisk {
  if (type === 'report' || type === 'suspension') return 'high'
  if (type === 'organization' || type === 'document') return 'medium'
  return 'low'
}

function detailsFor(row: AdminQueueRow, payload: Record<string, unknown>) {
  if (row.queue_type === 'ORGANIZATION_VERIFICATION') {
    return `${payload.organizationType ?? 'Rescue'} request in ${row.city ?? 'the pilot region'} with contact ${payload.contactEmail ?? 'pending'}.`
  }

  if (row.queue_type === 'LISTING_REVIEW') {
    return `${payload.mode ?? 'Adopt/Foster'} listing in ${row.city ?? 'the pilot region'} awaiting public/private field review.`
  }

  return `Report category ${row.title}. Review reporter, reported profile, linked message, and linked listing before resolution.`
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
