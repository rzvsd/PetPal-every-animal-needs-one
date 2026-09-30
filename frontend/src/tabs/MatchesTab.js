import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Heart, MessageCircle, X, Bookmark, BookmarkCheck, MapPin, CheckCircle2, XCircle, Filter, Play, Users, Dog, Cat, PawPrint, MoreHorizontal } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { DOG_BREEDS, CAT_BREEDS } from '../data/breeds';
import { Badge, Chip, PrimaryButton, SecondaryButton, ScreenHeader, EmptyState, PrivacyNote, FilterSheet, Modal, SafetyMenu } from '../components/SharedComponents';
import { friendlyError } from '../services/errors';
import { motionSpring, useReducedPetMotion } from '../components/Motion';
import { useDiscardGuard } from '../components/FormGuard';
import { loadMatchCandidates, findSocialWalkConversation, requestSocialWalk } from '../services/supabaseApi';
import { useBackHandler } from '../navigation/backNavigation';

export const emptyMatchFilters = { species: '', breed: '', sex: '', size: '', area: '' };

export function matchesPreferences(candidate, mode, filters) {
  const a = candidate.animal;
  return a.activeMatchModes?.includes(mode)
    && ['PLAY', 'SOCIAL'].includes(mode)
    && (!filters.species || a.species === filters.species)
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

function AnimalFacts({ candidate, t, detailed = false, onSafety }) {
  const { animal } = candidate;
  return <>
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0"><h2 className="font-heading text-2xl font-bold break-words">{animal.name}</h2>
        <p className="text-sm text-[#57645C]">{animal.breed === 'Unknown' ? t('common.unknown') : animal.breed} · {ageLabel(animal.ageMonths, t)}</p></div>
      {onSafety && <button type="button" data-testid="match-safety-btn" onClick={onSafety} aria-label={t('readiness.safetyOptions')}
        title={t('readiness.safetyOptions')} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[#57645C] hover:bg-[#F0EDE8]">
        <MoreHorizontal size={20} aria-hidden="true" /></button>}
    </div>
    <p className="flex gap-1.5 items-center text-sm text-[#57645C]"><MapPin size={15} className="shrink-0" />
      {[animal.city, animal.coarseArea].filter(Boolean).join(' · ') || t('common.unknown')}</p>
    <div className="flex flex-wrap gap-1.5">{animal.temperamentTags?.slice(0, detailed ? undefined : 3).map(tag => <Badge key={tag} variant="sage">{tag}</Badge>)}</div>
    {detailed && <>
      <p className="text-sm">{animal.sex === 'MALE' ? t('common.male') : animal.sex === 'FEMALE' ? t('common.female') : t('common.unknown')}</p>
      <div className="space-y-2 border-t pt-3">
        <h3 className="font-semibold">{t('matches.health')}</h3>
        {animal.vaccineStatus === 'UP_TO_DATE' && <p className="text-sm">{t('readiness.vaccineReported')}</p>}
        <p className="text-sm">{t('care.facts')}</p>
        <p className="text-xs text-[#57645C]">{t('care.boundary')}</p>
      </div><PrivacyNote text={t('matches.locationPrivate')} />
    </>}
  </>;
}

function SpeciesSelector({ value, onChange, t, reducedMotion }) {
  const options = [['', t('readiness.allAnimals'), PawPrint], ['DOG', t('matches.dogs'), Dog], ['CAT', t('matches.cats'), Cat]];

  return <div role="group" aria-label={t('matches.showMe')} className="relative flex gap-1 rounded-2xl border border-[#E4E2DC] bg-[var(--pp-bg)] p-1">
    {options.map(([option, label, Icon]) => {
      const active = value === option;
      return <button key={option || 'all'} type="button" aria-pressed={active} onClick={() => onChange(option)}
        className="relative min-h-11 flex-1 overflow-hidden rounded-xl px-2 py-2 text-sm font-medium">
        {active && <motion.span layoutId={reducedMotion ? undefined : 'match-species-selection'} transition={reducedMotion ? { duration: 0 } : motionSpring}
          className="absolute inset-0 rounded-xl bg-[#2C402B]" />}
        <span className={`relative z-10 flex items-center justify-center gap-1.5 ${active ? 'text-white' : 'text-[#57645C]'}`}>
          <motion.span animate={{ scale: active && !reducedMotion ? [1, 1.05, 1] : 1 }} transition={{ duration: 0.2 }}><Icon size={15} aria-hidden="true" /></motion.span>{label}
        </span>
      </button>;
    })}
  </div>;
}

function MatchCelebration({ matchSuccess, t, reducedMotion, animate, onOpenMessages, onClose }) {
  const [showHearts, setShowHearts] = useState(animate && !reducedMotion);
  useEffect(() => {
    const timer = setTimeout(() => setShowHearts(false), 650);
    return () => clearTimeout(timer);
  }, []);
  const myAnimal = matchSuccess?.myAnimal;
  const theirAnimal = matchSuccess?.theirAnimal;
  const iconTransition = reducedMotion || !animate ? { duration: 0 } : { ...motionSpring, duration: 0.34 };
  const detailsTransition = reducedMotion || !animate ? { duration: 0 } : { duration: 0.3, delay: 0.22, ease: 'easeOut' };
  const avatar = animal => animal?.photoUrls?.[0]
    ? <img src={animal.photoUrls[0]} alt="" className="h-16 w-16 rounded-2xl object-cover" />
    : <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#E3ECE4] text-[#2C402B]" aria-hidden="true">
      {animal?.species === 'CAT' ? <Cat size={25} /> : <Dog size={25} />}
    </div>;

  return <div className="p-6 text-center">
    {showHearts && <div className="relative mx-auto flex h-20 max-w-[180px] items-center justify-center" aria-hidden="true">
      <motion.div initial={animate && !reducedMotion ? { opacity: 0, x: -28, rotate: -12 } : false}
        animate={{ opacity: 1, x: 0, rotate: 0 }} transition={iconTransition} className="absolute left-8 text-[#9B4650]">
        <Heart size={34} fill="currentColor" />
      </motion.div>
      <motion.div initial={animate && !reducedMotion ? { opacity: 0, x: 28, rotate: 12 } : false}
        animate={{ opacity: 1, x: 0, rotate: 0 }} transition={iconTransition} className="absolute right-8 text-[#8B4C2F]">
        <Heart size={34} fill="currentColor" />
      </motion.div>
    </div>}
    <motion.div initial={animate && !reducedMotion ? { opacity: 0, y: 8, scale: 0.96 } : false}
      animate={{ opacity: 1, y: 0, scale: 1 }} transition={detailsTransition} className="flex items-center justify-center gap-3">
      <div className="flex flex-col items-center gap-1">{avatar(myAnimal)}<span className="max-w-28 text-sm font-semibold">{myAnimal?.name}</span></div>
      <span className="text-xl font-heading font-bold text-[#9B4650]" aria-hidden="true">+</span>
      <div className="flex flex-col items-center gap-1">{avatar(theirAnimal)}<span className="max-w-28 text-sm font-semibold">{theirAnimal?.name}</span></div>
    </motion.div>
    <h2 className="mt-4 text-2xl font-heading font-bold">{t('matches.matchSuccess')}</h2>
    <p className="mt-1 text-sm text-[#57645C]">{t('matches.matchSuccessDesc')}</p>
    <div className="mt-5 space-y-2">
      <PrimaryButton onClick={() => { const id = matchSuccess.conversationId; onClose(); onOpenMessages(id); }}>{t('matches.openMessages')}</PrimaryButton>
      <SecondaryButton onClick={onClose}>{t('matches.continueBrowsing')}</SecondaryButton>
    </div>
  </div>;
}

function MatchActions({ onLike, onPass, onSave, isSaved, busy, error, social, t }) {
  const reduced = useReducedPetMotion();
  const previousSaved = useRef(isSaved);
  const [savePulse, setSavePulse] = useState(false);
  useEffect(() => {
    if (previousSaved.current === isSaved) return undefined;
    previousSaved.current = isSaved;
    setSavePulse(true);
    const timer = setTimeout(() => setSavePulse(false), 150);
    return () => clearTimeout(timer);
  }, [isSaved]);
  const press = reduced ? undefined : { scale: 0.98 };
  return <div className="match-actions">
    {error && <p role="alert" className="text-sm text-[#9B4650] w-full">{error}</p>}
    <div className="flex gap-2">
      <motion.button whileTap={press} type="button" data-testid="match-pass-btn" onClick={onPass} disabled={busy} className="match-action-secondary"><X size={18} />{t('matches.notNow')}</motion.button>
      <motion.button whileTap={press} type="button" data-testid="match-like-btn" onClick={onLike} disabled={busy} className="match-action-primary">{social ? <MessageCircle size={18} className="shrink-0" /> : <Heart size={18} />}<span>{t(busy ? 'auth.working' : social ? 'readiness.proposeWalk' : 'matches.like')}</span></motion.button>
      <motion.button whileTap={press} type="button" data-testid="match-save-btn" onClick={onSave} disabled={busy} aria-pressed={isSaved}
        aria-label={t(isSaved ? 'readiness.unsave' : 'readiness.savedLabel')} className="match-action-save">
        <motion.span animate={{ scale: savePulse && !reduced ? 1.12 : 1 }} transition={{ duration: 0.15 }}>
          {isSaved ? <BookmarkCheck size={21} fill="#E3ECE4" /> : <Bookmark size={21} />}
        </motion.span>
      </motion.button>
    </div>
  </div>;
}

export default function MatchesTab() {
  const { t, myAnimals, selectedAnimal, selectedAnimalId, matchMode, setMatchMode, candidates, dataSource,
    savedAnimals, skippedMatches, handleLike, handlePass, handleSave, reportMatchProfile, blockMatchProfile, matchSuccess, setMatchSuccess,
    setActiveTab, navigate, requestOpenConversation, messaging } = useApp();
  const reducedMotion = useReducedPetMotion();
  const [view, setView] = useState('browse');
  const [filters, setFilters] = useState(emptyMatchFilters);
  const [draft, setDraft] = useState(emptyMatchFilters);
  const [showFilters, setShowFilters] = useState(false);
  const [detail, setDetail] = useState(null);
  const [page, setPage] = useState({ rows: [], hasMore: false, cursor: null, loading: false, error: '' });
  const [actionError, setActionError] = useState('');
  const [busy, setBusy] = useState(false);
  const [cardAction, setCardAction] = useState('advance');
  const [walkTarget, setWalkTarget] = useState(null);
  const [walkBody, setWalkBody] = useState('');
  const [safetyTarget, setSafetyTarget] = useState(null);
  const [notice, setNotice] = useState('');
  const actionLock = useRef(false);
  const celebratedMatchRef = useRef(null);
  const closeWalk = useCallback(() => {
    setWalkTarget(null); setWalkBody(''); setActionError('');
  }, []);
  const { requestClose: requestWalkClose, discardDialog: walkDiscardDialog } = useDiscardGuard({
    dirty: Boolean(walkTarget && walkBody.trim()), busy, onClose: closeWalk,
  });
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
      // Social walks are for dogs only.
      const modeFilters = matchMode === 'SOCIAL' ? { ...filters, species: 'DOG' } : filters;
      const rows = await loadMatchCandidates({ animalId: selectedAnimalId, mode: matchMode, filters: modeFilters, savedOnly: view === 'saved', afterId: reset ? null : previous.cursor });
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
  const matchKey = matchSuccess && [matchSuccess.conversationId, matchSuccess.myAnimal?.id, matchSuccess.theirAnimal?.id].join(':');
  const animateMatch = Boolean(matchKey && celebratedMatchRef.current !== matchKey);
  useEffect(() => {
    if (!hasCandidate && page.hasMore && !page.loading && !page.error) loadPage();
  }, [hasCandidate, page.hasMore, page.loading, page.error, loadPage]);
  useEffect(() => {
    if (matchKey) celebratedMatchRef.current = matchKey;
  }, [matchKey]);
  useBackHandler(Boolean(detail), () => setDetail(null));
  const isCat = selectedAnimal?.species === 'CAT';
  useEffect(() => {
    if (matchMode === 'VERIFIED_MATE' || (matchMode === 'SOCIAL' && isCat)) setMatchMode('PLAY');
  }, [matchMode, setMatchMode, isCat]);
  const modes = [['PLAY', 'matches.play', Play], ...(isCat ? [] : [['SOCIAL', 'matches.social', Users]])];
  const checks = [
    ['readiness.modeEnabled', selectedAnimal?.activeMatchModes?.includes(matchMode), 'animals'],
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
      else if (type === 'like') { setCardAction('advance'); await handleLike(item); setDetail(null); }
      else if (type === 'save') await handleSave(item);
      else { setCardAction('pass'); await handlePass(item); setDetail(null); }
    } catch (error) {
      setActionError(type === 'pass' ? friendlyError(error, t)
        : t(type === 'save' ? 'readiness.saveError' : matchMode === 'SOCIAL' ? 'readiness.walkError' : 'readiness.likeError'));
    }
    finally { actionLock.current = false; setBusy(false); }
  };
  const safetyAction = async action => {
    const item = safetyTarget;
    setSafetyTarget(null);
    setActionError(''); setNotice('');
    try {
      if (action === 'block') await blockMatchProfile(item);
      else await reportMatchProfile(item);
      setDetail(null);
      setNotice(t(action === 'block' ? 'messages.userBlocked' : 'readiness.profileReported'));
    } catch (error) { setActionError(friendlyError(error, t)); }
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
          data-testid={`mode-${value.toLowerCase()}`} onClick={() => setMatchMode(value)} style={{ background: 'transparent' }}>
          {matchMode === value && <motion.span layoutId={reducedMotion ? undefined : 'match-mode-selection'} transition={reducedMotion ? { duration: 0 } : motionSpring}
            className="absolute inset-0 rounded-[14px] bg-[#E3ECE4]" />}
          <span className="relative z-10 flex items-center gap-1.5"><Icon size={16} /><span>{t(label)}</span></span>
        </button>)}</div>
        <div className="flex items-center justify-between gap-2 pt-2">
          <div className="relative flex gap-1 rounded-full border border-[#E4E2DC] p-0.5" aria-label={t('readiness.discover')}>
            {['browse', 'saved'].map(value => <button type="button" key={value} aria-pressed={view === value} data-testid={`discover-${value}`}
              onClick={() => setView(value)} style={{ background: 'transparent' }} className={`relative min-h-10 rounded-full px-3 text-sm ${view === value ? 'font-semibold' : 'text-[#57645C]'}`}>
              {view === value && <motion.span layoutId={reducedMotion ? undefined : 'match-discover-selection'} transition={reducedMotion ? { duration: 0 } : motionSpring}
                className="absolute inset-0 rounded-full bg-[#E3ECE4]" />}
              <span className="relative z-10">{t(`readiness.${value}`)}</span>
            </button>)}
          </div>
          <button type="button" data-testid="matches-more-filters" className="filter-trigger" onClick={() => { setDraft({ ...filters }); setShowFilters(true); }}>
            <Filter size={16} />{t('readiness.filters')}{Object.values(filters).filter(Boolean).length > 0 && ` (${Object.values(filters).filter(Boolean).length})`}</button>
        </div>
      </div>
      {!detail && (
        !eligible ? <div data-testid="match-mode-locked" className="m-4 rounded-2xl border bg-white p-5 space-y-4">
          <h2 className="text-lg font-semibold">{t('readiness.modeDisabled')}</h2>
          {checks.map(([label, ok, section]) => <div key={label} className="flex items-center gap-2 text-sm">
            {ok ? <CheckCircle2 size={18} /> : <XCircle size={18} />}<span>{t(label)} · {t(ok ? 'readiness.ready' : 'readiness.missing')}</span>
            {!ok && <button type="button" className="ml-auto min-h-11 underline" onClick={() => openProfile(section)}>{t('readiness.reviewChecks')}</button>}
          </div>)}
        </div> : page.loading && !current ? <p role="status" className="p-8 text-center">{t('readiness.loading')}</p>
          : page.error ? <div role="alert" className="space-y-3 p-5"><p>{page.error}</p><SecondaryButton onClick={() => loadPage(true)}>{t('readiness.retry')}</SecondaryButton></div>
          : <AnimatePresence mode="wait" initial={false} custom={cardAction}>
            {current ? <motion.article key={current.animal.id} data-testid="match-card" className="match-card"
              initial={reducedMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              custom={cardAction} variants={{ leave: action => reducedMotion ? { opacity: 0 } : { opacity: 0, x: action === 'pass' ? -16 : 0, y: action === 'pass' ? 0 : -8 } }}
              exit="leave" transition={{ duration: reducedMotion ? 0.1 : 0.22 }}>
              <motion.img src={current.animal.photoUrls?.[0]} alt={current.animal.name} className="match-photo"
                {...(!reducedMotion && current.animal.photoUrls?.[0] ? { layoutId: `match-photo-${current.animal.id}` } : {})} />
              <div className="match-card-info"><AnimalFacts candidate={current} t={t} onSafety={() => setSafetyTarget(current)} />
                <button type="button" data-testid="match-details-btn" onClick={() => setDetail(current)} className="about-animal">{t('readiness.about')} {current.animal.name} <span aria-hidden="true">›</span></button>
                {actions(current)}
              </div>
            </motion.article> : <motion.div key="match-empty" initial={reducedMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              exit={reducedMotion ? undefined : { opacity: 0 }} transition={reducedMotion ? { duration: 0 } : motionSpring}>
              <EmptyState icon={view === 'saved' ? Bookmark : Heart} title={t(view === 'saved' ? 'readiness.noSaved' : 'readiness.noCandidates')}
                description={t(view === 'saved' ? 'readiness.noSavedHint' : 'readiness.noCandidatesHint')} action={t('readiness.clearFilters')} onAction={clear} />
            </motion.div>}
          </AnimatePresence>
      )}
      {notice && <p role="status" className="px-5 pt-2 text-sm font-medium text-[#2C5E3F]">{notice}</p>}
      {!detail && <p className="match-mutual-hint">{t(matchMode === 'SOCIAL' ? 'readiness.walkHint' : 'readiness.mutualHint')}</p>}
    </>}
    <FilterSheet open={Boolean(walkTarget)} onClose={requestWalkClose} draggable={false} title={t('readiness.proposeWalk')}
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
    {walkDiscardDialog}
    <SafetyMenu open={Boolean(safetyTarget)} onClose={() => setSafetyTarget(null)}
      onReport={() => safetyAction('report')} onBlock={() => safetyAction('block')} />
    <AnimatePresence initial={false}>
      {detail && <motion.section key="match-detail" data-testid="match-detail-screen" className="petpal-fullscreen"
        initial={reducedMotion ? false : { opacity: 0, x: detail.animal.photoUrls?.[0] ? 0 : 16 }}
        animate={{ opacity: 1, x: 0 }} exit={reducedMotion ? undefined : { opacity: 0, x: 16 }}
        transition={reducedMotion ? { duration: 0 } : motionSpring}>
        <ScreenHeader title={`${t('readiness.about')} ${detail.animal.name}`} onBack={() => setDetail(null)} />
        <div className="min-h-0 flex-1 overflow-y-auto"><motion.img src={detail.animal.photoUrls?.[0]} alt={detail.animal.name} className="h-64 w-full object-cover"
          {...(!reducedMotion && detail.animal.photoUrls?.[0] ? { layoutId: `match-photo-${detail.animal.id}` } : {})} />
          <div className="p-5 space-y-3"><AnimalFacts candidate={detail} detailed t={t} onSafety={() => setSafetyTarget(detail)} /></div>
        </div><footer className="shrink-0 border-t bg-white p-4">{actions(detail)}</footer>
      </motion.section>}
    </AnimatePresence>
    <Modal open={Boolean(matchSuccess)} onClose={() => setMatchSuccess(null)}>
      <MatchCelebration matchSuccess={matchSuccess} t={t} reducedMotion={reducedMotion} animate={animateMatch}
        onClose={() => setMatchSuccess(null)} onOpenMessages={requestOpenConversation} />
    </Modal>
    <FilterSheet open={showFilters} onClose={() => setShowFilters(false)} title={t('readiness.filters')} footer={<>
      <SecondaryButton onClick={() => { clear(); setShowFilters(false); }}>{t('readiness.reset')}</SecondaryButton>
      <PrimaryButton onClick={() => { setFilters({ ...draft }); setShowFilters(false); }}>{t('matches.applyFilters')}</PrimaryButton></>}>
      <fieldset><legend className="mb-2 font-semibold">{t('matches.showMe')}</legend>
        <SpeciesSelector value={draft.species} t={t} reducedMotion={reducedMotion} onChange={species => { setDraft(d => ({ ...d, species, breed: '' })); }} />
      </fieldset>
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
