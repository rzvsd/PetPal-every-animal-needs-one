import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useApp } from '../context/AppContext';
import { friendlyError } from '../services/errors';
import { fosterRpc, loadFosterCase, loadFosterHome, loadFosterRequest, saveFosterItem } from '../services/fosterApi';
import ReportSheet, { reportSentText } from '../components/ReportSheet';
import { useReducedPetMotion } from '../components/Motion';
import { useFosterData } from '../foster/useFosterData';
import { Button, Celebrate, ConfirmSheet, Field, Notice, Sheet, fmt } from '../foster/ui';
import Today from '../foster/Today';
import Find, { CaseDetail, HomeDetail, OfferSheet } from '../foster/Find';
import MyAnimals from '../foster/MyAnimals';
import AnimalStory from '../foster/AnimalStory';
import { CaseStory, HomeSettings, JoinHomeSheet } from '../foster/Manage';
import { CaseWizard, HomeWizard } from '../foster/Wizard';
import '../foster/foster.css';
import { person } from '../ui/kit';
import Activity from '../foster/Activity';

// Accept is one sheet that says what PetPal does not check and swaps phones.
function AcceptSheet({ request, busy, onClose, onAccept }) {
  const { t, user } = useApp();
  const [phone, setPhone] = useState('');
  useEffect(() => { if (request) setPhone(''); }, [request]);
  if (!request) return null;
  const other = person(request.sender_id === user.id ? request.recipient_name : request.sender_name, t);
  const animal = request.animal_name;
  return <Sheet open={Boolean(request)} onClose={onClose} title={fmt(t('fx.acceptTitle'), { animal })}
    footer={<><Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
      <Button disabled={busy} onClick={() => onAccept(request, phone.trim())}>{busy ? t('fx.loading') : t('fx.accept')}</Button></>}>
    <Notice>{t('fx.acceptNoChecks')}</Notice>
    <ul className="fx-stack" style={{ paddingLeft: 18, listStyle: 'disc', gap: 6 }}>
      {['acceptCheck1', 'acceptCheck2', 'acceptCheck3'].map(key => <li key={key}>{fmt(t(`fx.${key}`), { animal, name: other })}</li>)}</ul>
    <Field label={fmt(t('fx.acceptPhone'), { name: other })} hint={t('fx.acceptPhoneHint')}>
      <input className="fx-input" type="tel" maxLength={40} value={phone} onChange={event => setPhone(event.target.value)} /></Field>
  </Sheet>;
}

