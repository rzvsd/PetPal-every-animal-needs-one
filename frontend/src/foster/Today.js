import React from 'react';
import { motion } from 'framer-motion';
import { ChevronRight, Clock, Home, MessageCircle, Users } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Button, Card, Photo, SectionTitle, TaskCheck, fmt, listMotion } from './ui';
import { Art, person } from '../ui/kit';

export function dueLabel(dueAt, t) {
  if (!dueAt) return t('fx.noDate');
  const due = new Date(dueAt);
  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const days = Math.floor((new Date(due.getFullYear(), due.getMonth(), due.getDate()) - startOfDay) / 86400000);
  if (due < today && days <= 0) return t('fx.overdue');
  if (days === 0) return t('fx.dueToday');
  if (days === 1) return t('fx.dueTomorrow');
  // Written the way the chosen language writes dates: "2 octombrie", "2 October".
  return due.toLocaleDateString(document.documentElement.lang === 'ro' ? 'ro-RO' : 'en-GB', { day: 'numeric', month: 'long' });
}

export function IntentCards({ onNeedHome, onCanFoster, onJoinWithCode }) {
  const { t } = useApp();
  return <motion.div className="fx-stack" variants={listMotion} initial="hidden" animate="show">
    <Card className="fx-intent" onClick={onNeedHome}>
      <Art name="paw" size={64} play={false} />
      <span className="fx-grow"><h3>{t('fx.intentHelpTitle')}</h3><p>{t('fx.intentHelpText')}</p></span>
      <ChevronRight className="fx-chevron" size={20} />
    </Card>
    <Card className="fx-intent" onClick={onCanFoster}>
      <Art name="house" size={64} play={false} />
      <span className="fx-grow"><h3>{t('fx.intentFosterTitle')}</h3><p>{t('fx.intentFosterText')}</p></span>
      <ChevronRight className="fx-chevron" size={20} />
    </Card>
    {onJoinWithCode && <button type="button" className="fx-link-button" onClick={onJoinWithCode}>{t('fx.haveCode')}</button>}
  </motion.div>;
}

export function HowItWorks() {
  const { t } = useApp();
  return <ol className="fx-how">{['how1', 'how2', 'how3', 'how4'].map(key => <li key={key}>{t(`fx.${key}`)}</li>)}</ol>;
}

