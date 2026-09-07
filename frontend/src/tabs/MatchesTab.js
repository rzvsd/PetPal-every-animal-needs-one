import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Heart, MessageCircle, X, Bookmark, BookmarkCheck, Info, ShieldCheck, MapPin, CheckCircle2, XCircle, Filter, Play, Users, Dog, Cat } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { DOG_BREEDS, CAT_BREEDS } from '../data/breeds';
import { Badge, Chip, PrimaryButton, SecondaryButton, ScreenHeader, EmptyState, PrivacyNote, FilterSheet, Modal } from '../components/SharedComponents';
import { loadMatchCandidates, findSocialWalkConversation, requestSocialWalk } from '../services/supabaseApi';
import { useBackHandler } from '../navigation/backNavigation';

export const emptyMatchFilters = { species: '', verifiedOnly: false, breed: '', sex: '', size: '', area: '' };

export function matchesPreferences(candidate, mode, filters) {
  const a = candidate.animal;
  return a.activeMatchModes?.includes(mode)
    && (mode !== 'VERIFIED_MATE' || (a.healthDocumentStatus === 'VERIFIED' && a.adminMateApprovalStatus === 'VERIFIED'))
    && (!filters.species || a.species === filters.species)
    && (!filters.verifiedOnly || candidate.ownerVerificationStatus === 'VERIFIED')
    && (!filters.breed || a.breed === filters.breed)
    && (!filters.sex || a.sex === filters.sex)
    && (!filters.size || a.sizeLabel === filters.size)
    && (!filters.area || a.city === filters.area || a.coarseArea === filters.area);
}

function ageLabel(months, t) {
  if (months == null) return t('common.unknown');
  const years = Math.floor(months / 12);
  return years ? `${years} ${t(years === 1 ? 'common.year' : 'common.years')}` : `${months} ${t(months === 1 ? 'common.month' : 'common.months')}`;
}

function AnimalFacts({ candidate, t, detailed = false, onVerification }) {
  const { animal, ownerVerificationStatus } = candidate;
  return <>
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0"><h2 className="font-heading text-2xl font-bold break-words">{animal.name}</h2>
        <p className="text-sm text-[#57645C]">{animal.breed} · {ageLabel(animal.ageMonths, t)}</p></div>
      {ownerVerificationStatus === 'VERIFIED' && <button type="button" onClick={onVerification} aria-label={t('readiness.verificationInfo')} className="verification-info">
        <ShieldCheck size={15} /><span>{t('readiness.ownerVerified')}</span><Info size={14} />
      </button>}
    </div>
    <p className="flex gap-1.5 items-center text-sm text-[#57645C]"><MapPin size={15} className="shrink-0" />
      {[animal.city, animal.coarseArea].filter(Boolean).join(' · ') || t('common.unknown')}</p>
    <div className="flex flex-wrap gap-1.5">{animal.temperamentTags?.slice(0, detailed ? undefined : 3).map(tag => <Badge key={tag} variant="sage">{tag}</Badge>)}</div>
    {detailed && <>
      <p className="text-sm">{animal.sex === 'MALE' ? t('common.male') : animal.sex === 'FEMALE' ? t('common.female') : t('common.unknown')}</p>
      <div className="space-y-2 border-t pt-3">
        <h3 className="font-semibold">{t('matches.health')}</h3>
        {animal.vaccineStatus === 'UP_TO_DATE' && <p className="text-sm">{t('readiness.vaccineReported')}</p>}
        <p className="text-sm">{t(animal.healthDocumentStatus === 'VERIFIED' ? 'readiness.documentsVerified' : 'readiness.healthUnverified')}</p>
        <p className="text-xs text-[#57645C]">{t('readiness.verificationInfo')}</p>
      </div><PrivacyNote text={t('matches.locationPrivate')} />
    </>}
  </>;
}

