import React, { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, ArrowRightLeft, Check, Flag, Home, MessageCircle, MoreHorizontal, Phone, Plus, Send, Star, StopCircle, Undo2, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { friendlyError } from '../services/errors';
import { fosterRpc, loadFosterPlacement } from '../services/fosterApi';
import { Button, Card, Celebrate, Choices, Field, Journey, Notice, Photo, Screen, SectionTitle, Sheet, TaskCheck, fmt, itemMotion, listMotion } from './ui';
import { dueLabel } from './Today';
import { person } from '../ui/kit';

const stepIndex = { RESERVED: 1, IN_CARE: 3, COMPLETED: 4, CANCELLED: 1 };
const outcomes = ['RETURNED', 'ADOPTED_BY_FOSTER', 'ADOPTED_ELSEWHERE', 'LOST', 'DIED', 'OTHER'];

// Either side ends care with an outcome; the other side has 7 days to object.
function EndSheet({ open, outcome: preset, onClose, onConfirm }) {
  const { t } = useApp();
  const [outcome, setOutcome] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setOutcome(preset || ''); setNote(''); setError(''); } }, [open, preset]);
  const confirm = async () => {
    setBusy(true); setError('');
    try { await onConfirm(outcome, note.trim()); }
    catch (failure) { setError(friendlyError(failure, t)); }
    finally { setBusy(false); }
  };
  return <Sheet open={open} onClose={onClose} title={t('fx.endCareTitle')}
    footer={<><Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
      <Button variant="danger" disabled={busy || !outcome} onClick={confirm}>{busy ? t('fx.loading') : t('fx.endCare')}</Button></>}>
    <p className="fx-lead">{t('fx.endCareHint')}</p>
    <Choices label={t('fx.endCareTitle')} value={outcome} onChange={setOutcome} columns={2}
      options={outcomes.map(value => [value, t(`fx.outcome${value}`)])} />
    <Field label={t('fx.endNoteLabel')}><textarea className="fx-input" maxLength={2000} value={note} onChange={event => setNote(event.target.value)} /></Field>
    {error && <Notice tone="error">{error}</Notice>}
  </Sheet>;
}

// Phones and vet typed by each side, shown only to the two sides.
function ContactsSheet({ open, caseSide, placement, onClose, onSave }) {
  const { t } = useApp();
  const [form, setForm] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) { setForm({ emergencyPhone: placement?.emergency_phone || '', vetContact: placement?.vet_contact || '', fosterPhone: placement?.foster_phone || '' }); setError(''); }
  }, [open, placement]);
  const save = async () => {
    setBusy(true); setError('');
    try { await onSave(form); }
    catch (failure) { setError(friendlyError(failure, t)); }
    finally { setBusy(false); }
  };
  const field = (key, label, max, type = 'text') => <Field label={label}><input className="fx-input" type={type} maxLength={max} value={form[key] || ''}
    onChange={event => setForm(current => ({ ...current, [key]: event.target.value }))} /></Field>;
  return <Sheet open={open} onClose={onClose} title={t('fx.editContacts')}
    footer={<><Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
      <Button disabled={busy} onClick={save}>{busy ? t('fx.loading') : t('fx.done')}</Button></>}>
    <p className="fx-muted">{t('fx.contactsHint')}</p>
    {caseSide ? <>{field('emergencyPhone', t('fx.myPhone'), 40, 'tel')}{field('vetContact', t('fx.myVet'), 200)}</> : field('fosterPhone', t('fx.myPhone'), 40, 'tel')}
    {error && <Notice tone="error">{error}</Notice>}
  </Sheet>;
}

function dueFromChoice(choice) {
  if (choice === 'none') return null;
  const date = new Date();
  if (choice === 'tomorrow') date.setDate(date.getDate() + 1);
  date.setHours(choice === 'today' ? Math.max(date.getHours() + 1, 18) : 10, 0, 0, 0);
  return date.toISOString();
}

