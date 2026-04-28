import { useCallback, useEffect, useMemo, useState } from 'react'
import type { AdminQueueItem, AdminRoleInfo, AuditItem, QueueType } from './api/adminApi'
import {
  approveDocument,
  approveListing,
  approveOrganization,
  closeSuspension,
  fetchAdminQueues,
  fetchAdminRole,
  fetchAuditTrail,
  getAdminEmail,
  pauseListing,
  rejectDocument,
  rejectOrganization,
  resolveReport,
  signInAdmin,
  signOutAdmin,
  suspendReportedProfile,
} from './api/adminApi'
import { isSupabaseConfigured } from './lib/supabase'
import './App.css'

const queueLabels: Record<QueueType, string> = {
  organization: 'Organization verification',
  listing: 'Listing approval',
  document: 'Document review',
  report: 'Report review',
  suspension: 'Suspension review',
}

type ConfirmationState = {
  title: string
  body: string
  confirmLabel: string
  defaultNote: string
  success: string
  action: (note: string) => Promise<void>
}

const demoLoginEnabled = import.meta.env.VITE_ENABLE_DEMO_LOGIN === 'true'
const canUseDemoLogin =
  demoLoginEnabled && ['localhost', '127.0.0.1'].includes(window.location.hostname)
const demoEmail = 'rescue@petpal.local'
const demoPassword = 'petpal-demo-password'