export default function Today({ data, busy, onAnswer, onArrived, onCompleteTask, onOpenPlacement, onOpenRequest,
  onOpenChat, onTeamInvite, onNeedHome, onCanFoster, onJoinWithCode }) {
  const { t, user } = useApp();
  const offers = data.incoming.filter(r => r.status === 'PENDING');
  const arriving = data.placements.filter(p => p.status === 'RESERVED');
  const invites = data.team.filter(m => m.profile_id === user.id && m.status === 'INVITED');
  const waiting = [
    ...data.outgoing.filter(r => r.status === 'PENDING').map(r => ({ key: r.id, request: r,
      text: fmt(t('fx.waitingFor'), { name: person(r.recipient_name, t), animal: r.animal_name }) })),
    ...data.placedElsewhere.filter(r => r.placement_status === 'RESERVED').map(r => ({ key: `placed-${r.id}`, request: r,
      text: fmt(t('fx.arrivingElsewhere'), { animal: r.animal_name, home: r.home_name }) })),
  ];
  const needsCount = offers.length + arriving.length + data.dueTasks.length + invites.length;
  const isNew = !data.homes.length && !data.myCases.length && !data.incoming.length && !data.outgoing.length;
  const animalOf = task => data.placements.find(p => p.id === task.placement_id);

  return <>
    <header className="fx-hello">
      <h1>{fmt(t('fx.hi'), { name: user.displayName || '' })}</h1>
      <p>{isNew ? t('fx.whatToDo') : needsCount ? t('fx.todaySubtitle') : t('fx.allCalm')}</p>
    </header>

    {isNew ? <>
      <div style={{ marginTop: 16 }}><IntentCards onNeedHome={onNeedHome} onCanFoster={onCanFoster} onJoinWithCode={onJoinWithCode} /></div>
      <SectionTitle>{t('fx.howItWorks')}</SectionTitle>
      <HowItWorks />
    </> : <>
      {needsCount > 0 && <>
        <SectionTitle count={needsCount}>{t('fx.needsYou')}</SectionTitle>
        <motion.div className="fx-stack" variants={listMotion} initial="hidden" animate="show">
          {offers.map((request, index) => <Card key={request.id} className={`fx-todo ${index === 0 ? 'fx-hero-card' : ''}`}>
            {index === 0 && <Photo src={request.photo} name={request.animal_name} species={request.species} className="fx-hero-card-photo" />}
            <div className="fx-todo-head">
              {index > 0 && <Photo src={request.photo} name={request.animal_name} species={request.species} className="fx-photo-sm" />}
              <div className="fx-grow">
                <h3>{fmt(t(request.kind === 'INVITE' ? 'fx.inviteReceived' : 'fx.offerReceived'), { name: person(request.sender_name, t), animal: request.animal_name })}</h3>
                <p>{t('fx.offerReceivedHint')}</p>
              </div>
            </div>
            {request.message && <p className="fx-quote">{request.message}</p>}
            <div className="fx-actions">
              <Button disabled={busy} onClick={() => onAnswer(request, 'ACCEPT')}>{t('fx.accept')}</Button>
              <Button variant="secondary" disabled={busy} onClick={() => onAnswer(request, 'DECLINE')}>{t('fx.notNow')}</Button>
              {request.conversation_id && <Button variant="soft" className="fx-button-icon" aria-label={t('fx.chat')}
                onClick={() => onOpenChat(request.conversation_id)} icon={MessageCircle} style={{ flex: '0 0 50px', padding: 0 }} />}
            </div>
          </Card>)}

          {arriving.map((placement, index) => <Card key={placement.id} className={`fx-todo ${!offers.length && index === 0 ? 'fx-hero-card' : ''}`}>
            {!offers.length && index === 0 && <Photo src={placement.photo} name={placement.name} species={placement.species} className="fx-hero-card-photo" />}
            <div className="fx-todo-head">
              {(offers.length || index > 0) && <Photo src={placement.photo} name={placement.name} species={placement.species} className="fx-photo-sm" />}
              <div className="fx-grow"><h3>{fmt(t('fx.arriving'), { animal: placement.name })}</h3>
                <p>{fmt(t('fx.arrivingHint'), { animal: placement.name })}</p></div>
            </div>
            <div className="fx-actions">
              <Button disabled={busy} onClick={() => onArrived(placement)} icon={Home}>{t('fx.markArrived')}</Button>
              <Button variant="secondary" onClick={() => onOpenPlacement(placement.id)} style={{ flex: '0 0 auto' }}>{t('fx.view')}</Button>
            </div>
          </Card>)}

          {data.dueTasks.map(task => {
            const label = dueLabel(task.due_at, t);
            return <TaskCheck key={task.id} label={fmt(t('fx.taskFor'), { task: task.title, animal: animalOf(task)?.name || '' })}
              meta={label} late={label === t('fx.overdue')} disabled={busy} onToggle={() => onCompleteTask(task)} />;
          })}

          {invites.map(invite => <Card key={invite.home_id} className="fx-todo">
            <div className="fx-todo-head"><span className="fx-intent-icon is-green" aria-hidden="true"><Users size={22} /></span>
              <div className="fx-grow"><h3>{fmt(t('fx.teamInvite'), { home: invite.home_name })}</h3></div></div>
            <div className="fx-actions">
              <Button disabled={busy} onClick={() => onTeamInvite(invite, 'ACCEPT')}>{t('fx.accept')}</Button>
              <Button variant="secondary" disabled={busy} onClick={() => onTeamInvite(invite, 'DECLINE')}>{t('fx.notNow')}</Button>
            </div>
          </Card>)}
        </motion.div>
      </>}

      {waiting.length > 0 && <>
        <SectionTitle>{t('fx.waitingOthers')}</SectionTitle>
        <motion.div className="fx-stack" variants={listMotion} initial="hidden" animate="show">
          {waiting.map(item => <Card key={item.key} onClick={() => onOpenRequest(item.request)}>
            <div className="fx-row">
              <Photo src={item.request.photo} name={item.request.animal_name} species={item.request.species} className="fx-photo-sm" />
              <p className="fx-grow" style={{ fontSize: 14, lineHeight: 1.4 }}>{item.text}</p>
              <Clock size={18} className="fx-chevron" />
            </div>
          </Card>)}
        </motion.div>
      </>}

      <SectionTitle>{t('fx.whatToDo')}</SectionTitle>
      <IntentCards onNeedHome={onNeedHome} onCanFoster={onCanFoster} onJoinWithCode={onJoinWithCode} />
    </>}
  </>;
}
