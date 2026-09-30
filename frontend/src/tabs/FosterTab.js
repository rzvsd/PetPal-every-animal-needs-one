import React, { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useApp } from '../context/AppContext';
import { friendlyError } from '../services/errors';
import { fosterRpc, reportFosterItem, saveFosterItem } from '../services/fosterApi';
import { useReducedPetMotion } from '../components/Motion';
import { useFosterData } from '../foster/useFosterData';
import { Button, Celebrate, Choices, Field, Notice, Sheet, fmt } from '../foster/ui';
import Today from '../foster/Today';
import Find, { CaseDetail, HomeDetail, OfferSheet } from '../foster/Find';
import MyAnimals from '../foster/MyAnimals';
import AnimalStory from '../foster/AnimalStory';
import { CaseStory, HomeSettings } from '../foster/Manage';
import { CaseWizard, HomeWizard } from '../foster/Wizard';
import '../foster/foster.css';

function ReportSheet({ target, onClose, onSent }) {
  const { t } = useApp();
  const [category, setCategory] = useState('SPAM');
  const [details, setDetails] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (target) { setCategory('SPAM'); setDetails(''); setError(''); } }, [target]);
  const send = async () => {
    setBusy(true); setError('');
    try { await reportFosterItem({ profileId: target.profileId, listingId: target.listingId, category, details }); onSent(); }
    catch (failure) { setError(friendlyError(failure, t)); }
    finally { setBusy(false); }
  };
  return <Sheet open={Boolean(target)} onClose={onClose} title={t('fx.report')}
    footer={<><Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
      <Button variant="danger" disabled={busy || !details.trim()} onClick={send}>{t('fx.report')}</Button></>}>
    <Field label={t('fx.reportWhy')}><Choices label={t('fx.reportWhy')} value={category} onChange={setCategory} columns={2}
      options={[['SPAM', t('fx.reportSpam')], ['ABUSE', t('fx.reportAbuse')], ['MISLEADING', t('fx.reportMisleading')], ['OTHER', t('fx.reportOther')]]} /></Field>
    <Field label={t('care.details')}><textarea className="fx-input" maxLength={2000} value={details} onChange={event => setDetails(event.target.value)} /></Field>
    {error && <Notice tone="error">{error}</Notice>}
  </Sheet>;
}

