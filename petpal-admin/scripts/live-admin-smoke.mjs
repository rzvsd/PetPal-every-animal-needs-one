import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'

const env = loadEnv()
const supabaseUrl = process.env.VITE_SUPABASE_URL ?? env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY ?? env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY')
}

const admin = createClient(supabaseUrl, supabaseAnonKey)
const nonAdmin = createClient(supabaseUrl, supabaseAnonKey)

const adminSignIn = await admin.auth.signInWithPassword({
  email: 'rescue@petpal.local',
  password: 'petpal-demo-password',
})
if (adminSignIn.error) throw adminSignIn.error

const nonAdminSignIn = await nonAdmin.auth.signInWithPassword({
  email: 'adopter@petpal.local',
  password: 'petpal-demo-password',
})
if (nonAdminSignIn.error) throw nonAdminSignIn.error

const { data: roleRows, error: roleError } = await admin
  .from('admin_profile_view')
  .select('*')
if (roleError) throw roleError

const adminRole = roleRows.at(0)
if (!adminRole || adminRole.role !== 'SUPER_ADMIN') {
  throw new Error('Expected seeded SUPER_ADMIN in admin_profile_view')
}

const { data: adminRows, error: adminQueueError } = await admin
  .from('admin_moderation_queue')
  .select('*')
  .order('created_at', { ascending: true })
if (adminQueueError) throw adminQueueError

const { data: documentRows, error: documentQueueError } = await admin
  .from('admin_document_queue')
  .select('*')
  .order('created_at', { ascending: true })
if (documentQueueError) throw documentQueueError

const { data: suspensionRows, error: suspensionQueueError } = await admin
  .from('user_suspensions')
  .select('id, profile_id, ends_at')
  .is('ends_at', null)
if (suspensionQueueError) throw suspensionQueueError

const { data: nonAdminRows, error: nonAdminQueueError } = await nonAdmin
  .from('admin_moderation_queue')
  .select('*')
if (nonAdminQueueError) throw nonAdminQueueError

const { data: nonAdminDocumentRows, error: nonAdminDocumentError } = await nonAdmin
  .from('admin_document_queue')
  .select('*')
if (nonAdminDocumentError) throw nonAdminDocumentError

const reportRow = adminRows.find((row) => row.queue_type === 'REPORT')
if (!reportRow) {
  throw new Error('Expected seeded report in admin moderation queue')
}

const documentRow = documentRows.at(0)
if (!documentRow) {
  throw new Error('Expected seeded verification document in admin document queue')
}

const suspensionRow = suspensionRows.at(0)
if (!suspensionRow) {
  throw new Error('Expected seeded active suspension')
}

const resolveResult = await admin.rpc('admin_resolve_report', {
  report_id_input: reportRow.item_id,
  target_status_input: 'RESOLVED',
  notes_input: 'M11 live admin smoke resolved seeded report.',
})
if (resolveResult.error) throw resolveResult.error

const documentReviewResult = await admin.rpc('admin_review_verification_document', {
  document_id_input: documentRow.document_id,
  target_status_input: 'VERIFIED',
  notes_input: 'M11 live admin smoke approved seeded verification document.',
})
if (documentReviewResult.error) throw documentReviewResult.error

const suspensionCloseResult = await admin.rpc('admin_close_suspension', {
  suspension_id_input: suspensionRow.id,
  notes_input: 'M11 live admin smoke closed seeded suspension.',
})
if (suspensionCloseResult.error) throw suspensionCloseResult.error

const { data: reportAfter, error: reportAfterError } = await admin
  .from('reports')
  .select('id,status,resolved_at')
  .eq('id', reportRow.item_id)
  .single()
if (reportAfterError) throw reportAfterError

const { data: documentAfter, error: documentAfterError } = await admin
  .from('verification_documents')
  .select('id,status,reviewed_at')
  .eq('id', documentRow.document_id)
  .single()
if (documentAfterError) throw documentAfterError

const { data: suspensionAfter, error: suspensionAfterError } = await admin
  .from('user_suspensions')
  .select('id,ends_at')
  .eq('id', suspensionRow.id)
  .single()
if (suspensionAfterError) throw suspensionAfterError

const { data: auditRows, error: auditError } = await admin
  .from('audit_logs')
  .select('action,target_id,metadata')
  .in('target_id', [reportRow.item_id, documentRow.document_id, suspensionRow.id])
if (auditError) throw auditError

const counts = adminRows.reduce((acc, row) => {
  acc[row.queue_type] = (acc[row.queue_type] ?? 0) + 1
  return acc
}, {})

counts.DOCUMENT_REVIEW = documentRows.length
counts.SUSPENSION_REVIEW = suspensionRows.length

const result = {
  adminEmail: adminSignIn.data.user.email,
  adminRole: adminRole.role,
  adminQueueCounts: counts,
  adminQueueTotal: adminRows.length + documentRows.length + suspensionRows.length,
  nonAdminQueueTotal: nonAdminRows.length,
  nonAdminDocumentQueueTotal: nonAdminDocumentRows.length,
  resolvedReportStatus: reportAfter.status,
  resolvedReportHasTimestamp: Boolean(reportAfter.resolved_at),
  reviewedDocumentStatus: documentAfter.status,
  reviewedDocumentHasTimestamp: Boolean(documentAfter.reviewed_at),
  suspensionClosed: Boolean(suspensionAfter.ends_at),
  auditActionsFound: {
    report: auditRows.some((row) => row.action === 'REPORT_STATUS_CHANGED'),
    document: auditRows.some((row) => row.action === 'VERIFICATION_DOCUMENT_STATUS_CHANGED'),
    suspension: auditRows.some((row) => row.action === 'SUSPENSION_CLOSED'),
  },
}

console.log(JSON.stringify(result, null, 2))

await admin.auth.signOut()
await nonAdmin.auth.signOut()

function loadEnv() {
  try {
    const file = readFileSync(resolve('.env.local'), 'utf8')
    return Object.fromEntries(
      file
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#'))
        .map((line) => {
          const idx = line.indexOf('=')
          return [line.slice(0, idx), line.slice(idx + 1)]
        }),
    )
  } catch {
    return {}
  }
}
