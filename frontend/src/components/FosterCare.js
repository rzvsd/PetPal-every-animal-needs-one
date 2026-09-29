import React, { useCallback, useEffect, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Check, Clock, MessageCircle, Plus } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { friendlyError } from '../services/errors';
import { fosterRpc, loadFosterPlacement, loadMoreFosterJournal, loadMoreFosterTasks } from '../services/fosterApi';
import { FosterCheck, FosterField, FosterForm, FosterInfo, FosterPhoto, FosterScreen, FosterSelect, FosterStatus } from './FosterComponents';
import { FosterReasonForm } from './FosterForms';

export function FosterTeam({ home, members, spaces, onClose, onChanged }) {
  const { t, user } = useApp();
  const [form, setForm] = useState(null);
  const [profileId, setProfileId] = useState('');
  const [role, setRole] = useState('CARER');
  const [spaceName, setSpaceName] = useState('');
  const [isolation, setIsolation] = useState(false);
  const [copied, setCopied] = useState(false);
  const owner = home.my_role === 'OWNER';
  return <FosterScreen title={t('care.team')} onClose={onClose}><div className="foster-detail-body">
    <div className="foster-card"><h3>{t('care.accountId')}</h3><p className="foster-id">{user.id}</p>
      <button type="button" className="foster-secondary" onClick={async () => { try { await navigator.clipboard.writeText(user.id); setCopied(true); } catch { setCopied(false); } }}>{t(copied ? 'care.done' : 'care.copy')}</button></div>
    <h3>{home.name}</h3>
    {members.filter(m => m.home_id === home.id).map(member => <div className="foster-card" key={member.profile_id}>
      <h3>{member.display_name}</h3><p className="foster-muted">{t(`care.${member.role}`)} · {member.status === 'ACTIVE' ? t('care.platformActive') : t(`care.${member.status}`)}</p>
      {owner && member.role !== 'OWNER' && ['ACTIVE', 'INVITED'].includes(member.status) &&
        <button type="button" className="foster-danger" onClick={() => setForm({ type: 'revoke', member })}>{t('care.revokeMember')}</button>}
    </div>)}
    {owner && <button type="button" className="foster-primary" onClick={() => { setProfileId(''); setForm({ type: 'invite' }); }}><Plus size={17} />{t('care.inviteMember')}</button>}
    <h3>{t('care.spaces')}</h3>
    {spaces.map(space => <div className="foster-card" key={space.id}><h3>{space.name}</h3>{space.isolation && <FosterStatus value="ISOLATION" />}</div>)}
    {owner && <button type="button" className="foster-secondary" onClick={() => { setSpaceName(''); setIsolation(false); setForm({ type: 'space' }); }}><Plus size={17} />{t('care.addSpace')}</button>}
    <AnimatePresence mode="wait" initial={false}>
      {form?.type === 'invite' && <div className="foster-screen-host" key="invite">
        <FosterForm values={{ profileId, role }} title={t('care.inviteMember')} onClose={() => setForm(null)} onSaved={onChanged}
          onSave={() => fosterRpc('manage_foster_member', { home_id_input: home.id, profile_id_input: profileId.trim(), action_input: 'INVITE', role_input: role })}>
          <FosterField label={t('care.memberId')} required pattern="[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}" value={profileId} onChange={e => setProfileId(e.target.value)} />
          <p className="foster-muted">{t('care.memberIdHint')}</p>
          <FosterSelect label={t('care.role')} value={role} onChange={setRole} options={['CARER', 'READER'].map(value => [value, t(`care.${value}`)])} />
        </FosterForm>
      </div>}
      {form?.type === 'space' && <div className="foster-screen-host" key="space">
        <FosterForm values={{ spaceName, isolation }} title={t('care.addSpace')} onClose={() => setForm(null)} onSaved={onChanged}
          onSave={() => fosterRpc('save_foster_space', { home_id_input: home.id, name_input: spaceName, isolation_input: isolation })}>
          <FosterField label={t('care.name')} required maxLength={80} value={spaceName} onChange={e => setSpaceName(e.target.value)} />
          <FosterCheck label={t('care.isolation')} checked={isolation} onChange={setIsolation} />
        </FosterForm>
      </div>}
      {form?.type === 'revoke' && <div className="foster-screen-host" key="revoke">
        <FosterReasonForm title={t('care.revokeMember')} description={form.member.display_name} requireReason={false}
          onClose={() => setForm(null)} onSaved={onChanged} onSave={() => fosterRpc('manage_foster_member', {
            home_id_input: home.id, profile_id_input: form.member.profile_id, action_input: 'REVOKE',
          })} />
      </div>}
    </AnimatePresence>
  </div></FosterScreen>;
}