export function ReasonSheet({ open, title, description, required = true, danger, onClose, onConfirm }) {
  const { t } = useApp();
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setReason(''); setError(''); } }, [open]);
  const confirm = async () => {
    setBusy(true); setError('');
    try { await onConfirm(reason.trim()); }
    catch (failure) { setError(friendlyError(failure, t)); }
    finally { setBusy(false); }
  };
  return <Sheet open={open} onClose={onClose} title={title}
    footer={<><Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
      <Button variant={danger ? 'danger' : 'primary'} disabled={busy || (required && !reason.trim())} onClick={confirm}>{busy ? t('fx.loading') : t('fx.done')}</Button></>}>
    {description && <p className="fx-lead">{description}</p>}
    {required && <Field label={t('fx.reasonLabel')}><textarea className="fx-input" maxLength={2000} value={reason} onChange={event => setReason(event.target.value)} /></Field>}
    {error && <Notice tone="error">{error}</Notice>}
  </Sheet>;
}

export default function AnimalStory({ id, data, onBack, onChanged, onOpenChat, onTransfer, onReport }) {
  const { t, lang, user } = useApp();
  const [story, setStory] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [menu, setMenu] = useState(false);
  const [sheet, setSheet] = useState(null);
  const [celebrate, setCelebrate] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskWhen, setTaskWhen] = useState('today');
  const [note, setNote] = useState('');
  const [review, setReview] = useState({ rating: 5, comment: '' });

  const load = useCallback(() => loadFosterPlacement(id).then(value => { setStory(value); setError(''); })
    .catch(failure => setError(friendlyError(failure, t))), [id, t]);
  useEffect(() => { load(); }, [load]);

  const p = story?.placement;
  const home = data.homes.find(h => h.id === p?.home_id);
  const owner = home?.my_role === 'OWNER';
  const canCare = ['OWNER', 'CARER'].includes(home?.my_role);
  const caseSide = !home;
  const active = ['IN_CARE', 'RESERVED'].includes(p?.status);
  const now = new Date();
  const contestOpen = p?.status === 'COMPLETED' && p.contest_until && new Date(p.contest_until) > now;
  const chatOpen = active || (p?.chat_open_until && new Date(p.chat_open_until) > now);
  const canConfirmEnd = contestOpen && p.ended_by && p.ended_by !== user.id && !p.end_confirmed_at && (owner || caseSide);
  const request = [...data.incoming, ...data.outgoing].find(r => r.id === p?.request_id);
  const members = data.team.filter(m => m.home_id === p?.home_id && m.status === 'ACTIVE' && ['OWNER', 'CARER'].includes(m.role));
  const spaces = data.spaces.filter(s => s.home_id === p?.home_id);
  const other = caseSide ? home?.name || p?.home_name : request?.sender_id === user.id ? person(request?.recipient_name, t) : person(request?.sender_name, t);
  const date = value => new Date(value).toLocaleString(lang === 'ro' ? 'ro-RO' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' });
  // The journal also records system events; show notes as written and
  // milestones as short lines. Task creation is already in the checklist.
  const milestone = { RESERVED: 'fx.diaryReserved', RECEIVE: 'fx.diaryArrived', CARE: 'fx.diaryCare', END: 'fx.diaryEnded',
    CANCEL: 'fx.diaryCancelled', CANCELLED: 'fx.diaryCancelled', DISPUTE: 'fx.diaryDispute', CLARIFY: 'fx.diaryClarify',
    OWNER_NO_ANSWER: 'fx.diaryOwnerNoAnswer', CONTACTS: 'fx.diaryContacts', CONFIRM_END: 'fx.diaryConfirmEnd', TRANSFERRED: 'fx.diaryTransferred' };
  const diary = (story?.journal || []).filter(entry => entry.event !== 'TASK_CREATED').map(entry => {
    if (entry.event === 'NOTE') return { id: entry.id, created_at: entry.created_at, title: person(entry.actor_name, t), text: entry.body };
    if (entry.event === 'TASK_COMPLETED') return { id: entry.id, created_at: entry.created_at, milestone: true,
      title: fmt(t('fx.diaryTaskDone'), { task: entry.body }), text: person(entry.actor_name, t) };
    const withReason = ['END', 'CANCEL', 'CANCELLED', 'DISPUTE', 'CLARIFY', 'OWNER_NO_ANSWER'].includes(entry.event);
    return { id: entry.id, created_at: entry.created_at, milestone: true,
      title: fmt(t(milestone[entry.event] || 'fx.diaryCare'), { animal: p?.name || '' }),
      text: withReason ? `${person(entry.actor_name, t)}: ${entry.body}` : person(entry.actor_name, t) };
  });

  const run = async (action, success) => {
    setBusy(true); setNotice('');
    try {
      await action();
      await load();
      onChanged();
      if (success) setNotice(success);
      return true;
    } catch (failure) { setNotice(friendlyError(failure, t)); return false; }
    finally { setBusy(false); }
  };
  const mutate = (action, body = '') => fosterRpc('update_foster_placement', { placement_id_input: p.id, action_input: action,
    data_input: { expectedUpdatedAt: p.updated_at, body } });
  const markArrived = async () => {
    if (await run(() => mutate('RECEIVE'))) { setCelebrate(true); setTimeout(() => setCelebrate(false), 1600); }
  };
  const setCare = careState => run(() => fosterRpc('update_foster_placement', { placement_id_input: p.id, action_input: 'CARE',
    data_input: { careState, carerId: p.carer_id || '', spaceId: p.space_id || '', expectedUpdatedAt: p.updated_at } }), t('fx.careUpdated'));
  const setAssignment = (key, value) => run(() => fosterRpc('update_foster_placement', { placement_id_input: p.id, action_input: 'CARE',
    data_input: { careState: p.care_state, carerId: p.carer_id || '', spaceId: p.space_id || '', [key]: value, expectedUpdatedAt: p.updated_at } }), t('fx.careUpdated'));
  const addTask = async () => {
    if (!taskTitle.trim()) return;
    if (await run(() => fosterRpc('save_foster_task', { task_id_input: crypto.randomUUID(), placement_id_input: p.id,
      data_input: { title: taskTitle.trim(), dueAt: dueFromChoice(taskWhen), assigneeId: canCare ? p.carer_id || '' : '' } }))) setTaskTitle('');
  };
  const completeTask = task => run(() => fosterRpc('save_foster_task', { task_id_input: task.id, placement_id_input: p.id, data_input: { completed: true } }));
  const addNote = async () => { if (note.trim() && await run(() => mutate('NOTE', note.trim()))) setNote(''); };
  const endCare = async (outcome, body) => {
    if (await run(() => fosterRpc('update_foster_placement', { placement_id_input: p.id, action_input: 'END',
      data_input: { outcome, body, expectedUpdatedAt: p.updated_at } }), t('fx.careUpdated'))) setSheet(null);
  };
  const saveContacts = async form => {
    if (await run(() => fosterRpc('update_foster_placement', { placement_id_input: p.id, action_input: 'CONTACTS', data_input: form }), t('fx.careUpdated'))) setSheet(null);
  };
  const confirmEnding = () => run(() => mutate('CONFIRM_END'), t('fx.careUpdated'));
  const canWrite = canCare || caseSide;
  const shortDate = value => new Date(value).toLocaleDateString(lang === 'ro' ? 'ro-RO' : 'en-GB', { day: 'numeric', month: 'long' });

  const nextStep = !p ? null
    : p.status === 'RESERVED' && owner ? { text: fmt(t('fx.nextArrive'), { animal: p.name, name: other || '' }),
      action: <Button className="fx-button-block" icon={Home} disabled={busy} onClick={markArrived}>{t('fx.markArrived')}</Button> }
      : p.status === 'RESERVED' ? { text: fmt(t('fx.nextArriveOther'), { animal: p.name, home: p.home_name }) }
        : p.status === 'IN_CARE' ? { text: fmt(t('fx.nextCare'), { animal: p.name }) }
          : p.status === 'COMPLETED' ? { text: p.outcome ? fmt(t('fx.endedAs'), { outcome: t(`fx.outcome${p.outcome}`) }) : t('fx.nextFinished'),
            detail: canConfirmEnd ? fmt(t('fx.endingToConfirm'), { date: shortDate(p.contest_until) }) : p.end_confirmed_at ? t('fx.endingConfirmed') : '',
            action: <div className="fx-stack" style={{ gap: 8 }}>
              {canConfirmEnd && <div className="fx-actions">
                <Button icon={Check} disabled={busy} onClick={confirmEnding}>{t('fx.confirmEnding')}</Button>
                <Button variant="secondary" icon={AlertTriangle} onClick={() => setSheet({ type: 'DISPUTE', title: t('fx.somethingWrong'), description: t('care.discrepancyInfo') })}>{t('fx.somethingWrong')}</Button>
              </div>}
              {caseSide && request && <Button className="fx-button-block" variant={canConfirmEnd ? 'soft' : 'primary'} icon={Star} onClick={() => setSheet({ type: 'review' })}>{t('fx.leaveReview')}</Button>}
            </div> }
            : { text: t('care.CANCELLED') };

  const menuItems = !p ? [] : [
    owner && p.status === 'IN_CARE' && [ArrowRightLeft, t('fx.findAnotherHome'), () => onTransfer(p)],
    caseSide && p.status === 'IN_CARE' && [Undo2, t('fx.animalIsBack'), () => setSheet({ type: 'END', outcome: 'RETURNED' })],
    (owner || caseSide) && p.status === 'IN_CARE' && [StopCircle, t('fx.endCare'), () => setSheet({ type: 'END' })],
    (owner || caseSide) && active && [Phone, t('fx.editContacts'), () => setSheet({ type: 'CONTACTS' })],
    p.status === 'RESERVED' && request && (owner || caseSide) && [X, t('fx.cancelReservation'), () => setSheet({ type: 'CANCEL', title: t('fx.cancelReservation'), danger: true })],
    p.request_id && (owner || caseSide) && (active || contestOpen) && [AlertTriangle, t('fx.somethingWrong'), () => setSheet({ type: 'DISPUTE', title: t('fx.somethingWrong'), description: t('care.discrepancyInfo') })],
    p.discrepancy && (owner || caseSide) && [MessageCircle, t('fx.clarify'), () => setSheet({ type: 'CLARIFY', title: t('fx.clarify') })],
    [Flag, t('fx.report'), () => onReport(p), 'danger'],
  ].filter(Boolean);

  const confirmSheet = async reason => {
    const type = sheet.type;
    const ok = type === 'CANCEL'
      ? await run(() => fosterRpc('respond_foster_request', { request_id_input: request.id, action_input: 'CANCEL',
        expected_updated_at_input: request.updated_at, acknowledge_capacity_input: false, reason_input: reason }))
      : await run(() => mutate(type, reason));
    if (ok) setSheet(null);
  };

  return <Screen title={p?.name || t('fx.loading')} onBack={onBack}
    action={p && menuItems.length > 0 && <button type="button" className="fx-icon-button" aria-label={t('fx.moreOptions')} onClick={() => setMenu(true)}><MoreHorizontal size={20} /></button>}>
    {error ? <Notice tone="error">{error} <button type="button" className="fx-notice-close" onClick={load}>{t('fx.retry')}</button></Notice>
      : !p ? <div className="fx-stack" style={{ marginTop: 8 }}><div className="fx-skeleton" style={{ height: 240 }} /><div className="fx-skeleton" style={{ height: 120 }} /></div>
        : <motion.div variants={listMotion} initial="hidden" animate="show">
          <div className="fx-hero"><Photo src={p.photo} name={p.name} species={p.species} className="fx-photo-hero" /></div>

          <Card className="fx-lift">
            <div className="fx-row">
              <div className="fx-grow"><h2 className="fx-page-title" style={{ fontSize: 24 }}>{p.name}</h2>
                <p className="fx-muted">{p.home_name}{p.space_name ? ` · ${p.space_name}` : ''}</p></div>
              {p.conversation_id && (owner || caseSide) && chatOpen && <Button variant="soft" className="fx-button-small" icon={MessageCircle}
                onClick={() => onOpenChat(p.conversation_id)}>{t('fx.chat')}</Button>}
            </div>
            <div style={{ marginTop: 18 }}><Journey current={stepIndex[p.status] ?? 1}
              steps={[t('fx.stepOffered'), t('fx.stepAgreed'), t('fx.stepArrived'), t('fx.stepInCare'), t('fx.stepFinished')]} /></div>
          </Card>

          <AnimatePresence>{notice && <Notice onClose={() => setNotice('')}>{notice}</Notice>}</AnimatePresence>
          {p.discrepancy && <Notice tone="error">{t('care.discrepancyInfo')}</Notice>}

          <Card className="fx-next" style={{ marginTop: 14 }}>
            <p className="fx-eyebrow">{t('fx.nextStep')}</p>
            <p style={{ marginTop: 6, fontSize: 16, lineHeight: 1.5, fontWeight: 600 }}>{nextStep.text}</p>
            {nextStep.detail && <p className="fx-muted" style={{ marginTop: 4 }}>{nextStep.detail}</p>}
            {nextStep.action && <div style={{ marginTop: 14 }}>{nextStep.action}</div>}
          </Card>

          {active && (owner || caseSide) && <>
            <SectionTitle action={<Button variant="soft" className="fx-button-small" icon={Phone} onClick={() => setSheet({ type: 'CONTACTS' })}>{t('fx.editContacts')}</Button>}>
              {t('fx.contacts')}</SectionTitle>
            <Card>
              {[['emergency_phone', 'fx.ownerPhone', true], ['vet_contact', 'fx.vetContact', false], ['foster_phone', 'fx.fosterPhone', true]].map(([key, label, phone]) =>
                <p key={key} style={{ marginTop: 6 }}><span className="fx-muted">{t(label)}: </span>
                  {p[key] ? (phone ? <a href={`tel:${p[key].replace(/[^+0-9]/g, '')}`} style={{ fontWeight: 650 }}>{p[key]}</a> : <strong>{p[key]}</strong>)
                    : <span className="fx-muted">{t('fx.notShared')}</span>}</p>)}
              {caseSide && !p.emergency_phone && <Notice>{t('fx.contactsMissingOwner')}</Notice>}
            </Card>
          </>}

          {canCare && active && <>
            <SectionTitle>{fmt(t('fx.howIsAnimal'), { animal: p.name })}</SectionTitle>
            <Choices label={t('care.careState')} value={p.care_state} onChange={setCare} columns={3}
              options={[['NORMAL', t('fx.stateWell')], ['ISOLATION', t('fx.stateQuiet')], ['MEDICAL', t('fx.stateVet')]]} />
            {spaces.length > 0 && <div style={{ marginTop: 10 }}><p className="fx-muted" style={{ margin: '14px 2px 8px' }}>{fmt(t('fx.whereStays'), { animal: p.name })}</p><Choices label={t('fx.spaces')} value={p.space_id || ''} onChange={value => setAssignment('spaceId', value)}
              options={spaces.map(s => [s.id, s.name])} /></div>}
            {members.length > 1 && <><p className="fx-muted" style={{ margin: '14px 2px 8px' }}>{fmt(t('fx.whoLooksAfter'), { animal: p.name })}</p>
              <Choices label={t('fx.team')} value={p.carer_id || ''} onChange={value => setAssignment('carerId', value)}
                options={members.map(m => [m.profile_id, person(m.display_name, t)])} /></>}
          </>}

          {(canWrite || story.tasks.length > 0) && p.status !== 'CANCELLED' && <>
            <SectionTitle>{t('fx.checklist')}</SectionTitle>
            <motion.div className="fx-stack" variants={listMotion} initial="hidden" animate="show">
              {story.tasks.map(task => {
                const label = task.completed_at ? t('fx.done') : dueLabel(task.due_at, t);
                return <TaskCheck key={task.id} done={Boolean(task.completed_at)} label={task.title} meta={label}
                  late={label === t('fx.overdue')} disabled={!canCare || busy} onToggle={() => completeTask(task)} />;
              })}
            </motion.div>
            {canWrite && active && <Card style={{ marginTop: 12 }}>
              <div className="fx-stack" style={{ gap: 10 }}>
                <input className="fx-input" value={taskTitle} maxLength={200} placeholder={t('fx.taskPlaceholder')} aria-label={t('fx.addTask')}
                  onChange={event => setTaskTitle(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') addTask(); }} />
                <div className="fx-row">
                  <div className="fx-grow"><Choices label={t('fx.when')} value={taskWhen} onChange={setTaskWhen}
                    options={[['today', t('fx.dueToday')], ['tomorrow', t('fx.dueTomorrow')], ['none', t('fx.noDate')]]} /></div>
                </div>
                <Button variant="soft" icon={Plus} disabled={busy || !taskTitle.trim()} onClick={addTask}>{t('fx.addTask')}</Button>
              </div>
            </Card>}
          </>}

          <SectionTitle>{t('fx.diary')}</SectionTitle>
          {canWrite && active && <div className="fx-composer" style={{ marginBottom: 16 }}>
            <input className="fx-input" value={note} maxLength={2000} placeholder={fmt(t('fx.diaryPlaceholder'), { animal: p.name })}
              aria-label={t('fx.diary')} onChange={event => setNote(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') addNote(); }} />
            <Button className="fx-button-small" aria-label={t('fx.add')} icon={Send} disabled={busy || !note.trim()} onClick={addNote} style={{ minHeight: 50 }} />
          </div>}
          {diary.length ? <div className="fx-diary">{diary.map(entry => <motion.article key={entry.id} variants={itemMotion} className={entry.milestone ? 'is-milestone' : ''}>
            <strong>{entry.title}</strong><time>{date(entry.created_at)}</time>{entry.text && <p>{entry.text}</p>}</motion.article>)}</div>
            : <p className="fx-muted">{t('fx.noDiary')}</p>}

          {story.reviews.length > 0 && <><SectionTitle>{t('care.reviews')}</SectionTitle>
            <div className="fx-stack">{story.reviews.map(item => <Card key={item.id}><p style={{ fontWeight: 650 }}>{'★'.repeat(item.rating)} · {item.author_name}</p>
              {item.comment && <p className="fx-muted" style={{ marginTop: 4 }}>{item.comment}</p>}</Card>)}</div></>}
        </motion.div>}

    <Sheet open={menu} onClose={() => setMenu(false)} title={t('fx.moreOptions')}>
      <div className="fx-menu">{menuItems.map(([Icon, label, onClick, tone]) => <button type="button" key={label} className={tone === 'danger' ? 'is-danger' : ''}
        onClick={() => { setMenu(false); onClick(); }}><Icon size={20} />{label}</button>)}</div>
    </Sheet>

    <EndSheet open={sheet?.type === 'END'} outcome={sheet?.outcome} onClose={() => setSheet(null)} onConfirm={endCare} />
    <ContactsSheet open={sheet?.type === 'CONTACTS'} caseSide={caseSide} placement={p} onClose={() => setSheet(null)} onSave={saveContacts} />
    <ReasonSheet open={Boolean(sheet && !['review', 'END', 'CONTACTS'].includes(sheet.type))} title={sheet?.title} description={sheet?.description} danger={sheet?.danger}
      onClose={() => setSheet(null)} onConfirm={confirmSheet} />

    <Sheet open={sheet?.type === 'review'} onClose={() => setSheet(null)} title={t('fx.howWasIt')}
      footer={<><Button variant="secondary" onClick={() => setSheet(null)}>{t('common.cancel')}</Button>
        <Button disabled={busy} onClick={async () => { if (await run(() => fosterRpc('review_foster_placement', { placement_id_input: p.id,
          rating_input: review.rating, comment_input: review.comment }), t('fx.careUpdated'))) setSheet(null); }}>{t('fx.done')}</Button></>}>
      <Choices label={t('care.rating')} value={review.rating} onChange={rating => setReview(current => ({ ...current, rating }))} columns={3}
        options={[1, 2, 3, 4, 5].map(value => [value, '★'.repeat(value)])} />
      <Field label={t('care.comment')}><textarea className="fx-input" maxLength={2000} value={review.comment}
        onChange={event => setReview(current => ({ ...current, comment: event.target.value }))} /></Field>
      <p className="fx-muted">{t('care.reviewHint')}</p>
    </Sheet>

    <Celebrate show={celebrate} text={p ? fmt(t('fx.arrivedCelebration'), { animal: p.name }) : ''} />
  </Screen>;
}