function MatchActions({ onLike, onPass, onSave, isSaved, busy, error, social, t }) {
  return <div className="match-actions">
    {error && <p role="alert" className="text-sm text-[#9B4650] w-full">{error}</p>}
    <div className="flex gap-2">
      <button type="button" data-testid="match-pass-btn" onClick={onPass} disabled={busy} className="match-action-secondary"><X size={18} />{t('matches.notNow')}</button>
      <button type="button" data-testid="match-like-btn" onClick={onLike} disabled={busy} className="match-action-primary">{social ? <MessageCircle size={18} className="shrink-0" /> : <Heart size={18} />}<span>{t(busy ? 'auth.working' : social ? 'readiness.proposeWalk' : 'matches.like')}</span></button>
      <button type="button" data-testid="match-save-btn" onClick={onSave} disabled={busy} aria-pressed={isSaved}
        aria-label={t(isSaved ? 'readiness.unsave' : 'readiness.savedLabel')} className="match-action-save">
        {isSaved ? <BookmarkCheck size={21} /> : <Bookmark size={21} />}
      </button>
    </div>
  </div>;
}

export default function MatchesTab() {
  const { t, myAnimals, selectedAnimal, selectedAnimalId, matchMode, setMatchMode, candidates, dataSource,
    savedAnimals, skippedMatches, handleLike, handlePass, handleSave, matchSuccess, setMatchSuccess,
    setActiveTab, navigate, requestOpenConversation, messaging } = useApp();
  const [view, setView] = useState('browse');
  const [filters, setFilters] = useState(emptyMatchFilters);
  const [draft, setDraft] = useState(emptyMatchFilters);
  const [showFilters, setShowFilters] = useState(false);
  const [detail, setDetail] = useState(null);
  const [verification, setVerification] = useState(false);
  const [page, setPage] = useState({ rows: [], hasMore: false, cursor: null, loading: false, error: '' });
  const [actionError, setActionError] = useState('');
  const [busy, setBusy] = useState(false);
  const [walkTarget, setWalkTarget] = useState(null);
  const [walkBody, setWalkBody] = useState('');
  const actionLock = useRef(false);
  const pageRef = useRef(page); pageRef.current = page;
  const requestVersion = useRef(0);
  const loadPage = useCallback(async (reset = false) => {
    if (!selectedAnimalId || dataSource !== 'supabase') return;
    if (!reset && pageRef.current.loading) return;
    const version = ++requestVersion.current;
    const previous = pageRef.current;
    const next = { ...(reset ? { rows: [], cursor: null, hasMore: false } : previous), loading: true, error: '' };
    pageRef.current = next; setPage(next);
    try {
      const rows = await loadMatchCandidates({ animalId: selectedAnimalId, mode: matchMode, filters, savedOnly: view === 'saved', afterId: reset ? null : previous.cursor });
      if (requestVersion.current !== version) return;
      const result = { rows: reset ? rows : [...previous.rows, ...rows], cursor: rows[rows.length - 1]?.animal.id || previous.cursor, hasMore: rows.length === 20, loading: false, error: '' };
      pageRef.current = result; setPage(result);
    } catch {
      if (requestVersion.current === version) setPage(current => ({ ...current, loading: false, error: t('readiness.loadError') }));
    }
  }, [selectedAnimalId, matchMode, filters, view, dataSource, t]);
  useEffect(() => {
    setDetail(null); setWalkTarget(null); setActionError('');
    loadPage(true);
    return () => { requestVersion.current += 1; };
  }, [loadPage]);
  const skipped = skippedMatches[`${selectedAnimalId}:${matchMode}`] || [];
  const rows = dataSource === 'supabase' ? page.rows : candidates.filter(c => matchesPreferences(c, matchMode, filters));
  const candidate = rows.find(c => !skipped.includes(c.animal.id) && (view !== 'saved' || savedAnimals.includes(c.animal.id)));
  const current = candidate ? { ...candidate, mode: matchMode } : null;
  const hasCandidate = Boolean(current);
  useEffect(() => {
    if (!hasCandidate && page.hasMore && !page.loading && !page.error) loadPage();
  }, [hasCandidate, page.hasMore, page.loading, page.error, loadPage]);
  useBackHandler(Boolean(detail), () => setDetail(null));
  const modes = [['PLAY', 'matches.play', Play], ['SOCIAL', 'matches.social', Users], ['VERIFIED_MATE', 'matches.verifiedMate', ShieldCheck]];
  const checks = [
    ['readiness.modeEnabled', selectedAnimal?.activeMatchModes?.includes(matchMode), 'animals'],
    ...(matchMode === 'VERIFIED_MATE' ? [
      ['readiness.documentsVerified', selectedAnimal?.healthDocumentStatus === 'VERIFIED', 'verification'],
      ['matches.adminApproval', selectedAnimal?.adminMateApprovalStatus === 'VERIFIED', 'verification'],
    ] : []),
  ];
  const eligible = checks.every(([, ok]) => ok);
  const openProfile = section => { navigate(section === 'verification' ? 'verification' : 'editAnimal', { animalId: selectedAnimalId }); setActiveTab('profile'); };
  const act = async (type, item) => {
    if (!item || actionLock.current) return;
    actionLock.current = true; setBusy(true); setActionError('');
    try {
      if (type === 'like' && matchMode === 'SOCIAL') {
        if (dataSource !== 'supabase') { setActionError(t('readiness.walkLiveOnly')); return; }
        const existingId = await findSocialWalkConversation(item.animal.ownerId);
        setDetail(null);
        if (existingId) requestOpenConversation(existingId);
        else { setWalkTarget(item); setWalkBody(messaging.drafts[`walk:${selectedAnimalId}:${item.animal.id}`] || ''); }
      }
      else if (type === 'like') { await handleLike(item); setDetail(null); }
      else if (type === 'save') await handleSave(item);
      else { handlePass(item); setDetail(null); }
    } catch { setActionError(t(type === 'save' ? 'readiness.saveError' : matchMode === 'SOCIAL' ? 'readiness.walkError' : 'readiness.likeError')); }
    finally { actionLock.current = false; setBusy(false); }
  };
  const sendWalkRequest = async () => {
    if (actionLock.current || !walkTarget || !walkBody.trim() || [...walkBody].length > 4000) return;
    actionLock.current = true; setBusy(true); setActionError('');
    try {
      if (!messaging.saveDraft(`walk:${selectedAnimalId}:${walkTarget.animal.id}`, walkBody)) {
        setActionError(t('readiness.storageFailed')); return;
      }
      const id = await requestSocialWalk(selectedAnimalId, walkTarget.animal.id, walkBody);
      messaging.saveDraft(`walk:${selectedAnimalId}:${walkTarget.animal.id}`, '');
      setWalkTarget(null); requestOpenConversation(id);
    } catch { setActionError(t('readiness.walkError')); }
    finally { actionLock.current = false; setBusy(false); }
  };
  const actions = item => <MatchActions onLike={() => act('like', item)} onPass={() => act('pass', item)} onSave={() => act('save', item)}
    isSaved={savedAnimals.includes(item.animal.id)} busy={busy} error={actionError} social={matchMode === 'SOCIAL'} t={t} />;
  const toggleDraft = (name, value) => setDraft(d => ({ ...d, [name]: d[name] === value ? emptyMatchFilters[name] : value }));
  const clear = () => { setFilters({ ...emptyMatchFilters }); setDraft({ ...emptyMatchFilters }); };
  const breeds = draft.species === 'CAT' ? CAT_BREEDS : draft.species === 'DOG' ? DOG_BREEDS : [...new Set([...DOG_BREEDS, ...CAT_BREEDS])].sort();

  return <div data-testid="matches-tab" className="match-discovery min-h-0 flex-1 overflow-y-auto">
    {!myAnimals.length ? <EmptyState icon={Dog} title={t('matches.noAnimalTitle')} description={t('matches.noAnimalDesc')}
      action={t('matches.createProfile')} onAction={() => { navigate('createAnimal'); setActiveTab('profile'); }} /> : <>
      <div className="match-controls">
        <div className="match-modes">{modes.map(([value, label, Icon]) => <button type="button" key={value} aria-pressed={matchMode === value}
          data-testid={`mode-${value.toLowerCase()}`} onClick={() => setMatchMode(value)}><Icon size={16} /><span>{t(label)}</span></button>)}</div>
        <div className="flex items-center justify-between gap-2 pt-2">
          <div className="flex gap-1" aria-label={t('readiness.discover')}>{['browse', 'saved'].map(value => <button type="button" key={value}
            aria-pressed={view === value} data-testid={`discover-${value}`} onClick={() => setView(value)} className={`min-h-11 px-3 rounded-full text-sm ${view === value ? 'bg-[#E3ECE4] font-semibold' : 'text-[#57645C]'}`}>{t(`readiness.${value}`)}</button>)}</div>
          <button type="button" data-testid="matches-more-filters" className="filter-trigger" onClick={() => { setDraft({ ...filters }); setShowFilters(true); }}>
            <Filter size={16} />{t('readiness.filters')}{Object.values(filters).filter(Boolean).length > 0 && ` (${Object.values(filters).filter(Boolean).length})`}</button>
        </div>
      </div>
      {!eligible ? <div data-testid="verified-mate-locked" className="m-4 p-5 rounded-2xl bg-white border space-y-4">
        <h2 className="text-lg font-semibold">{t(matchMode === 'VERIFIED_MATE' ? 'matches.verifiedMate' : 'readiness.modeDisabled')}</h2>
        {matchMode === 'VERIFIED_MATE' && <p className="text-sm">{t('readiness.verificationRequired')}</p>}
        {checks.map(([label, ok, section]) => <div key={label} className="flex items-center gap-2 text-sm">
          {ok ? <CheckCircle2 size={18} /> : <XCircle size={18} />}<span>{t(label)} · {t(ok ? 'readiness.ready' : 'readiness.missing')}</span>
          {!ok && <button type="button" className="ml-auto underline min-h-11" onClick={() => openProfile(section)}>{t('readiness.reviewChecks')}</button>}
        </div>)}
      </div> : page.loading && !current ? <p role="status" className="p-8 text-center">{t('readiness.loading')}</p>
        : page.error ? <div role="alert" className="p-5 space-y-3"><p>{page.error}</p><SecondaryButton onClick={() => loadPage(true)}>{t('readiness.retry')}</SecondaryButton></div>
        : current ? <article data-testid="match-card" className="match-card">
          <img src={current.animal.photoUrls?.[0]} alt={current.animal.name} className="match-photo" />
          <div className="match-card-info"><AnimalFacts candidate={current} t={t} onVerification={() => setVerification(true)} />
            <button type="button" data-testid="match-details-btn" onClick={() => setDetail(current)} className="about-animal">{t('readiness.about')} {current.animal.name} <span aria-hidden="true">›</span></button>
            {actions(current)}
          </div>
        </article> : <EmptyState icon={view === 'saved' ? Bookmark : Heart} title={t(view === 'saved' ? 'readiness.noSaved' : 'readiness.noCandidates')}
          description={t(view === 'saved' ? 'readiness.noSavedHint' : 'readiness.noCandidatesHint')} action={t('readiness.clearFilters')} onAction={clear} />}
      <p className="match-mutual-hint">{t(matchMode === 'SOCIAL' ? 'readiness.walkHint' : 'readiness.mutualHint')}</p>
    </>}
    <FilterSheet open={Boolean(walkTarget)} onClose={() => { if (!busy) setWalkTarget(null); }} title={t('readiness.proposeWalk')}
      footer={<PrimaryButton onClick={sendWalkRequest} disabled={busy || !walkBody.trim() || [...walkBody].length > 4000}>{t(busy ? 'auth.working' : 'readiness.sendWalkRequest')}</PrimaryButton>}>
      <p className="font-semibold">{selectedAnimal?.name} + {walkTarget?.animal.name}</p>
      <p className="text-sm">{t('readiness.walkHint')}</p>
      <label className="block space-y-2"><span>{t('readiness.walkFirstMessage')}</span>
        <textarea data-testid="walk-request-input" rows={3} value={walkBody} disabled={busy}
          className="w-full rounded-xl border p-3 text-base" onChange={event => {
            setWalkBody(event.target.value);
            if (!messaging.saveDraft(`walk:${selectedAnimalId}:${walkTarget.animal.id}`, event.target.value)) setActionError(t('readiness.storageFailed'));
          }} /></label>
      <p className="text-xs">{[...walkBody].length}/4000 {t('readiness.characterCount')}</p>
      {actionError && <p role="alert" className="text-sm text-[#9B4650]">{actionError}</p>}
    </FilterSheet>
    {detail && <section data-testid="match-detail-screen" className="petpal-fullscreen">
      <ScreenHeader title={`${t('readiness.about')} ${detail.animal.name}`} onBack={() => setDetail(null)} />
      <div className="min-h-0 flex-1 overflow-y-auto"><img src={detail.animal.photoUrls?.[0]} alt={detail.animal.name} className="w-full h-64 object-cover" />
        <div className="p-5 space-y-3"><AnimalFacts candidate={detail} detailed t={t} onVerification={() => setVerification(true)} /></div>
      </div><footer className="shrink-0 p-4 border-t bg-white">{actions(detail)}</footer>
    </section>}
    <Modal open={verification} onClose={() => setVerification(false)}><div className="p-5 space-y-4">
      <h2 className="font-semibold">{t('profile.verification')}</h2><p>{t('readiness.verificationInfo')}</p>
      <PrimaryButton onClick={() => setVerification(false)}>{t('common.close')}</PrimaryButton></div></Modal>
    <Modal open={Boolean(matchSuccess)} onClose={() => setMatchSuccess(null)}><div className="p-6 text-center space-y-4">
      <Heart className="mx-auto text-[#2C402B]" size={40} /><h2 className="text-2xl font-heading font-bold">{t('matches.matchSuccess')}</h2>
      <p>{matchSuccess?.myAnimal?.name} + {matchSuccess?.theirAnimal?.name}</p><p>{t('matches.matchSuccessDesc')}</p>
      <PrimaryButton onClick={() => { const id = matchSuccess.conversationId; setMatchSuccess(null); requestOpenConversation(id); }}>{t('matches.openMessages')}</PrimaryButton>
      <SecondaryButton onClick={() => setMatchSuccess(null)}>{t('matches.continueBrowsing')}</SecondaryButton>
    </div></Modal>
    <FilterSheet open={showFilters} onClose={() => setShowFilters(false)} title={t('readiness.filters')} footer={<>
      <SecondaryButton onClick={() => { clear(); setShowFilters(false); }}>{t('readiness.reset')}</SecondaryButton>
      <PrimaryButton onClick={() => { setFilters({ ...draft }); setShowFilters(false); }}>{t('matches.applyFilters')}</PrimaryButton></>}>
      <fieldset><legend className="mb-2 font-semibold">{t('matches.showMe')}</legend><div className="flex flex-wrap gap-2">
        <Chip label={t('matches.dogs')} icon={Dog} active={draft.species === 'DOG'} onClick={() => { toggleDraft('species', 'DOG'); setDraft(d => ({ ...d, breed: '' })); }} />
        <Chip label={t('matches.cats')} icon={Cat} active={draft.species === 'CAT'} onClick={() => { toggleDraft('species', 'CAT'); setDraft(d => ({ ...d, breed: '' })); }} /></div></fieldset>
      <Chip label={t('matches.verifiedOwnersOnly')} active={draft.verifiedOnly} icon={ShieldCheck} onClick={() => toggleDraft('verifiedOnly', true)} />
      <label className="block space-y-2"><span className="font-semibold">{t('matches.breed')}</span><select value={draft.breed} onChange={event => setDraft(d => ({ ...d, breed: event.target.value }))} className="w-full border rounded-xl p-3">
        <option value="">{t('matches.anyBreed')}</option>{breeds.map(breed => <option key={breed}>{breed}</option>)}</select></label>
      <fieldset><legend className="mb-2 font-semibold">{t('matches.sex')}</legend><div className="flex flex-wrap gap-2">
        {[['MALE', 'common.male'], ['FEMALE', 'common.female']].map(([value, label]) => <Chip key={value} label={t(label)} active={draft.sex === value} onClick={() => toggleDraft('sex', value)} />)}</div></fieldset>
      <fieldset><legend className="mb-2 font-semibold">{t('matches.size')}</legend><div className="flex flex-wrap gap-2">
        {['SMALL', 'MEDIUM', 'LARGE'].map(value => <Chip key={value} label={t(`common.${value.toLowerCase()}`)} active={draft.size === value} onClick={() => toggleDraft('size', value)} />)}</div></fieldset>
      <label className="block space-y-2"><span className="font-semibold">{t('matches.area')}</span><input value={draft.area} onChange={event => setDraft(d => ({ ...d, area: event.target.value }))} className="w-full border rounded-xl p-3" /></label>
    </FilterSheet>
  </div>;
}