export default function FosterCare({ id, homes, team, spaces, onClose, onChanged, onTransfer }) {
  const { t, lang, user, requestOpenConversation } = useApp();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [form, setForm] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [journalHasMore, setJournalHasMore] = useState(false);
  const [tasksHasMore, setTasksHasMore] = useState(false);
  const changed = useCallback(() => { setRevision(value => value + 1); onChanged(); }, [onChanged]);
  useEffect(() => {
    let cancelled = false;
    const load = () => loadFosterPlacement(id).then(value => {
      if (!cancelled) { setData(value); setJournalHasMore(value.journal.length === 50); setTasksHasMore(value.tasks.length === 100); setError(''); }
    }).catch(failure => { if (!cancelled) setError(friendlyError(failure, t)); });
    load();
    const focus = () => { if (document.visibilityState !== 'hidden') load(); };
    window.addEventListener('focus', focus); document.addEventListener('visibilitychange', focus);
    return () => { cancelled = true; window.removeEventListener('focus', focus); document.removeEventListener('visibilitychange', focus); };
  }, [id, revision, user.id, t]);
  const p = data?.placement;
  const home = homes.find(h => h.id === p?.home_id);
  const canCare = ['OWNER', 'CARER'].includes(home?.my_role);
  const owner = home?.my_role === 'OWNER';
  const active = ['IN_CARE', 'RESERVED'].includes(p?.status);
  const members = team.filter(m => m.home_id === p?.home_id && m.status === 'ACTIVE' && ['OWNER', 'CARER'].includes(m.role));
  const homeSpaces = spaces.filter(s => s.home_id === p?.home_id);
  const date = value => value ? new Date(value).toLocaleString(lang === 'ro' ? 'ro-RO' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '';
  const action = (type, title, description, requireReason = true) => setForm({ type, title, description, requireReason });
  const mutate = (type, body) => fosterRpc('update_foster_placement', { placement_id_input: p.id, action_input: type,
    data_input: { expectedUpdatedAt: p.updated_at, body } });
  const moreJournal = async () => {
    if (loadingMore) return;
    setLoadingMore(true);
    try { const rows = await loadMoreFosterJournal(id, data.journal.length); setData(current => ({ ...current, journal: [...current.journal, ...rows] })); setJournalHasMore(rows.length === 50); }
    catch (failure) { setError(friendlyError(failure, t)); }
    finally { setLoadingMore(false); }
  };
  const moreTasks = async () => {
    if (loadingMore) return;
    setLoadingMore(true);
    try { const rows = await loadMoreFosterTasks(id, data.tasks.length); setData(current => ({ ...current, tasks: [...current.tasks, ...rows] })); setTasksHasMore(rows.length === 100); }
    catch (failure) { setError(friendlyError(failure, t)); }
    finally { setLoadingMore(false); }
  };
  return <FosterScreen title={p?.name || t('care.loading')} onClose={onClose}>
    <div className="foster-detail-body">
      {error ? <div role="alert" className="foster-alert"><p>{error}</p><button type="button" className="foster-secondary" onClick={() => setRevision(v => v + 1)}>{t('care.retry')}</button></div>
        : !p ? <p role="status">{t('care.loading')}</p> : <>
          <FosterPhoto key={p.photo} src={p.photo} name={p.name} species={p.species} large />
          <div className="foster-card"><div className="foster-row foster-between"><h2>{p.name}</h2><FosterStatus value={p.status} /></div>
            <p className="foster-id">{p.animal_code}</p><p className="foster-muted">{p.home_name} · {t(p.species === 'DOG' ? 'care.dogs' : 'care.cats')}</p>
            <p className="foster-muted">{t('care.origin')}: {p.provenance}</p>
            {p.received_at && <p className="foster-muted">{t('care.receivedBy')} · {date(p.received_at)}</p>}
            <FosterInfo title={t('care.facts')}>{t('care.receiptInfo')}</FosterInfo>
            {p.conversation_id && (owner || !home) && <button type="button" className="foster-primary" onClick={() => requestOpenConversation(p.conversation_id, 'FOSTER')}><MessageCircle size={17} />{t('care.openConversation')}</button>}
          </div>
          {p.discrepancy && <div className="foster-alert"><strong>{t('care.discrepancy')}</strong><p>{t('care.discrepancyInfo')}</p></div>}
          <div className="foster-card"><h3>{t('care.care')}</h3><div className="foster-row"><FosterStatus value={p.care_state} /><span className="foster-muted">{p.space_name || t('care.unassigned')}</span></div>
            <p className="foster-muted">{t('care.carer')}: {p.carer_name || t('care.unassigned')}</p>
            {canCare && active && <button type="button" className="foster-secondary" onClick={() => setForm({ type: 'CARE' })}>{t('care.care')}</button>}
          </div>
          {owner && p.status === 'RESERVED' && <button type="button" className="foster-primary" onClick={() => action('RECEIVE', t('care.receive'), t('care.receiptInfo'), false)}>{t('care.receive')}</button>}
          {owner && p.status === 'IN_CARE' && <div className="foster-actions"><button type="button" className="foster-secondary" onClick={() => onTransfer(p)}>{t('care.transfer')}</button>
            <button type="button" className="foster-danger" onClick={() => action('END', t('care.endPlacement'))}>{t('care.endPlacement')}</button></div>}
          {p.request_id && (owner || !home) && <div className="foster-actions"><button type="button" className="foster-secondary" onClick={() => action('DISPUTE', t('care.dispute'), t('care.discrepancyInfo'))}>{t('care.dispute')}</button>
            {p.discrepancy && <button type="button" className="foster-secondary" onClick={() => action('CLARIFY', t('care.clarify'), t('care.discrepancyInfo'))}>{t('care.clarify')}</button>}</div>}
          <h3>{t('care.tasks')}</h3>
          {data.tasks.map(task => <div className="foster-card" key={task.id}><div className="foster-row"><span>{task.completed_at ? <Check size={18} /> : <Clock size={18} />}</span><h3>{task.title}</h3></div>
            <p className="foster-muted">{date(task.due_at)}{task.assignee_id ? ` · ${members.find(m => m.profile_id === task.assignee_id)?.display_name || t('care.unassigned')}` : ''}</p>
            {!task.completed_at && canCare && <button type="button" className="foster-secondary" onClick={() => setForm({ type: 'COMPLETE_TASK', task })}>{t('care.completeTask')}</button>}
          </div>)}
          {tasksHasMore && <button type="button" className="foster-secondary" disabled={loadingMore} onClick={moreTasks}>{t('care.loadMore')}</button>}
          {canCare && active && <button type="button" className="foster-secondary" onClick={() => setForm({ type: 'TASK' })}><Plus size={17} />{t('care.addTask')}</button>}
          <h3>{t('care.journal')}</h3><p className="foster-muted">{t('care.careDisclaimer')}</p>
          {canCare && <button type="button" className="foster-secondary" onClick={() => action('NOTE', t('care.addNote'), t('care.careDisclaimer'))}>{t('care.addNote')}</button>}
          <div className="foster-timeline">{data.journal.map(entry => <article key={entry.id}><strong>{entry.actor_name}</strong><div className="foster-muted">{date(entry.created_at)}</div><p>{entry.body}</p></article>)}</div>
          {journalHasMore && <button type="button" className="foster-secondary" disabled={loadingMore} onClick={moreJournal}>{t('care.loadMore')}</button>}
          {p.request_id && p.status === 'COMPLETED' && <div className="foster-card"><h3>{t('care.reviews')}</h3><p className="foster-muted">{t('care.reviewHint')}</p>
            {data.reviews.map(review => <p key={review.id}>{review.author_name} · {review.rating}/5 · {review.comment}</p>)}
            {(owner || !home) && <button type="button" className="foster-secondary" onClick={() => setForm({ type: 'REVIEW' })}>{t('care.review')}</button>}
          </div>}
        </>}
    </div>
    <AnimatePresence mode="wait" initial={false}>
      {form && p && !['CARE', 'TASK', 'REVIEW', 'COMPLETE_TASK'].includes(form.type) && <div className="foster-screen-host" key={form.type}>
        <FosterReasonForm title={form.title} description={form.description} requireReason={form.requireReason}
          onClose={() => setForm(null)} onSave={body => mutate(form.type, body)} onSaved={changed} />
      </div>}
      {form?.type === 'CARE' && <div className="foster-screen-host" key="CARE">
        <CareAssignment placement={p} members={members} spaces={homeSpaces} onClose={() => setForm(null)} onSaved={changed} />
      </div>}
      {form?.type === 'TASK' && <div className="foster-screen-host" key="TASK">
        <CareTask placement={p} members={members} onClose={() => setForm(null)} onSaved={changed} />
      </div>}
      {form?.type === 'COMPLETE_TASK' && <div className="foster-screen-host" key="COMPLETE_TASK">
        <FosterReasonForm title={t('care.completeTask')} description={form.task.title} requireReason={false} onClose={() => setForm(null)} onSaved={changed}
          onSave={() => fosterRpc('save_foster_task', { task_id_input: form.task.id, placement_id_input: p.id, data_input: { completed: true } })} />
      </div>}
      {form?.type === 'REVIEW' && <div className="foster-screen-host" key="REVIEW">
        <CareReview placement={p} existing={data.reviews.find(r => r.reviewer_id === user.id)} onClose={() => setForm(null)} onSaved={changed} />
      </div>}
    </AnimatePresence>
  </FosterScreen>;
}

function CareAssignment({ placement, members, spaces, onClose, onSaved }) {
  const { t } = useApp();
  const [careState, setCareState] = useState(placement.care_state);
  const [carerId, setCarerId] = useState(placement.carer_id || '');
  const [spaceId, setSpaceId] = useState(placement.space_id || '');
  return <FosterForm values={{ careState, carerId, spaceId }} title={t('care.care')} onClose={onClose} onSaved={onSaved} onSave={() => fosterRpc('update_foster_placement', {
    placement_id_input: placement.id, action_input: 'CARE', data_input: { careState, carerId, spaceId, expectedUpdatedAt: placement.updated_at },
  })}>
    <FosterSelect label={t('care.careState')} value={careState} onChange={setCareState} options={['NORMAL', 'ISOLATION', 'MEDICAL'].map(v => [v, t(`care.${v}`)])} />
    <FosterSelect label={t('care.carer')} value={carerId} onChange={setCarerId} empty={t('care.unassigned')} options={members.map(m => [m.profile_id, m.display_name])} />
    <FosterSelect label={t('care.space')} value={spaceId} onChange={setSpaceId} empty={t('care.unassigned')} options={spaces.map(s => [s.id, s.name])} />
  </FosterForm>;
}

function CareTask({ placement, members, onClose, onSaved }) {
  const { t } = useApp();
  const [id] = useState(() => crypto.randomUUID());
  const [title, setTitle] = useState('');
  const [due, setDue] = useState('');
  const [assigneeId, setAssigneeId] = useState(placement.carer_id || '');
  return <FosterForm values={{ title, due, assigneeId }} title={t('care.addTask')} onClose={onClose} onSaved={onSaved} onSave={() => fosterRpc('save_foster_task', {
    task_id_input: id, placement_id_input: placement.id, data_input: { title, dueAt: due ? new Date(due).toISOString() : null, assigneeId },
  })}>
    <FosterField label={t('care.taskTitle')} required maxLength={200} value={title} onChange={e => setTitle(e.target.value)} />
    <FosterField label={t('care.due')} type="datetime-local" value={due} onChange={e => setDue(e.target.value)} />
    <FosterSelect label={t('care.carer')} value={assigneeId} onChange={setAssigneeId} empty={t('care.unassigned')} options={members.map(m => [m.profile_id, m.display_name])} />
    <p className="foster-muted">{t('care.careDisclaimer')}</p>
  </FosterForm>;
}

function CareReview({ placement, existing, onClose, onSaved }) {
  const { t } = useApp();
  const [rating, setRating] = useState(existing?.rating || '5');
  const [comment, setComment] = useState(existing?.comment || '');
  return <FosterForm values={{ rating: String(rating), comment }} title={t('care.review')} onClose={onClose} onSaved={onSaved} onSave={() => fosterRpc('review_foster_placement', {
    placement_id_input: placement.id, rating_input: Number(rating), comment_input: comment,
  })}>
    <p className="foster-muted">{t('care.reviewHint')}</p>
    <FosterSelect label={t('care.rating')} value={rating} onChange={setRating} options={[1, 2, 3, 4, 5].map(v => [v, `${v}/5`])} />
    <FosterField label={t('care.comment')}><textarea maxLength={2000} value={comment} onChange={e => setComment(e.target.value)} /></FosterField>
  </FosterForm>;
}
