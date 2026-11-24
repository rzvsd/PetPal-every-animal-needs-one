import React, { useEffect, useState } from 'react';
import { ChevronRight, Shield } from 'lucide-react';
import { OverScreen, Row } from '../ui/kit';
import { useApp } from '../context/AppContext';
import { friendlyError } from '../services/errors';
import { fosterRpc, loadPlatformAudit, loadPlatformItem, loadPlatformQueue, loadPlatformRole } from '../services/fosterApi';
import { FosterField, FosterForm, FosterPager, FosterScreen } from './FosterComponents';
import '../foster.css';

export default function PlatformAdminEntry() {
  const { user, dataSource, t } = useApp();
  const [role, setRole] = useState(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setRole(null); setOpen(false);
    if (dataSource === 'supabase') loadPlatformRole().then(value => { if (!cancelled) setRole(value); }).catch(() => {});
    return () => { cancelled = true; };
  }, [user.id, dataSource]);
  if (!['MODERATOR', 'SUPER_ADMIN'].includes(role)) return null;
  return <>
    <div className="ui-list pp-list"><Row leading={<span className="pp-row-icon"><Shield size={20} aria-hidden="true" /></span>}
      title={t('care.admin')} subtitle={t('care.adminHint')} onClick={() => setOpen(true)} /></div>
    {open && <OverScreen><div className="petpal-fullscreen foster-shell"><PlatformAdmin role={role} onClose={() => setOpen(false)} /></div></OverScreen>}
  </>;
}