export default function FosterTab() {
  const { t, user, activeTab, setActiveTab, dataSource, requestOpenConversation, askForNotifications, requestedFosterPage, setRequestedFosterPage } = useApp();
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
  const [joining, setJoining] = useState(false);
  const [accepting, setAccepting] = useState(null);
  const [confirm, setConfirm] = useState(null);

  const push = useCallback(screen => setStack(current => [...current, screen]), []);
  const pop = useCallback(() => setStack(current => current.slice(0, -1)), []);
  const scrollRef = useRef(null);
  // Each Foster tab starts at its top, like a new page.
  useEffect(() => { setStack([]); if (scrollRef.current) scrollRef.current.scrollTop = 0; }, [activeTab]);
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
  // Accept and decline both go through a sheet first; decline cannot be undone.
  const respond = async (request, action, acknowledge = false, phone = '') => {
    const other = request.sender_id === user.id ? person(request.recipient_name, t) : person(request.sender_name, t);
    try {
      const ok = await act(async () => {
        const placementId = await fosterRpc('respond_foster_request', { request_id_input: request.id, action_input: action,
          expected_updated_at_input: request.updated_at, acknowledge_capacity_input: acknowledge, reason_input: '' });
        if (action === 'ACCEPT' && phone && placementId) {
          await fosterRpc('update_foster_placement', { placement_id_input: placementId, action_input: 'CONTACTS',
            data_input: request.case_owner_id === user.id ? { emergencyPhone: phone } : { fosterPhone: phone } });
        }
      }, action === 'ACCEPT' ? fmt(t('fx.acceptedNotice'), { animal: request.animal_name, name: request.home_name || other })
        : action === 'WITHDRAW' ? t('fx.withdrawnNotice') : t('fx.declinedNotice'));
      setCapacity(null);
      return ok;
    } catch { setCapacity({ request, phone }); return false; }
  };
  const answer = (request, action) => {
    if (action === 'ACCEPT') { setAccepting(request); return; }
    const other = request.sender_id === user.id ? person(request.recipient_name, t) : person(request.sender_name, t);
    setConfirm({ title: t('fx.declineTitle'), text: fmt(t('fx.declineText'), { name: other, animal: request.animal_name }), label: t('fx.decline'), danger: true,
      run: () => respond(request, 'DECLINE') });
  };
  const withdraw = request => setConfirm({ title: t('fx.withdrawTitle'), text: fmt(t('fx.withdrawText'), { animal: request.animal_name }),
    label: t('fx.withdrawOffer'), danger: true, run: () => respond(request, 'WITHDRAW') });
  const arrived = placement => setConfirm({ title: fmt(t('fx.arrivedConfirmTitle'), { animal: placement.name }),
    text: fmt(t('fx.arrivedConfirmText'), { animal: placement.name }), label: t('fx.markArrived'), run: async () => {
      if (await act(() => fosterRpc('update_foster_placement', { placement_id_input: placement.id, action_input: 'RECEIVE',
        data_input: { expectedUpdatedAt: placement.updated_at, body: '' } }))) {
        setCelebrate(fmt(t('fx.arrivedCelebration'), { animal: placement.name }));
        setTimeout(() => setCelebrate(''), 1600);
      }
    } });
  const consent = (request, approve) => act(() => fosterRpc('respond_transfer_consent', { request_id_input: request.id, approve_input: approve, note_input: '' }),
    t(approve ? 'fx.consentAgreed' : 'fx.consentRefused'));
  const tickTask = (task, completed) => fosterRpc('save_foster_task', { task_id_input: task.id, placement_id_input: task.placement_id, data_input: { completed } });
  const completeTask = async task => {
    if (await act(() => tickTask(task, true))) {
      setNotice({ tone: 'success', text: fmt(t('fx.taskDone'), { task: task.title }), undo: () => { setNotice(null); act(() => tickTask(task, false)); } });
    }
  };
  const runTeamInvite = (member, action) => act(() => fosterRpc('manage_foster_member', { home_id_input: member.home_id, profile_id_input: user.id, action_input: action }),
    t('fx.careUpdated'));
  const teamInvite = (member, action) => (action === 'DECLINE'
    ? setConfirm({ title: t('fx.declineTitle'), text: fmt(t('fx.declineTeamText'), { home: member.home_name }), label: t('fx.decline'), danger: true,
      run: () => runTeamInvite(member, action) })
    : runTeamInvite(member, action));
  const openCaseById = async caseId => {
    const item = await loadFosterCase(caseId).catch(() => null);
    if (item) push({ type: 'case', item }); else setNotice({ tone: 'error', text: t('fx.notAvailable') });
  };
  const openHomeById = async homeId => {
    const item = await loadFosterHome(homeId).catch(() => null);
    if (item) push({ type: 'home', item, readOnly: true }); else setNotice({ tone: 'error', text: t('fx.notAvailable') });
  };
  const openChat = id => requestOpenConversation(id, 'FOSTER');
  const openRequest = request => (request.placement_id ? push({ type: 'placement', id: request.placement_id })
    : request.case_owner_id === user.id ? push({ type: 'myCase', item: data.myCases.find(c => c.id === request.case_id) || { id: request.case_id, name: request.animal_name } })
      : request.conversation_id && openChat(request.conversation_id));
  const openCase = item => push({ type: item.responsible_id === user.id ? 'myCase' : 'case', item });
  // A chat asked for its animal: the placement once there is one, otherwise the animal's own page.
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    if (!requestedFosterPage) return;
    // Clearing the request re-runs this effect, so leaving the tab is tracked by `mounted` instead.
    const { requestId, caseId } = requestedFosterPage;
    setRequestedFosterPage(null);
    (async () => {
      const request = requestId ? await loadFosterRequest(requestId).catch(() => null) : null;
      if (!mounted.current) return;
      const animalId = request?.case_id || caseId;
      if (request?.placement_id) push({ type: 'placement', id: request.placement_id });
      else if (request ? request.case_owner_id === user.id : data.myCases.some(c => c.id === animalId)) {
        push({ type: 'myCase', item: data.myCases.find(c => c.id === animalId) || { id: animalId, name: request?.animal_name } });
      } else if (animalId) {
        const item = await loadFosterCase(animalId).catch(() => null);
        if (!mounted.current) return;
        if (item) push({ type: 'case', item }); else setNotice({ tone: 'error', text: t('fx.notAvailable') });
      } else setNotice({ tone: 'error', text: t('fx.notAvailable') });
    })();
  }, [requestedFosterPage]); // eslint-disable-line react-hooks/exhaustive-deps
  const sendOffer = async ({ kind, caseId, homeId, message }) => {
    await fosterRpc('create_foster_request', { request_id_input: crypto.randomUUID(), case_id_input: caseId, home_id_input: homeId, kind_input: kind, message_input: message });
    setOffer(null); refresh();
    setNotice({ tone: 'success', text: fmt(t('fx.offerSent'), { name: kind === 'APPLICATION' ? person(offer.item.responsible_name, t) : offer.item.name }) });
    askForNotifications('offer');
  };
  const needHome = () => push({ type: 'caseWizard' });
  const canFoster = () => setActiveTab('foster-find');

  const top = stack[stack.length - 1];
  const screen = top && (() => {
    switch (top.type) {
      case 'case': return <CaseDetail item={top.item} data={data} onBack={pop} onOffer={() => setOffer({ kind: 'APPLICATION', item: top.item })} onWithdraw={withdraw}
        onEdit={() => push({ type: 'caseWizard', item: top.item })} onReport={() => setReport({ profileId: top.item.responsible_id, listingId: top.item.id })}
        onToggleSave={() => act(() => saveFosterItem('animals', top.item.id, !data.saved.some(s => s.case_id === top.item.id)))} />;
      case 'home': return <HomeDetail home={top.item} onBack={pop} onInvite={top.readOnly ? null : () => setOffer({ kind: 'INVITE', item: top.item })}
        onReport={() => setReport({ profileId: top.item.profile_id })} />;
      case 'activity': return <Activity onBack={pop} onSeen={refresh} onOpen={payload => {
        const request = [...data.incoming, ...data.outgoing, ...data.consents].find(r => r.id === payload.requestId);
        if (payload.placementId) push({ type: 'placement', id: payload.placementId });
        else if (request) openRequest(request);
        else if (payload.conversationId) openChat(payload.conversationId);
      }} />;
      case 'placement': return <AnimalStory id={top.id} data={data} onBack={pop} onChanged={refresh} onOpenChat={openChat}
        onTransfer={placement => push({ type: 'caseWizard', transfer: placement })}
        onReport={p => {
          // The other side of this placement: the animal's side when I run the home, the home owner otherwise.
          const request = [...data.incoming, ...data.outgoing, ...data.consents].find(r => r.id === p.request_id);
          const animalSide = request && (request.sender_id === p.home_owner_id ? request.recipient_id : request.sender_id);
          setReport({ profileId: p.home_owner_id === user.id ? animalSide || null : p.home_owner_id, listingId: request?.case_id, category: 'ANIMAL_DANGER' });
        }} />;
      case 'myCase': {
        const item = data.myCases.find(c => c.id === top.item.id) || top.item;
        return <CaseStory item={item} data={data} busy={busy} onBack={pop} onEdit={() => push({ type: 'caseWizard', item })} onAnswer={answer}
          onPostAnother={() => push({ type: 'caseWizard', template: item })}
          onOpenChat={openChat} onOpenPlacement={id => push({ type: 'placement', id })} onChanged={refresh} onOpenHomeById={openHomeById} onWithdraw={withdraw} />;
      }
      case 'caseWizard': return <CaseWizard item={top.item} transfer={top.transfer} template={top.template} organizations={data.organizations} onClose={pop}
        onSaved={() => { pop(); refresh(); setNotice({ tone: 'success', text: t('fx.published') }); if (!top.item) { setActiveTab('foster-mine'); askForNotifications('published'); } }} />;
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
    <div className="fx-scroll" ref={scrollRef} hidden={Boolean(screen)}>
      {!live ? <><header className="fx-hello"><h1>{t('environment.fosterTitle')}</h1></header><Notice>{t('fx.liveOnly')}</Notice></>
        : data.error ? <Notice tone="error">{t('fx.couldNotLoad')} <button type="button" className="fx-notice-close" onClick={refresh}>{t('fx.retry')}</button></Notice>
          : <>
            <AnimatePresence>{notice && <Notice tone={notice.tone} onClose={() => setNotice(null)}>{notice.text}
              {notice.undo && <> <button type="button" className="fx-notice-close" onClick={notice.undo}>{t('fx.undo')}</button></>}</Notice>}</AnimatePresence>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={tab} initial={reduced ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={reduced ? undefined : { opacity: 0, y: -6 }}
                transition={{ duration: reduced ? 0 : 0.22 }}>
                {data.loading && !data.homes.length && !data.myCases.length && !data.incoming.length
                  ? <div className="fx-stack" style={{ marginTop: 24 }}>{[0, 1, 2].map(i => <div key={i} className="fx-skeleton" style={{ height: 110 }} />)}</div>
                  : tab === 'today' ? <Today data={data} busy={busy} onAnswer={answer} onArrived={arrived} onCompleteTask={completeTask}
                    onOpenPlacement={id => push({ type: 'placement', id })} onOpenRequest={openRequest} onOpenChat={openChat}
                    onTeamInvite={teamInvite} onConsent={consent} onOpenActivity={() => push({ type: 'activity' })} onOpenCaseById={openCaseById} onOpenHomeById={openHomeById} onWithdraw={withdraw} onNeedHome={needHome} onCanFoster={canFoster} onJoinWithCode={() => setJoining(true)} />
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
        <Button disabled={busy} onClick={() => respond(capacity.request, 'ACCEPT', true, capacity.phone)}>{t('fx.continueAnyway')}</Button></>}>
      <p className="fx-lead">{t('fx.capacityText')}</p>
    </Sheet>
    <AcceptSheet request={accepting} busy={busy} onClose={() => setAccepting(null)}
      onAccept={async (request, phone) => { setAccepting(null); await respond(request, 'ACCEPT', false, phone); }} />
    <ConfirmSheet open={Boolean(confirm)} title={confirm?.title} text={confirm?.text} confirmLabel={confirm?.label} danger={confirm?.danger} busy={busy}
      onClose={() => setConfirm(null)} onConfirm={async () => { const next = confirm; setConfirm(null); await next.run(); }} />
    <JoinHomeSheet open={joining} onClose={() => setJoining(false)} onJoined={home => {
      setJoining(false); refresh(); setNotice({ tone: 'success', text: fmt(t('fx.joined'), { home }) });
    }} />
    <ReportSheet target={report} onClose={() => setReport(null)} onSent={() => { setReport(null);
      setNotice({ tone: 'success', text: reportSentText(t) }); }} />
    <Celebrate show={Boolean(celebrate)} text={celebrate} />
  </div>;
}