function App() {
  const [activeQueue, setActiveQueue] = useState<QueueType>('organization')
  const [queue, setQueue] = useState<AdminQueueItem[]>([])
  const [audit, setAudit] = useState<AuditItem[]>([])
  const [adminEmail, setAdminEmail] = useState<string | null>(null)
  const [adminRole, setAdminRole] = useState<AdminRoleInfo | null>(null)
  const [accessDenied, setAccessDenied] = useState(false)
  const [email, setEmail] = useState(demoEmail)
  const [password, setPassword] = useState(demoPassword)
  const [message, setMessage] = useState('Sign in with the local seeded admin account.')
  const [isLoading, setIsLoading] = useState(false)
  const [isActing, setIsActing] = useState(false)
  const [actionNote, setActionNote] = useState('')
  const [confirmation, setConfirmation] = useState<ConfirmationState | null>(null)

  const loadAdminData = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setMessage('Supabase env config is missing for the admin console.')
      return
    }

    setIsLoading(true)
    try {
      const roleInfo = await fetchAdminRole()

      if (!roleInfo) {
        setAdminRole(null)
        setAccessDenied(true)
        setQueue([])
        setAudit([])
        setMessage('This signed-in account does not have a PetPal admin role.')
        return
      }

      setAdminRole(roleInfo)
      setAccessDenied(false)

      const [items, auditItems] = await Promise.all([fetchAdminQueues(), fetchAuditTrail()])
      setQueue(items)
      setAudit(auditItems)
      setMessage(`Loaded ${items.length} live moderation items from Supabase.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to load live moderation data.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    async function boot() {
      if (!isSupabaseConfigured) return

      const currentEmail = await getAdminEmail()
      setAdminEmail(currentEmail)
      if (currentEmail) {
        await loadAdminData()
        return
      }

      if (canUseDemoLogin && new URLSearchParams(window.location.search).get('demo') === '1') {
        try {
          await signInAdmin(demoEmail, demoPassword)
          setAdminEmail(demoEmail)
          await loadAdminData()
        } catch (error) {
          setMessage(error instanceof Error ? error.message : 'Demo admin sign-in failed.')
        }
      }
    }

    void boot()
  }, [loadAdminData])

  const activeItems = queue.filter((item) => item.type === activeQueue)
  const selectedItem = activeItems[0] ?? null

  const counts = useMemo(
    () =>
      (Object.keys(queueLabels) as QueueType[]).map((type) => ({
        type,
        label: queueLabels[type],
        count: queue.filter((item) => item.type === type).length,
      })),
    [queue],
  )

  async function handleSignIn() {
    setIsLoading(true)
    try {
      await signInAdmin(email, password)
      setAdminEmail(email)
      await loadAdminData()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Admin sign-in failed.')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleSignOut() {
    await signOutAdmin()
    setAdminEmail(null)
    setAdminRole(null)
    setAccessDenied(false)
    setQueue([])
    setAudit([])
    setConfirmation(null)
    setActionNote('')
    setMessage('Signed out of the admin console.')
  }

  async function runAction(action: (note: string) => Promise<void>, success: string, defaultNote: string) {
    const note = actionNote.trim() || defaultNote
    setIsActing(true)
    try {
      await action(note)
      setMessage(success)
      setConfirmation(null)
      setActionNote('')
      await loadAdminData()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Admin action failed.')
    } finally {
      setIsActing(false)
    }
  }

  function requestConfirmation(nextConfirmation: ConfirmationState) {
    setConfirmation(nextConfirmation)
  }

  if (!isSupabaseConfigured) {
    return (
      <main className="shell">
        <section className="authPanel">
          <p className="eyebrow">PetPal Admin</p>
          <h1>Supabase config missing</h1>
          <p>Create `.env.local` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.</p>
        </section>
      </main>
    )
  }

  if (!adminEmail) {
    return (
      <main className="shell">
        <section className="authPanel">
          <p className="eyebrow">PetPal Admin</p>
          <h1>Safety control room</h1>
          <p className="heroCopy">Sign in with an admin account to load live verification, listing, report, and suspension queues.</p>
          {canUseDemoLogin ? <span className="localBadge">Local demo login enabled</span> : null}
          <div className="loginGrid">
            <label>
              Email
              <input onChange={(event) => setEmail(event.target.value)} value={email} />
            </label>
            <label>
              Password
              <input onChange={(event) => setPassword(event.target.value)} type="password" value={password} />
            </label>
          </div>
          <button className="primaryAction" disabled={isLoading} onClick={handleSignIn} type="button">
            {isLoading ? 'Signing in' : 'Sign in'}
          </button>
          <p className="statusLine">{message}</p>
        </section>
      </main>
    )
  }

  if (accessDenied) {
    return (
      <main className="shell">
        <section className="authPanel">
          <p className="eyebrow">PetPal Admin</p>
          <h1>Access denied</h1>
          <p className="heroCopy">
            {adminEmail} is signed in, but Supabase did not return an active PetPal admin role for this account.
          </p>
          <button className="primaryAction" onClick={handleSignOut} type="button">
            Sign out
          </button>
          <p className="statusLine">{message}</p>
        </section>
      </main>
    )
  }

  return (
    <main className="shell">
      <section className="hero">
        <div>
          <p className="eyebrow">PetPal Admin</p>
          <h1>Safety control room</h1>
          <p className="heroCopy">
            Live Supabase queues for rescuers, listings, documents, reports, suspensions, and audit visibility.
          </p>
        </div>
        <div className="operatorCard">
          <span>Signed in as</span>
          <strong>{adminEmail}</strong>
          <small>{adminRole ? `${roleLabel(adminRole.role)} / ${adminRole.displayName}` : 'Checking admin role'}</small>
          {canUseDemoLogin ? <em>Local demo mode</em> : null}
          <button className="textButton" onClick={handleSignOut} type="button">
            Sign out
          </button>
        </div>
      </section>

      <section className="statusBar">
        <span>{isLoading ? 'Loading live queues' : message}</span>
        <button className="textButton" disabled={isLoading} onClick={loadAdminData} type="button">
          Refresh
        </button>
      </section>

      <section aria-label="Moderation queues" className="queueGrid">
        {counts.map((item) => (
          <button
            className={`queueCard ${activeQueue === item.type ? 'selected' : ''}`}
            key={item.type}
            onClick={() => {
              setActiveQueue(item.type)
              setActionNote('')
              setConfirmation(null)
            }}
            type="button"
          >
            <span>{item.label}</span>
            <strong>{item.count}</strong>
          </button>
        ))}
      </section>

      <section className="workbench">
        <div className="queuePanel">
          <div className="panelHeader">
            <p className="eyebrow">{queueLabels[activeQueue]}</p>
            <h2>Live review queue</h2>
          </div>

          <div className="itemList">
            {activeItems.length > 0 ? (
              activeItems.map((item) => (
                <article className="reviewItem" key={item.id}>
                  <div>
                    <span className={`risk ${item.risk}`}>{item.risk} risk</span>
                    <h3>{item.title}</h3>
                    <p>{item.subtitle}</p>
                  </div>
                  <span className="status">{item.status}</span>
                </article>
              ))
            ) : (
              <div className="empty">
                <h2>No active cases</h2>
                <p>This live queue is clear.</p>
              </div>
            )}
          </div>
        </div>

        <div className="detailPanel">
          {selectedItem ? (
            <>
              <div className="panelHeader">
                <p className="eyebrow">Selected case</p>
                <h2>{selectedItem.title}</h2>
              </div>
              <dl className="caseMeta">
                <div>
                  <dt>Owner</dt>
                  <dd>{selectedItem.owner}</dd>
                </div>
                <div>
                  <dt>Submitted</dt>
                  <dd>{selectedItem.submittedAt}</dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd>{selectedItem.status}</dd>
                </div>
              </dl>
              <p className="caseDetails">{selectedItem.details}</p>
              <label className="noteField">
                Internal moderation note
                <textarea
                  onChange={(event) => setActionNote(event.target.value)}
                  placeholder="Add the reason that should land in the audit trail."
                  value={actionNote}
                />
              </label>
              <ActionBar item={selectedItem} isActing={isActing} requestConfirmation={requestConfirmation} />
            </>
          ) : (
            <div className="empty">
              <h2>No selected case</h2>
              <p>Choose a queue with active records to review a live moderation item.</p>
            </div>
          )}
        </div>
      </section>

      <section className="auditPanel">
        <div className="panelHeader">
          <p className="eyebrow">Audit trail</p>
          <h2>Recent live moderation actions</h2>
        </div>
        <div className="auditList">
          {audit.length > 0 ? (
            audit.map((item) => (
              <article className="auditItem" key={item.id}>
                <strong>{item.action}</strong>
                <span>{item.target}</span>
                <p>{item.note}</p>
                <small>{item.createdAt} / {item.actor}</small>
              </article>
            ))
          ) : (
            <div className="empty">
              <h2>No audit records yet</h2>
              <p>Run a moderation action to create a live audit entry.</p>
            </div>
          )}
        </div>
      </section>

      {confirmation ? (
        <div className="modalBackdrop" role="presentation">
          <section aria-modal="true" className="modalCard" role="dialog">
            <p className="eyebrow">Confirm admin action</p>
            <h2>{confirmation.title}</h2>
            <p>{confirmation.body}</p>
            <div className="actions">
              <button
                disabled={isActing}
                onClick={() => runAction(confirmation.action, confirmation.success, confirmation.defaultNote)}
                type="button"
              >
                {isActing ? 'Working' : confirmation.confirmLabel}
              </button>
              <button className="secondary" disabled={isActing} onClick={() => setConfirmation(null)} type="button">
                Cancel
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  )
}

function ActionBar({
  item,
  isActing,
  requestConfirmation,
}: {
  item: AdminQueueItem
  isActing: boolean
  requestConfirmation: (confirmation: ConfirmationState) => void
}) {
  if (item.type === 'organization') {
    return (
      <div className="actions">
        <button
          disabled={isActing}
          onClick={() =>
            requestConfirmation({
              title: 'Approve organization',
              body: 'This will mark the organization verification request as verified and allow trusted listing workflows.',
              confirmLabel: 'Approve organization',
              defaultNote: 'Approved from PetPal admin console after verification review.',
              success: 'Organization approved.',
              action: (note) => approveOrganization(item, note),
            })
          }
          type="button"
        >
          Approve organization
        </button>
        <button
          className="secondary"
          disabled={isActing}
          onClick={() =>
            requestConfirmation({
              title: 'Reject organization',
              body: 'This will reject the verification request and keep the organization from trusted publishing workflows.',
              confirmLabel: 'Reject organization',
              defaultNote: 'Rejected from PetPal admin console pending stronger proof.',
              success: 'Organization rejected.',
              action: (note) => rejectOrganization(item, note),
            })
          }
          type="button"
        >
          Reject
        </button>
      </div>
    )
  }

  if (item.type === 'listing') {
    return (
      <div className="actions">
        <button
          disabled={isActing}
          onClick={() =>
            requestConfirmation({
              title: 'Approve listing',
              body: 'This will publish the listing into the safe public discovery surface.',
              confirmLabel: 'Approve listing',
              defaultNote: 'Approved from PetPal admin console after public/private field review.',
              success: 'Listing approved.',
              action: (note) => approveListing(item, note),
            })
          }
          type="button"
        >
          Approve listing
        </button>
        <button
          className="secondary"
          disabled={isActing}
          onClick={() =>
            requestConfirmation({
              title: 'Pause listing',
              body: 'This will keep the listing out of public discovery until the rescue clarifies the issue.',
              confirmLabel: 'Pause listing',
              defaultNote: 'Paused from PetPal admin console for clarification.',
              success: 'Listing paused.',
              action: (note) => pauseListing(item, note),
            })
          }
          type="button"
        >
          Pause
        </button>
      </div>
    )
  }

  if (item.type === 'document') {
    return (
      <div className="actions">
        <button
          disabled={isActing}
          onClick={() =>
            requestConfirmation({
              title: 'Approve document',
              body: 'This will mark the private verification document as reviewed and accepted.',
              confirmLabel: 'Approve document',
              defaultNote: 'Approved from PetPal admin console after document review.',
              success: 'Document approved.',
              action: (note) => approveDocument(item, note),
            })
          }
          type="button"
        >
          Approve document
        </button>
        <button
          className="secondary"
          disabled={isActing}
          onClick={() =>
            requestConfirmation({
              title: 'Reject document',
              body: 'This will mark the private verification document as rejected and preserve the reason in the audit trail.',
              confirmLabel: 'Reject document',
              defaultNote: 'Rejected from PetPal admin console because the document did not satisfy verification requirements.',
              success: 'Document rejected.',
              action: (note) => rejectDocument(item, note),
            })
          }
          type="button"
        >
          Reject
        </button>
      </div>
    )
  }

  if (item.type === 'report') {
    return (
      <div className="actions">
        <button
          disabled={isActing}
          onClick={() =>
            requestConfirmation({
              title: 'Resolve report',
              body: 'This will close the report as resolved and write the decision to moderation history.',
              confirmLabel: 'Resolve report',
              defaultNote: 'Resolved from PetPal admin console after report review.',
              success: 'Report resolved.',
              action: (note) => resolveReport(item, note),
            })
          }
          type="button"
        >
          Resolve report
        </button>
        <button
          className="secondary"
          disabled={isActing}
          onClick={() =>
            requestConfirmation({
              title: 'Suspend reported user',
              body: 'This will suspend the reported profile and then close the report as resolved.',
              confirmLabel: 'Suspend user',
              defaultNote: 'Suspended from PetPal admin console after report review.',
              success: 'Reported profile suspended.',
              action: (note) => suspendReportedProfile(item, note),
            })
          }
          type="button"
        >
          Suspend reported user
        </button>
      </div>
    )
  }

  return (
    <div className="actions">
      <button
        disabled={isActing}
        onClick={() =>
          requestConfirmation({
            title: 'Close suspension',
            body: 'This will end the active suspension and record the closure reason.',
            confirmLabel: 'Close suspension',
            defaultNote: 'Closed from PetPal admin console after suspension review.',
            success: 'Suspension closed.',
            action: (note) => closeSuspension(item, note),
          })
        }
        type="button"
      >
        Close suspension
      </button>
    </div>
  )
}

function roleLabel(role: AdminRoleInfo['role']) {
  if (role === 'SUPER_ADMIN') return 'Super admin'
  if (role === 'DOCUMENT_REVIEWER') return 'Document reviewer'
  return 'Moderator'
}

export default App
