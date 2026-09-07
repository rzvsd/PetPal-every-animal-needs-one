import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Bookmark, BookmarkCheck, Cat, ChevronRight, Dog, Home, Plus, RefreshCw, Search, Users } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { fosterRpc, loadFosterOverview, loadFosterDirectory, loadFosterRegistry, loadFosterHomeDetails,
  loadFosterRequests, loadRequestHistory, saveFosterItem } from '../services/fosterApi';
import { FosterInfo, FosterPager, FosterPhoto, FosterScreen, FosterSelect, FosterStatus } from '../components/FosterComponents';
import { FosterCaseForm, FosterHomeForm, FosterRegisterForm, FosterReportForm, FosterRequestForm, FosterReasonForm } from '../components/FosterForms';
import FosterCare, { FosterTeam } from '../components/FosterCare';
import '../foster.css';

const emptyPage = { rows: [], count: 0, loading: false, error: '' };
const emptyRegistryFilters = { query: '', species: '', status: '', spaceId: '', carerId: '', careState: '' };

export default function FosterTab() {
  const { t, user, activeTab, setActiveTab, dataSource, requestOpenConversation } = useApp();
  const [overview, setOverview] = useState({ homes: [], team: [], saved: [], organizations: [], spaces: [] });
  const [overviewError, setOverviewError] = useState('');
  const [homeId, setHomeId] = useState('');
  const [homeDetails, setHomeDetails] = useState({ spaces: [], dogs: 0, cats: 0, overdue: 0 });
  const [revision, setRevision] = useState(0);
  const [screen, setScreen] = useState(null);
  const [notice, setNotice] = useState('');
  const [directoryType, setDirectoryType] = useState('animals');
  const [directoryQuery, setDirectoryQuery] = useState('');
  const [directorySpecies, setDirectorySpecies] = useState('');
  const [urgent, setUrgent] = useState(false);
  const [savedOnly, setSavedOnly] = useState(false);
  const [directoryPage, setDirectoryPage] = useState(0);
  const [directory, setDirectory] = useState(emptyPage);
  const [registryFilters, setRegistryFilters] = useState(emptyRegistryFilters);
  const [registryPage, setRegistryPage] = useState(0);
  const [registry, setRegistry] = useState(emptyPage);
  const [direction, setDirection] = useState('incoming');
  const [requestPage, setRequestPage] = useState(0);
  const [requests, setRequests] = useState(emptyPage);
  const saving = useRef(false);
  const live = dataSource === 'supabase';
  const selectedHome = overview.homes.find(h => h.id === homeId);
  const ownHomes = overview.homes.filter(h => h.my_role === 'OWNER');
  const changed = useCallback(() => { setRevision(value => value + 1); }, []);
  const saved = useCallback(() => { setNotice(t('care.done')); changed(); }, [changed, t]);
  useEffect(() => { setScreen(null); }, [activeTab]);
  useEffect(() => {
    if (!live) return undefined;
    let cancelled = false;
    loadFosterOverview(user.id).then(value => {
      if (cancelled) return;
      setOverview(value); setOverviewError('');
      setHomeId(current => value.homes.some(h => h.id === current) ? current : value.homes[0]?.id || '');
    }).catch(error => { if (!cancelled) setOverviewError(error.message); });
    return () => { cancelled = true; };
  }, [live, user.id, revision]);
  useEffect(() => {
    if (!live) return undefined;
    const focus = () => { if (document.visibilityState !== 'hidden') changed(); };
    window.addEventListener('focus', focus); document.addEventListener('visibilitychange', focus);
    return () => { window.removeEventListener('focus', focus); document.removeEventListener('visibilitychange', focus); };
  }, [live, changed]);
  useEffect(() => {
    if (!live || activeTab !== 'foster') return undefined;
    let cancelled = false;
    setDirectory(current => ({ ...current, loading: true, error: '' }));
    const savedIds = savedOnly ? overview.saved.map(item => directoryType === 'homes' ? item.home_id : item.case_id).filter(Boolean) : undefined;
    const timer = setTimeout(() => {
      loadFosterDirectory({ type: directoryType === 'myCases' ? 'animals' : directoryType, query: directoryQuery,
        species: directorySpecies, urgent, page: directoryPage, savedIds, ownerId: directoryType === 'myCases' ? user.id : undefined })
        .then(value => { if (!cancelled) setDirectory({ ...value, loading: false, error: '' }); })
        .catch(error => { if (!cancelled) setDirectory({ ...emptyPage, error: error.message }); });
    }, 180);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [live, activeTab, directoryType, directoryQuery, directorySpecies, urgent, savedOnly, directoryPage, overview.saved, user.id, revision]);
  useEffect(() => {
    if (!live || !homeId) return undefined;
    let cancelled = false;
    loadFosterHomeDetails(homeId).then(value => { if (!cancelled) setHomeDetails(value); })
      .catch(error => { if (!cancelled) setOverviewError(error.message); });
    return () => { cancelled = true; };
  }, [live, homeId, revision]);
  useEffect(() => {
    if (!live || !homeId || activeTab !== 'foster-home') return undefined;
    let cancelled = false;
    setRegistry(current => ({ ...current, loading: true, error: '' }));
    const timer = setTimeout(() => loadFosterRegistry({ homeId, ...registryFilters, page: registryPage })
      .then(value => { if (!cancelled) setRegistry({ ...value, loading: false, error: '' }); })
      .catch(error => { if (!cancelled) setRegistry({ ...emptyPage, error: error.message }); }), 180);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [live, homeId, activeTab, registryFilters, registryPage, revision]);
  useEffect(() => {
    if (!live || activeTab !== 'foster-requests') return undefined;
    let cancelled = false;
    setRequests(current => ({ ...current, loading: true, error: '' }));
    loadFosterRequests(user.id, direction, requestPage).then(value => { if (!cancelled) setRequests({ ...value, loading: false, error: '' }); })
      .catch(error => { if (!cancelled) setRequests({ ...emptyPage, error: error.message }); });
    return () => { cancelled = true; };
  }, [live, activeTab, user.id, direction, requestPage, revision]);

  const setFilter = (key, value) => { setRegistryFilters(current => ({ ...current, [key]: value })); setRegistryPage(0); };
  const changeHome = value => { setHomeId(value); setRegistryPage(0); setRegistryFilters(emptyRegistryFilters); };
  const isSaved = (type, id) => overview.saved.some(item => item[type === 'homes' ? 'home_id' : 'case_id'] === id);
  const toggleSave = async (type, id) => {
    if (saving.current) return;
    saving.current = true;
    try { await saveFosterItem(type, id, !isSaved(type, id)); changed(); }
    catch (error) { setNotice(error.message); }
    finally { saving.current = false; }
  };
  const openApply = item => ownHomes.length ? setScreen({ type: 'request', kind: 'APPLICATION', item }) : setScreen({ type: 'homeForm' });
  const requestAction = (item, action, title, reason = false) => setScreen({ type: 'requestAction', item, action, title, reason });
  const pageState = page => page.loading ? <p role="status" className="foster-muted">{t('care.loading')}</p>
    : page.error ? <div role="alert" className="foster-alert">{page.error}<button type="button" className="foster-secondary" onClick={changed}>{t('care.retry')}</button></div>
      : !page.rows.length ? <div className="foster-empty"><Home size={32} /><h2>{t('care.noResults')}</h2><p className="foster-muted">{t('care.noResultsHint')}</p></div> : null;
  const close = () => setScreen(null);
  const sectionTitle = activeTab === 'foster-home' ? 'care.home' : activeTab === 'foster-requests' ? 'care.requests' : 'care.title';

  return <div className="foster-shell" data-testid="foster-tab">
    <div className="foster-scroll" hidden={Boolean(screen)}>
      <header className="foster-hero"><div className="foster-hero-row"><h1>{t(sectionTitle)}</h1>
        {live && <button type="button" onClick={changed} aria-label={t('care.refresh')}><RefreshCw size={18} /></button>}</div>
        <p>{activeTab === 'foster' ? t('care.subtitle') : t('care.facts')}</p></header>
      {!live ? <div className="foster-card"><p>{t('care.liveRequired')}</p></div> : <>
        {overviewError && <div role="alert" className="foster-alert">{overviewError}<button type="button" className="foster-secondary" onClick={changed}>{t('care.retry')}</button></div>}
        {notice && <div role="status" className="foster-success"><div className="foster-row foster-between"><p>{notice}</p><button type="button" className="foster-secondary" onClick={() => setNotice('')}>{t('care.close')}</button></div></div>}
        {activeTab === 'foster' && <>
          <div className="foster-tabs">{['animals', 'homes', 'myCases'].map(type => <button type="button" key={type} aria-pressed={directoryType === type}
            onClick={() => { setDirectoryType(type); setDirectoryPage(0); setSavedOnly(false); }}>{t(`care.${type}`)}</button>)}</div>
          <div className="foster-search"><Search size={19} /><input aria-label={t('care.search')} placeholder={t('care.search')} value={directoryQuery}
            onChange={event => { setDirectoryQuery(event.target.value); setDirectoryPage(0); }} /></div>
          <div className="foster-chips">
            <button type="button" aria-pressed={directorySpecies === 'DOG'} onClick={() => { setDirectorySpecies(value => value === 'DOG' ? '' : 'DOG'); setDirectoryPage(0); }}><Dog size={16} />{t('care.dogs')}</button>
            <button type="button" aria-pressed={directorySpecies === 'CAT'} onClick={() => { setDirectorySpecies(value => value === 'CAT' ? '' : 'CAT'); setDirectoryPage(0); }}><Cat size={16} />{t('care.cats')}</button>
            {directoryType !== 'homes' && <button type="button" aria-pressed={urgent} onClick={() => { setUrgent(!urgent); setDirectoryPage(0); }}>{t('care.urgent')}</button>}
            {directoryType !== 'myCases' && <button type="button" aria-pressed={savedOnly} onClick={() => { setSavedOnly(!savedOnly); setDirectoryPage(0); }}><Bookmark size={16} />{t('care.saved')}</button>}
          </div>
          {directoryType === 'myCases' && <button type="button" className="foster-primary" onClick={() => setScreen({ type: 'caseForm' })}><Plus size={17} />{t('care.postCase')}</button>}
          <FosterInfo title={t('care.facts')}>{t('care.boundary')}</FosterInfo>
          {pageState(directory)}
          {!directory.loading && directory.rows.map(item => <article className="foster-card" key={item.id}>
            <div className="foster-row"><FosterPhoto key={item.photo || item.photos?.[0]} src={item.photo || item.photos?.[0]} name={item.name} species={item.species} />
              <div style={{ minWidth: 0, flex: 1 }}><h2>{item.name}</h2><p className="foster-muted">{item.city}{item.area ? ` · ${item.area}` : ''}</p>
                {directoryType === 'homes' ? <FosterStatus value={item.availability} /> : <span className="foster-muted">{t(item.species === 'DOG' ? 'care.dogs' : 'care.cats')} · {t(`care.${item.duration || 'UNKNOWN'}`)}</span>}</div>
              <button type="button" className="foster-secondary" aria-label={t('care.saved')} aria-pressed={isSaved(directoryType, item.id)} onClick={() => toggleSave(directoryType, item.id)}>
                {isSaved(directoryType, item.id) ? <BookmarkCheck size={18} /> : <Bookmark size={18} />}</button></div>
            {directoryType !== 'homes' && <p className="foster-muted">{item.responsible_name}{item.organization_name ? ` · ${item.organization_name}` : ''}</p>}
            <div className="foster-actions"><button type="button" className="foster-secondary" onClick={() => setScreen({ type: directoryType === 'homes' ? 'homeDetail' : 'caseDetail', item })}>{t('care.details')}<ChevronRight size={16} /></button>
              {directoryType !== 'homes' && item.responsible_id === user.id ? <button type="button" className="foster-primary" onClick={() => setScreen({ type: 'caseForm', item })}>{t('care.editCase')}</button>
                : directoryType !== 'homes' ? <button type="button" className="foster-primary" onClick={() => openApply(item)}>{t('care.apply')}</button> : null}</div>
          </article>)}
          <FosterPager page={directoryPage} count={directory.count} onChange={setDirectoryPage} disabled={directory.loading} />
        </>}

        {activeTab === 'foster-home' && <>
          {overview.team.filter(member => member.profile_id === user.id && member.status === 'INVITED').map(member => <div className="foster-card" key={member.home_id}>
            <h3>{t('care.teamInvites')}</h3><p>{member.home_name} · {t(`care.${member.role}`)}</p><div className="foster-actions">
              {['ACCEPT', 'DECLINE'].map(action => <button type="button" key={action} className="foster-secondary" onClick={() => setScreen({ type: 'memberResponse', member, action })}>{t(action === 'ACCEPT' ? 'care.accept' : 'care.decline')}</button>)}</div></div>)}
          {!selectedHome ? <div className="foster-empty"><Home size={36} /><h2>{t('care.noHome')}</h2><p className="foster-muted">{t('care.noHomeHint')}</p>
            <button type="button" className="foster-primary" onClick={() => setScreen({ type: 'homeForm' })}>{t('care.addHome')}</button>
            <p className="foster-muted">{t('care.accountId')}</p><p className="foster-id">{user.id}</p></div> : <>
            <FosterSelect label={t('care.chooseHome')} value={homeId} onChange={changeHome} options={overview.homes.map(home => [home.id, home.name])} />
            <div className="foster-card" style={{ marginTop: 12 }}><div className="foster-row foster-between"><h2>{selectedHome.name}</h2><FosterStatus value={selectedHome.availability} /></div>
              <div className="foster-metric">{selectedHome.occupied} <small>/ {selectedHome.capacity}</small></div>
              <p className="foster-muted">{t('care.occupied')} / {t('care.declared')} · {selectedHome.reserved} {t('care.reserved')}</p>
              <div className={`foster-capacity-bar ${selectedHome.occupied + selectedHome.reserved > selectedHome.capacity ? 'over' : ''}`}><span style={{ width: `${Math.min(100, selectedHome.capacity ? (selectedHome.occupied + selectedHome.reserved) / selectedHome.capacity * 100 : selectedHome.occupied + selectedHome.reserved ? 100 : 0)}%` }} /></div>
              {selectedHome.occupied + selectedHome.reserved > selectedHome.capacity && <p className="foster-alert">{t('care.overCapacity')}</p>}
              <div className="foster-counts"><button type="button" onClick={() => setFilter('species', registryFilters.species === 'DOG' ? '' : 'DOG')}><Dog size={28} /><span>{t('care.dogs')}<strong>{homeDetails.dogs}</strong></span></button>
                <button type="button" onClick={() => setFilter('species', registryFilters.species === 'CAT' ? '' : 'CAT')}><Cat size={27} /><span>{t('care.cats')}<strong>{homeDetails.cats}</strong></span></button></div>
              <FosterInfo title={t('care.capacity')}>{t('care.capacityInfo')}</FosterInfo>
              {homeDetails.overdue > 0 && <p className="foster-alert">{homeDetails.overdue} {t('care.overdue')}</p>}
              <div className="foster-actions">{selectedHome.my_role === 'OWNER' && <button type="button" className="foster-secondary" onClick={() => setScreen({ type: 'homeForm', item: selectedHome })}>{t('care.editHome')}</button>}
                <button type="button" className="foster-secondary" onClick={() => setScreen({ type: 'team' })}><Users size={17} />{t('care.team')}</button></div>
              <FosterInfo title={`${t('care.completion')}: ${Math.round([selectedHome.name, selectedHome.city, selectedHome.bio, selectedHome.housing_type, selectedHome.experience, selectedHome.photos?.[0]].filter(Boolean).length / 6 * 100)}%`}>{t('care.completionInfo')}</FosterInfo>
            </div>
            {selectedHome.my_role === 'OWNER' && <button type="button" className="foster-primary" onClick={() => setScreen({ type: 'register' })}><Plus size={17} />{t('care.registerAnimal')}</button>}
            <div className="foster-search"><Search size={19} /><input aria-label={t('care.searchAnimal')} placeholder={t('care.searchAnimal')} value={registryFilters.query} onChange={event => setFilter('query', event.target.value)} /></div>
            <div className="foster-chips">{[['', 'all'], ['DOG', 'dogs'], ['CAT', 'cats']].map(([key, label]) => <button type="button" key={key} aria-pressed={registryFilters.species === key} onClick={() => setFilter('species', key)}>{t(`care.${label}`)}</button>)}</div>
            <details className="foster-card"><summary className="foster-check">{t('care.filters')}</summary><div className="foster-stack">
              <FosterSelect label={t('care.caseStatus')} value={registryFilters.status} onChange={value => setFilter('status', value)} empty={t('care.all')} options={['IN_CARE', 'RESERVED', 'COMPLETED', 'CANCELLED'].map(value => [value, t(`care.${value}`)])} />
              <FosterSelect label={t('care.space')} value={registryFilters.spaceId} onChange={value => setFilter('spaceId', value)} empty={t('care.all')} options={homeDetails.spaces.map(space => [space.id, space.name])} />
              <FosterSelect label={t('care.carer')} value={registryFilters.carerId} onChange={value => setFilter('carerId', value)} empty={t('care.all')} options={overview.team.filter(m => m.home_id === homeId && m.status === 'ACTIVE').map(m => [m.profile_id, m.display_name])} />
              <FosterSelect label={t('care.careState')} value={registryFilters.careState} onChange={value => setFilter('careState', value)} empty={t('care.all')} options={['NORMAL', 'ISOLATION', 'MEDICAL'].map(value => [value, t(`care.${value}`)])} />
              <button type="button" className="foster-secondary" onClick={() => { setRegistryFilters(emptyRegistryFilters); setRegistryPage(0); }}>{t('care.reset')}</button>
            </div></details>
            {pageState(registry)}
            {!registry.loading && registry.rows.map(animal => <button type="button" className="foster-animal-row" key={animal.id} onClick={() => setScreen({ type: 'placement', id: animal.id })}>
              <FosterPhoto src={animal.photo} name={animal.name} species={animal.species} /><div className="foster-animal-info"><strong>{animal.name}</strong>
                <span className="foster-id">{animal.animal_code}</span><div className="foster-animal-meta"><span className="foster-muted">{t(animal.species === 'DOG' ? 'care.dogs' : 'care.cats')}</span>
                  <FosterStatus value={animal.care_state !== 'NORMAL' ? animal.care_state : animal.status} /></div>
                {animal.discrepancy && <span className="foster-muted">{t('care.discrepancy')}</span>}</div><ChevronRight size={17} /></button>)}
            <FosterPager page={registryPage} count={registry.count} onChange={setRegistryPage} disabled={registry.loading} />
            <button type="button" className="foster-secondary" onClick={() => setScreen({ type: 'homeForm' })}>{t('care.addHome')}</button>
          </>}
        </>}

        {activeTab === 'foster-requests' && <>
          <div className="foster-tabs">{['incoming', 'outgoing'].map(value => <button type="button" key={value} aria-pressed={direction === value} onClick={() => { setDirection(value); setRequestPage(0); }}>{t(`care.${value}`)}</button>)}</div>
          <FosterInfo title={t('care.requests')}>{t('care.requestHint')}</FosterInfo>
          {pageState(requests)}
          {!requests.loading && requests.rows.map(item => <article className="foster-card" key={item.id}><div className="foster-row foster-between"><h2>{item.animal_name}</h2><FosterStatus value={item.status} /></div>
            <p className="foster-muted">{t(`care.${item.kind}`)} · {item.home_name}</p><p className="foster-muted">{item.sender_name} → {item.recipient_name}</p>
            <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontSize: 14 }}>{item.message}</p>
            <div className="foster-actions"><button type="button" className="foster-primary" onClick={() => requestOpenConversation(item.conversation_id, 'FOSTER')}>{t('care.openConversation')}</button>
              <button type="button" className="foster-secondary" onClick={() => setScreen({ type: 'history', item })}>{t('care.history')}</button></div>
            {item.status === 'PENDING' && <div className="foster-actions">{item.recipient_id === user.id ? <>
              <button type="button" className="foster-primary" onClick={() => requestAction(item, 'ACCEPT', 'care.accept')}>{t('care.accept')}</button>
              <button type="button" className="foster-secondary" onClick={() => requestAction(item, 'DECLINE', 'care.decline')}>{t('care.decline')}</button></>
              : <button type="button" className="foster-secondary" onClick={() => requestAction(item, 'WITHDRAW', 'care.withdraw')}>{t('care.withdraw')}</button>}</div>}
            {item.status === 'ACCEPTED' && !item.placement_id && <button type="button" className="foster-secondary" onClick={() => requestAction(item, 'ACCEPT', 'care.reconcile')}>{t('care.reconcile')}</button>}
            {item.status === 'ACCEPTED' && (!item.placement_id || item.placement_status === 'RESERVED') && <button type="button" className="foster-danger" onClick={() => requestAction(item, 'CANCEL', 'care.cancelReservation', true)}>{t('care.cancelReservation')}</button>}
            {item.placement_id && <button type="button" className="foster-secondary" onClick={() => setScreen({ type: 'placement', id: item.placement_id })}>{t('care.viewPlacement')}</button>}
          </article>)}
          <FosterPager page={requestPage} count={requests.count} onChange={setRequestPage} disabled={requests.loading} />
        </>}
      </>}
    </div>
    {screen?.type === 'homeForm' && <FosterHomeForm home={screen.item} onClose={close} onSaved={id => { setHomeId(id); saved(); setActiveTab('foster-home'); }} />}
    {screen?.type === 'caseForm' && <FosterCaseForm item={screen.item} transfer={screen.transfer} organizations={overview.organizations} onClose={close} onSaved={() => { saved(); setDirectoryType('myCases'); setActiveTab('foster'); }} />}
    {screen?.type === 'register' && <FosterRegisterForm homeId={homeId} onClose={close} onSaved={saved} />}
    {screen?.type === 'team' && selectedHome && <FosterTeam home={selectedHome} members={overview.team} spaces={homeDetails.spaces} onClose={close} onChanged={changed} />}
    {screen?.type === 'placement' && <FosterCare id={screen.id} homes={overview.homes} team={overview.team} spaces={overview.spaces || homeDetails.spaces}
      onClose={close} onChanged={changed} onTransfer={placement => setScreen({ type: 'caseForm', transfer: placement })} />}
    {screen?.type === 'request' && <FosterRequestForm item={screen.item} kind={screen.kind} homes={ownHomes} onClose={close}
      onSaved={() => { saved(); setDirection('outgoing'); setActiveTab('foster-requests'); }} />}
    {screen?.type === 'requestAction' && <FosterReasonForm title={t(screen.title)} submitLabel={screen.title} description={t('care.requestHint')} requireReason={screen.reason} onClose={close} onSaved={saved}
      onSave={(body, ack) => fosterRpc('respond_foster_request', { request_id_input: screen.item.id, action_input: screen.action,
        expected_updated_at_input: screen.item.updated_at, acknowledge_capacity_input: ack, reason_input: body })} />}
    {screen?.type === 'memberResponse' && <FosterReasonForm title={t(screen.action === 'ACCEPT' ? 'care.accept' : 'care.decline')} description={screen.member.home_name} requireReason={false}
      onClose={close} onSaved={saved} onSave={() => fosterRpc('manage_foster_member', { home_id_input: screen.member.home_id, profile_id_input: user.id, action_input: screen.action })} />}
    {screen?.type === 'report' && <FosterReportForm profileId={screen.profileId} listingId={screen.listingId} onClose={close} onSaved={() => setNotice(t('care.reportSent'))} />}
    {screen?.type === 'history' && <RequestHistory item={screen.item} onClose={close} />}
    {screen?.type === 'caseDetail' && <FosterScreen title={screen.item.name} onClose={close}><div className="foster-detail-body">
      <FosterPhoto src={screen.item.photo} name={screen.item.name} species={screen.item.species} large />
      <div className="foster-card"><h2>{screen.item.name}</h2><p className="foster-muted">{screen.item.city} · {screen.item.responsible_name}</p>
        <p style={{ whiteSpace: 'pre-wrap' }}>{screen.item.description}</p><p className="foster-muted">{t('care.duration')}: {t(`care.${screen.item.duration || 'UNKNOWN'}`)}</p>
        {[['food_covered', 'food'], ['vet_covered', 'vet'], ['transport_available', 'transport']].filter(([key]) => screen.item[key]).map(([key, label]) => <p key={key}>{t(`care.${label}`)}</p>)}
        <p className="foster-muted">{screen.item.medical_needs}</p><p className="foster-muted">{screen.item.home_fit}</p>
        <FosterInfo title={t('care.facts')}>{t('care.boundary')}</FosterInfo>
        <div className="foster-actions">{screen.item.responsible_id === user.id ? <button type="button" className="foster-primary" onClick={() => setScreen({ type: 'caseForm', item: screen.item })}>{t('care.editCase')}</button>
          : <><button type="button" className="foster-primary" onClick={() => openApply(screen.item)}>{t('care.apply')}</button>
            <button type="button" className="foster-secondary" onClick={() => setScreen({ type: 'report', profileId: screen.item.responsible_id, listingId: screen.item.id })}>{t('care.report')}</button></>}</div>
      </div></div></FosterScreen>}
    {screen?.type === 'homeDetail' && <FosterScreen title={screen.item.name} onClose={close}><div className="foster-detail-body">
      <FosterPhoto src={screen.item.photos?.[0]} name={screen.item.name} large />
      <div className="foster-card"><h2>{screen.item.name}</h2><p className="foster-muted">{screen.item.city} · {screen.item.area}</p><FosterStatus value={screen.item.availability} />
        <p>{screen.item.bio}</p><p className="foster-muted">{screen.item.experience}</p><p className="foster-muted">{screen.item.capacity} {t('care.declared')} · {screen.item.occupied} {t('care.occupied')}</p>
        <p className="foster-muted">{screen.item.completed_placements} {t('care.COMPLETED')} · {screen.item.review_count} {t('care.reviews')}{screen.item.rating ? ` · ${screen.item.rating}/5` : ''}</p>
        <FosterInfo title={t('care.facts')}>{t('care.boundary')}</FosterInfo>
        {screen.item.profile_id !== user.id && <div className="foster-actions"><button type="button" className="foster-primary" onClick={() => setScreen({ type: 'request', kind: 'INVITE', item: screen.item })}>{t('care.invite')}</button>
          <button type="button" className="foster-secondary" onClick={() => setScreen({ type: 'report', profileId: screen.item.profile_id })}>{t('care.report')}</button></div>}
      </div></div></FosterScreen>}
  </div>;
}

function RequestHistory({ item, onClose }) {
  const { t, lang } = useApp();
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  useEffect(() => { let cancelled = false; loadRequestHistory(item.id).then(data => { if (!cancelled) setRows(data); })
    .catch(failure => { if (!cancelled) setError(failure.message); }); return () => { cancelled = true; }; }, [item.id]);
  return <FosterScreen title={t('care.history')} onClose={onClose}><div className="foster-detail-body"><h3>{item.animal_name}</h3>
    {error && <p role="alert" className="foster-alert">{error}</p>}<div className="foster-timeline">{rows.map(row => <article key={row.id}>
      <strong>{row.actor_name}</strong><div className="foster-muted">{new Date(row.created_at).toLocaleString(lang === 'ro' ? 'ro-RO' : 'en-GB')}</div><p>{row.body}</p>
    </article>)}</div></div></FosterScreen>;
}