export default function FosterTab() {
  const { t, user, activeTab, setActiveTab, dataSource, requestOpenConversation } = useApp();
  const reduced = useReducedPetMotion();
  const live = dataSource === 'supabase';
  const data = useFosterData(user, live);
  const { refresh } = data;
  const [stack, setStack] = useState([]);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);
  const [offer, setOffer] = useState(null);
  const [pendingOffer, setPendingOffer] = useState(null);
  const [capacity, setCapacity] = useState(null);
  const [report, setReport] = useState(null);
  const [celebrate, setCelebrate] = useState('');

  const push = useCallback(screen => setStack(current => [...current, screen]), []);
  const pop = useCallback(() => setStack(current => current.slice(0, -1)), []);
  useEffect(() => { setStack([]); }, [activeTab]);
  // Good news fades on its own; errors stay until closed.
  useEffect(() => {
    if (notice?.tone !== 'success') return undefined;
    const timer = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(timer);
  }, [notice]);
  // After setting up a home from an offer, continue with that offer.
  useEffect(() => {
    if (pendingOffer && data.ownHomes.length) { setOffer(pendingOffer); setPendingOffer(null); }
  }, [pendingOffer, data.ownHomes.length]);

  const act = async (action, success) => {
    setBusy(true); setNotice(null);
    try { await action(); refresh(); if (success) setNotice({ tone: 'success', text: success }); return true; }
    catch (failure) {
      if (failure?.message === 'CAPACITY_ACK_REQUIRED') throw failure;
      setNotice({ tone: 'error', text: friendlyError(failure, t) }); return false;
    }
    finally { setBusy(false); }
  };
  const answer = async (request, action, acknowledge = false) => {
    const other = request.sender_id === user.id ? request.recipient_name : request.sender_name;
    try {
      await act(() => fosterRpc('respond_foster_request', { request_id_input: request.id, action_input: action,
        expected_updated_at_input: request.updated_at, acknowledge_capacity_input: acknowledge, reason_input: '' }),
      action === 'ACCEPT' ? fmt(t('fx.acceptedNotice'), { animal: request.animal_name, name: request.home_name || other }) : t('fx.declinedNotice'));
      setCapacity(null);
    } catch { setCapacity(request); }
  };
  const arrived = async placement => {
    if (await act(() => fosterRpc('update_foster_placement', { placement_id_input: placement.id, action_input: 'RECEIVE',
      data_input: { expectedUpdatedAt: placement.updated_at, body: '' } }))) {
      setCelebrate(fmt(t('fx.arrivedCelebration'), { animal: placement.name }));
      setTimeout(() => setCelebrate(''), 1600);
    }
  };
  const completeTask = task => act(() => fosterRpc('save_foster_task', { task_id_input: task.id, placement_id_input: task.placement_id, data_input: { completed: true } }));
  const teamInvite = (member, action) => act(() => fosterRpc('manage_foster_member', { home_id_input: member.home_id, profile_id_input: user.id, action_input: action }),
    t('fx.careUpdated'));
  const openChat = id => requestOpenConversation(id, 'FOSTER');
  const openRequest = request => (request.placement_id ? push({ type: 'placement', id: request.placement_id })
    : request.case_owner_id === user.id ? push({ type: 'myCase', item: data.myCases.find(c => c.id === request.case_id) || { id: request.case_id, name: request.animal_name } })
      : request.conversation_id && openChat(request.conversation_id));
  const openCase = item => push({ type: item.responsible_id === user.id ? 'myCase' : 'case', item });
  const sendOffer = async ({ kind, caseId, homeId, message }) => {
    await fosterRpc('create_foster_request', { request_id_input: crypto.randomUUID(), case_id_input: caseId, home_id_input: homeId, kind_input: kind, message_input: message });
    setOffer(null); refresh();
    setNotice({ tone: 'success', text: fmt(t('fx.offerSent'), { name: kind === 'APPLICATION' ? offer.item.responsible_name : offer.item.name }) });
  };
  const needHome = () => push({ type: 'caseWizard' });
  const canFoster = () => setActiveTab('foster-find');

  const top = stack[stack.length - 1];
  const screen = top && (() => {
    switch (top.type) {
      case 'case': return <CaseDetail item={top.item} data={data} onBack={pop} onOffer={() => setOffer({ kind: 'APPLICATION', item: top.item })}
        onEdit={() => push({ type: 'caseWizard', item: top.item })} onReport={() => setReport({ profileId: top.item.responsible_id, listingId: top.item.id })}
        onToggleSave={() => act(() => saveFosterItem('animals', top.item.id, !data.saved.some(s => s.case_id === top.item.id)))} />;
      case 'home': return <HomeDetail home={top.item} onBack={pop} onInvite={() => setOffer({ kind: 'INVITE', item: top.item })}
        onReport={() => setReport({ profileId: top.item.profile_id })} />;
      case 'placement': return <AnimalStory id={top.id} data={data} onBack={pop} onChanged={refresh} onOpenChat={openChat}
        onTransfer={placement => push({ type: 'caseWizard', transfer: placement })} onReport={p => setReport({ profileId: p.home_owner_id })} />;
      case 'myCase': {
        const item = data.myCases.find(c => c.id === top.item.id) || top.item;
        return <CaseStory item={item} data={data} busy={busy} onBack={pop} onEdit={() => push({ type: 'caseWizard', item })} onAnswer={answer}
          onOpenChat={openChat} onOpenPlacement={id => push({ type: 'placement', id })} onChanged={refresh} />;
      }
      case 'caseWizard': return <CaseWizard item={top.item} transfer={top.transfer} organizations={data.organizations} onClose={pop}
        onSaved={() => { pop(); refresh(); setNotice({ tone: 'success', text: t('fx.published') }); if (!top.item) setActiveTab('foster-mine'); }} />;
      case 'homeWizard': return <HomeWizard home={top.home} onClose={pop}
        onSaved={() => { pop(); refresh(); setNotice({ tone: 'success', text: t('fx.homeSaved') }); }} />;
      case 'homeSettings': {
        const home = data.homes.find(h => h.id === top.home.id) || top.home;
        return <HomeSettings home={home} data={data} onBack={pop} onEdit={() => push({ type: 'homeWizard', home })} onChanged={refresh} />;
      }
      default: return null;
    }
  })();

  const tab = activeTab === 'foster-find' ? 'find' : activeTab === 'foster-mine' ? 'mine' : 'today';
  return <div className="fx-shell" data-testid="foster-tab">
    <div className="fx-scroll" hidden={Boolean(screen)}>
      {!live ? <><header className="fx-hello"><h1>{t('environment.fosterTitle')}</h1></header><Notice>{t('fx.liveOnly')}</Notice></>
        : data.error ? <Notice tone="error">{t('fx.couldNotLoad')} <button type="button" className="fx-notice-close" onClick={refresh}>{t('fx.retry')}</button></Notice>
          : <>
            <AnimatePresence>{notice && <Notice tone={notice.tone} onClose={() => setNotice(null)}>{notice.text}</Notice>}</AnimatePresence>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={tab} initial={reduced ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={reduced ? undefined : { opacity: 0, y: -6 }}
                transition={{ duration: reduced ? 0 : 0.22 }}>
                {data.loading && !data.homes.length && !data.myCases.length && !data.incoming.length
                  ? <div className="fx-stack" style={{ marginTop: 24 }}>{[0, 1, 2].map(i => <div key={i} className="fx-skeleton" style={{ height: 110 }} />)}</div>
                  : tab === 'today' ? <Today data={data} busy={busy} onAnswer={answer} onArrived={arrived} onCompleteTask={completeTask}
                    onOpenPlacement={id => push({ type: 'placement', id })} onOpenRequest={openRequest} onOpenChat={openChat}
                    onTeamInvite={teamInvite} onNeedHome={needHome} onCanFoster={canFoster} />
                    : tab === 'find' ? <Find data={data} onOpenCase={openCase} onOpenHome={home => push({ type: 'home', item: home })} />
                      : <MyAnimals data={data} onOpenPlacement={id => push({ type: 'placement', id })} onOpenCase={item => push({ type: 'myCase', item })}
                        onOpenHomeSettings={home => push({ type: 'homeSettings', home })} onSetUpHome={() => push({ type: 'homeWizard' })} onPostAnimal={needHome} />}
              </motion.div>
            </AnimatePresence>
          </>}
    </div>
    <AnimatePresence>{screen && <motion.div key={`${top.type}-${stack.length}`} style={{ position: 'absolute', inset: 0, zIndex: 60 }}>{screen}</motion.div>}</AnimatePresence>

    <OfferSheet open={Boolean(offer)} kind={offer?.kind} item={offer?.item} data={data} onClose={() => setOffer(null)} onSend={sendOffer}
      onSetUpHome={() => { setPendingOffer(offer); setOffer(null); push({ type: 'homeWizard' }); }} />
    <Sheet open={Boolean(capacity)} onClose={() => setCapacity(null)} title={t('fx.capacityTitle')}
      footer={<><Button variant="secondary" onClick={() => setCapacity(null)}>{t('common.cancel')}</Button>
        <Button disabled={busy} onClick={() => answer(capacity, 'ACCEPT', true)}>{t('fx.continueAnyway')}</Button></>}>
      <p className="fx-lead">{t('fx.capacityText')}</p>
    </Sheet>
    <ReportSheet target={report} onClose={() => setReport(null)} onSent={() => { setReport(null); setNotice({ tone: 'success', text: t('care.reportSent') }); }} />
    <Celebrate show={Boolean(celebrate)} text={celebrate} />
  </div>;
}