function PlatformAdmin({ role, onClose }) {
  const { t, lang, user } = useApp();
  const [type, setType] = useState('REPORT');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [queue, setQueue] = useState({ rows: [], count: 0 });
  const [audit, setAudit] = useState([]);
  const [selected, setSelected] = useState(null);
  const [decision, setDecision] = useState(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(() => Promise.all([loadPlatformQueue(type, query, page), loadPlatformAudit()]).then(([rows, history]) => {
      if (!cancelled) { setQueue(rows); setAudit(history); setError(''); }
    }).catch(failure => { if (!cancelled) setError(friendlyError(failure, t)); }).finally(() => { if (!cancelled) setLoading(false); }), 180);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [type, query, page, revision, t]);
  const openLinked = async (kind, id) => {
    try { setSelected({ type: kind, item: await loadPlatformItem(kind, id) }); }
    catch (failure) { setError(friendlyError(failure, t)); }
  };
  const choose = (action, kind = selected.type) => { setReason(''); setDecision({ action, kind }); };
  const item = selected?.item;
  const date = value => new Date(value).toLocaleString(lang === 'ro' ? 'ro-RO' : 'en-GB');
  return <FosterScreen title={t('care.admin')} onClose={onClose}><div className="foster-detail-body">
    <p className="foster-alert">{t('care.adminHint')}</p>
    <div className="foster-tabs">{['REPORT', 'ACCOUNT', 'LISTING'].map(value => <button type="button" key={value} aria-pressed={type === value} onClick={() => { setType(value); setPage(0); setSelected(null); }}>{t(`care.${value}`)}</button>)}</div>
    <FosterField label={t('care.search')} value={query} onChange={e => { setQuery(e.target.value); setPage(0); }} />
    <button type="button" className="foster-secondary" onClick={() => setRevision(value => value + 1)}>{t('care.refresh')}</button>
    {error && <p role="alert" className="foster-alert">{error}</p>}
    {loading ? <p role="status">{t('care.loading')}</p> : queue.rows.map(row => <button type="button" key={row.id} className="foster-animal-row" onClick={() => setSelected({ type, item: row })}>
      <span className="foster-animal-info"><strong>{row.priority === 0 ? '⚠ ' : ''}{row.display_name || row.title || row.category}</strong><span className="foster-muted">{row.status ? t(`care.${row.status}`) : t(row.suspended ? 'care.suspended' : 'care.platformActive')}</span></span><ChevronRight size={19} />
    </button>)}
    <FosterPager page={page} count={queue.count} onChange={setPage} disabled={loading} />
    <h3>{t('care.audit')}</h3><div className="foster-timeline">{audit.map(row => <article key={row.id}><strong>{row.action}</strong>
      <p className="foster-muted">{row.actor?.display_name || (row.actor_id ? t('care.deletedAccount') : t('care.autoFlag'))}</p><p>{row.metadata?.reason || row.metadata?.notes}</p><span className="foster-muted">{date(row.created_at)}</span></article>)}</div>
    {selected && <FosterScreen title={item.display_name || item.title || item.category} onClose={() => setSelected(null)}><div className="foster-detail-body">
      {selected.type !== 'REPORT' && <p className="foster-id">{item.id}</p>}<p>{item.details || item.city}</p>
      {selected.type === 'REPORT' && <>
        <p className="foster-muted">{item.reporter_id ? item.reporter_name : t('care.autoFlag')} → {item.reported_name || t('care.deletedAccount')}</p>
        {item.listing_title && <p className="foster-muted">{item.listing_title}</p>}
        {item.context?.messages?.length > 0 && <section aria-label={t('care.recentMessages')}>
          <h3>{t('care.recentMessages')}{item.context.animal ? ` · ${item.context.animal}` : ''}</h3>
          <div className="foster-timeline">{item.context.messages.map((message, index) => <article key={index}>
            <strong>{message.from}{message.reporter ? ` (${t('care.reporterTag')})` : ''}</strong><p>{message.body}</p>
            <span className="foster-muted">{date(message.at)}</span></article>)}</div>
        </section>}
        <div className="foster-actions">{item.reported_profile_id && <button type="button" className="foster-secondary" onClick={() => openLinked('ACCOUNT', item.reported_profile_id)}>{t('care.ACCOUNT')}</button>}
          {item.listing_id && <button type="button" className="foster-secondary" onClick={() => openLinked('LISTING', item.listing_id)}>{t('care.LISTING')}</button>}</div>
        <div className="foster-stack">{['IN_REVIEW', 'RESOLVED', 'DISMISSED'].map(action => <button type="button" key={action} className="foster-secondary" onClick={() => choose(action)}>{t(`care.${action}`)}</button>)}</div>
      </>}
      {selected.type === 'ACCOUNT' && item.id !== user.id && item.role !== 'SUPER_ADMIN' && <div className="foster-stack">
        <p>{item.role}</p><button type="button" className="foster-danger" onClick={() => choose(item.suspended ? 'RESTORE' : 'SUSPEND')}>{t(item.suspended ? 'care.RESTORE' : 'care.SUSPEND')}</button>
        {role === 'SUPER_ADMIN' && <button type="button" className="foster-secondary" onClick={() => choose(item.role === 'MODERATOR' ? 'REVOKE_MODERATOR' : 'GRANT_MODERATOR', 'ROLE')}>{t(item.role === 'MODERATOR' ? 'care.REVOKE_MODERATOR' : 'care.GRANT_MODERATOR')}</button>}
      </div>}
      {selected.type === 'LISTING' && <div className="foster-stack"><p>{item.responsible_name}</p><p>{t(`care.${item.status}`)}</p>
        <button type="button" className="foster-danger" onClick={() => choose(item.status === 'PAUSED' ? 'RESTORE' : 'PAUSE')}>{t(item.status === 'PAUSED' ? 'care.RESTORE' : 'care.PAUSE')}</button></div>}
    </div></FosterScreen>}
    {decision && selected && <FosterForm values={reason} title={t(`care.${decision.action}`)} submitLabel="care.confirmDecision" onClose={() => setDecision(null)}
      onSaved={() => { setSelected(null); setRevision(value => value + 1); }} onSave={() => fosterRpc('moderate_platform', {
        kind_input: decision.kind, item_id_input: item.id, action_input: decision.action, expected_updated_at_input: item.updated_at, reason_input: reason,
      })}>
      <p>{item.display_name || item.title || item.category}</p><p className="foster-muted">{t('care.adminHint')}</p>
      <FosterField label={t('care.moderationReason')}><textarea required maxLength={2000} value={reason} onChange={e => setReason(e.target.value)} /></FosterField>
    </FosterForm>}
  </div></FosterScreen>;
}
