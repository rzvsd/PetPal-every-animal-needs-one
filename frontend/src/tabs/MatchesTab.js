import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useMotionValue, useTransform } from 'framer-motion';
import { ArrowLeft, Bookmark, BookmarkCheck, Cat, Dog, Heart, Lock, MapPin, MessageCircle, MoreHorizontal, PawPrint, SlidersHorizontal, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { DOG_BREEDS, CAT_BREEDS } from '../data/breeds';
import { FilterSheet, Modal, SafetyMenu } from '../components/SharedComponents';
import { friendlyError } from '../services/errors';
import { useReducedPetMotion } from '../components/Motion';
import { useDiscardGuard } from '../components/FormGuard';
import { loadMatchCandidates, findSocialWalkConversation, requestSocialWalk } from '../services/supabaseApi';
import { useBackHandler } from '../navigation/backNavigation';
import { Avatar, Button, Empty, IconButton, Notice, OverScreen, Segment, Skeleton, TextField, fmt } from '../ui/kit';
import { ease, spring, springPage } from '../ui/motion';
import './match.css';

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
  if (months == null) return null;
  const years = Math.floor(months / 12);
  return years ? `${years} ${t(years === 1 ? 'common.year' : 'common.years')}` : `${months} ${t(months === 1 ? 'common.month' : 'common.months')}`;
}

// "Golden Retriever · 2 years · Female": the facts people scan first.
function metaLine(animal, t) {
  const breed = animal.breed && animal.breed !== 'Unknown' ? animal.breed : null;
  const sex = animal.sex === 'MALE' ? t('common.male') : animal.sex === 'FEMALE' ? t('common.female') : null;
  return [breed, ageLabel(animal.ageMonths, t), sex].filter(Boolean).join(' · ');
}
const place = animal => [animal.coarseArea, animal.city].filter(Boolean).join(', ');

// The card leaves toward the answer given: left for "not now", right for yes.
const cardVariants = {
  enter: { opacity: 0, scale: 0.94, y: 14 },
  still: { opacity: 1, scale: 1, y: 0, x: 0, rotate: 0, transition: springPage },
  leave: action => ({ opacity: 0, x: action === 'pass' ? -380 : 380, rotate: action === 'pass' ? -9 : 9, transition: { duration: 0.32, ease } }),
};

function MatchCard({ candidate, t, onOpen, onSafety, onSwipe, busy }) {
  const reduced = useReducedPetMotion();
  const { animal } = candidate;
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-220, 220], [-7, 7]);
  const yesOpacity = useTransform(x, [30, 110], [0, 1]);
  const noOpacity = useTransform(x, [-110, -30], [1, 0]);
  const dragged = useRef(false);
  const tags = animal.temperamentTags?.slice(0, 4).join(' · ');
  return <motion.article data-testid="match-card" className="pp-card" custom="advance" variants={cardVariants}
    initial={reduced ? false : 'enter'} animate="still" exit="leave"
    style={reduced ? undefined : { x, rotate }} drag={reduced || busy ? false : 'x'} dragSnapToOrigin dragElastic={0.9}
    onDragStart={() => { dragged.current = true; }}
    onDragEnd={(_, info) => {
      window.setTimeout(() => { dragged.current = false; }, 0);
      if (info.offset.x > 110 || info.velocity.x > 700) onSwipe('like', { x: info.point.x, y: info.point.y });
      else if (info.offset.x < -110 || info.velocity.x < -700) onSwipe('pass');
    }}>
    <button type="button" data-testid="match-details-btn" className="pp-card-photo" aria-label={`${t('readiness.about')} ${animal.name}`}
      onClick={() => { if (!dragged.current) onOpen(); }}>
      <motion.div layoutId={reduced ? undefined : `match-photo-${animal.id}`} className="pp-card-img" transition={springPage}>
        <Avatar src={animal.photoUrls?.[0]} name={animal.name} species={animal.species} size="100%" />
      </motion.div>
      {!reduced && <>
        <motion.span className="pp-card-verdict is-yes" style={{ opacity: yesOpacity }} aria-hidden="true"><Heart size={30} fill="currentColor" /></motion.span>
        <motion.span className="pp-card-verdict is-no" style={{ opacity: noOpacity }} aria-hidden="true"><X size={30} strokeWidth={3} /></motion.span>
      </>}
    </button>
    <div className="pp-card-info">
      <h2 className="pp-card-name">{animal.name}</h2>
      <p className="pp-card-meta">{metaLine(animal, t)}</p>
      <p className="pp-card-meta"><MapPin size={14} aria-hidden="true" />{place(animal) || t('common.unknown')}</p>
      {tags && <p className="pp-card-tags">{tags}</p>}
    </div>
    <IconButton icon={MoreHorizontal} variant="glass" label={t('readiness.safetyOptions')} onClick={onSafety} data-testid="match-safety-btn" className="pp-card-more" />
  </motion.article>;
}

// Hearts that fly out from where the thumb pressed "like".
function HeartBurst({ burst }) {
  const reduced = useReducedPetMotion();
  if (reduced) return null;
  return <AnimatePresence>{burst && <div key={burst.id} className="pp-hearts" style={{ left: burst.x, top: burst.y }} aria-hidden="true">
    {[...Array(9)].map((_, i) => { const a = (i / 9) * Math.PI * 2 + 0.4; const d = 70 + (i % 3) * 32;
      return <motion.span key={i} initial={{ x: 0, y: 0, scale: 0.3, opacity: 1 }}
        animate={{ x: Math.cos(a) * d, y: Math.sin(a) * d - 40, scale: [0.3, 1.1, 0.9], opacity: [1, 1, 0], rotate: (i % 2 ? 1 : -1) * 25 }}
        transition={{ duration: 0.85, ease: 'easeOut' }}><Heart size={16 + (i % 3) * 6} fill="currentColor" /></motion.span>; })}
  </div>}</AnimatePresence>;
}

function ActionBar({ onLike, onPass, onSave, isSaved, busy, social, t }) {
  const reduced = useReducedPetMotion();
  return <div className="pp-actions">
    <IconButton icon={X} size={26} variant="ring" label={t('matches.notNow')} onClick={onPass} disabled={busy} data-testid="match-pass-btn" className="pp-action-round" />
    <Button className="pp-action-main" icon={social ? MessageCircle : Heart} busy={busy} data-testid="match-like-btn"
      onClick={event => onLike(event.clientX && event.clientY ? { x: event.clientX, y: event.clientY } : null)}>
      {t(social ? 'readiness.proposeWalk' : 'matches.like')}</Button>
    <motion.button type="button" whileTap={reduced ? undefined : { scale: 0.92 }} data-testid="match-save-btn" onClick={onSave} disabled={busy}
      aria-pressed={isSaved} aria-label={t(isSaved ? 'readiness.unsave' : 'readiness.savedLabel')} className="ui-icon-btn ui-icon-btn-ring pp-action-round">
      <AnimatePresence mode="wait" initial={false}>
        <motion.span key={String(isSaved)} initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }} transition={spring}>
          {isSaved ? <BookmarkCheck size={24} className="pp-saved" /> : <Bookmark size={24} />}
        </motion.span>
      </AnimatePresence>
    </motion.button>
  </div>;
}

function MatchDetail({ candidate, t, onBack, onSafety, actions }) {
  const reduced = useReducedPetMotion();
  const { animal } = candidate;
  useBackHandler(true, onBack);
  const reveal = { initial: reduced ? false : { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0, transition: { duration: 0.28, ease, delay: 0.1 } } };
  return <motion.section key="match-detail" data-testid="match-detail-screen" className="petpal-fullscreen pp-detail" aria-label={animal.name}
    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.18 } }} transition={{ duration: 0.16 }}>
    <div className="ui-scroll">
      <motion.div layoutId={reduced ? undefined : `match-photo-${animal.id}`} className="pp-detail-hero" transition={springPage}>
        <Avatar src={animal.photoUrls?.[0]} name={animal.name} species={animal.species} size="100%" />
      </motion.div>
      <motion.div className="pp-detail-body" {...reveal}>
        <h1 className="ui-title-xl">{animal.name}</h1>
        <p className="pp-card-meta">{metaLine(animal, t)}</p>
        {animal.temperamentTags?.length > 0 && <div className="pp-detail-block">
          <h2 className="ui-overline">{t('readiness.animalFacts')}</h2>
          <p className="pp-detail-text">{animal.temperamentTags.join(' · ')}</p>
        </div>}
        <div className="pp-detail-block">
          <h2 className="ui-overline">{t('matches.health')}</h2>
          {animal.vaccineStatus === 'UP_TO_DATE' && <p className="pp-detail-text">{t('readiness.vaccineReported')}</p>}
          <p className="ui-small">{t('matches.ownerDeclared')}</p>
        </div>
        <div className="pp-detail-block">
          <h2 className="ui-overline">{t('matches.area')}</h2>
          <p className="pp-detail-text">{place(animal) || t('common.unknown')}</p>
          <p className="ui-small pp-detail-private"><Lock size={14} aria-hidden="true" />{t('matches.locationPrivate')}</p>
        </div>
      </motion.div>
    </div>
    <div className="pp-detail-top">
      <IconButton icon={ArrowLeft} variant="float" label={t('common.back')} onClick={onBack} data-testid="back-button" />
      <IconButton icon={MoreHorizontal} variant="float" label={t('readiness.safetyOptions')} onClick={onSafety} />
    </div>
    <footer className="pp-detail-foot">{actions}</footer>
  </motion.section>;
}

function MatchCelebration({ matchSuccess, t, onOpenMessages, onClose }) {
  const reduced = useReducedPetMotion();
  const mine = matchSuccess?.myAnimal;
  const theirs = matchSuccess?.theirAnimal;
  const slide = from => ({ initial: reduced ? false : { opacity: 0, x: from, rotate: from > 0 ? 8 : -8 }, animate: { opacity: 1, x: 0, rotate: 0, transition: springPage } });
  return <div className="pp-celebrate">
    {!reduced && [...Array(14)].map((_, i) => <motion.span key={i} className="pp-celebrate-heart" aria-hidden="true"
      style={{ left: `${6 + (i * 37) % 88}%` }} initial={{ y: 40, opacity: 0, scale: 0.5 }}
      animate={{ y: -560, opacity: [0, 1, 1, 0], scale: 0.6 + (i % 4) * 0.25, rotate: (i % 2 ? 1 : -1) * 30 }}
      transition={{ duration: 2.6 + (i % 5) * 0.4, delay: 0.2 + (i % 7) * 0.18, ease: 'easeOut' }}><Heart fill="currentColor" size={18 + (i % 3) * 10} /></motion.span>)}
    <div className="pp-celebrate-pair" aria-hidden="true">
      <motion.span {...slide(-60)}><Avatar src={mine?.photoUrls?.[0]} species={mine?.species} size={150} className="is-round" /></motion.span>
      <motion.span {...slide(60)}><Avatar src={theirs?.photoUrls?.[0]} species={theirs?.species} size={150} className="is-round" /></motion.span>
    </div>
    <motion.h2 className="pp-celebrate-title" initial={reduced ? false : { opacity: 0, y: 30, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ ...springPage, delay: 0.25 }}>{t('matches.matchSuccess')}</motion.h2>
    <p className="pp-celebrate-text">{fmt(t('matches.matchSuccessDesc'), { mine: mine?.name || '', theirs: theirs?.name || '' })}</p>
    <div className="pp-celebrate-actions">
      <Button block icon={MessageCircle} onClick={() => { const id = matchSuccess.conversationId; onClose(); onOpenMessages(id); }}>{t('matches.openMessages')}</Button>
      <Button block variant="secondary" onClick={onClose}>{t('matches.continueBrowsing')}</Button>
    </div>
  </div>;
}

function CardSkeleton() {
  return <div className="pp-card is-skeleton" aria-hidden="true">
    <Skeleton height="100%" radius={28} className="pp-card-photo" />
    <div className="pp-card-info"><Skeleton width="45%" height={28} /><Skeleton width="70%" height={14} /><Skeleton width="55%" height={14} /></div>
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
  const [burst, setBurst] = useState(null);
  const actionLock = useRef(false);
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
  useEffect(() => {
    if (!hasCandidate && page.hasMore && !page.loading && !page.error) loadPage();
  }, [hasCandidate, page.hasMore, page.loading, page.error, loadPage]);
  const isCat = selectedAnimal?.species === 'CAT';
  useEffect(() => {
    if (matchMode === 'VERIFIED_MATE' || (matchMode === 'SOCIAL' && isCat)) setMatchMode('PLAY');
  }, [matchMode, setMatchMode, isCat]);
  const modes = [['PLAY', t('matches.play')], ...(isCat ? [] : [['SOCIAL', t('matches.social')]])];
  const eligible = Boolean(selectedAnimal?.activeMatchModes?.includes(matchMode));
  const activeFilters = Object.values(filters).filter(Boolean).length;
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
  const like = (item, at) => {
    const stage = document.querySelector('.pp-match-stage')?.getBoundingClientRect();
    if (at && stage && !reducedMotion) setBurst({ id: Date.now(), x: at.x - stage.left, y: at.y - stage.top });
    return act('like', item);
  };
  const actions = item => <ActionBar onLike={at => like(item, at)} onPass={() => act('pass', item)} onSave={() => act('save', item)}
    isSaved={savedAnimals.includes(item.animal.id)} busy={busy} social={matchMode === 'SOCIAL'} t={t} />;
  const toggleDraft = (name, value) => setDraft(d => ({ ...d, [name]: d[name] === value ? emptyMatchFilters[name] : value }));
  const clear = () => { setFilters({ ...emptyMatchFilters }); setDraft({ ...emptyMatchFilters }); };
  const breeds = draft.species === 'CAT' ? CAT_BREEDS : draft.species === 'DOG' ? DOG_BREEDS : [...new Set([...DOG_BREEDS, ...CAT_BREEDS])].sort();
  const choice = (name, options) => <div className="pp-chips">{options.map(([value, label]) => <button type="button" key={value}
    aria-pressed={draft[name] === value} className="pp-chip" onClick={() => toggleDraft(name, value)}>{label}</button>)}</div>;

  const fade = { className: 'pp-stage-item', initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0, transition: { duration: 0.12 } } };
  const stage = !eligible ? <motion.div key={'locked'} {...fade}><Empty art="paw" title={t('readiness.modeDisabled')}
      action={<Button onClick={() => { navigate('editAnimal', { animalId: selectedAnimalId }); setActiveTab('profile'); }}>{t('readiness.reviewChecks')}</Button>} /></motion.div>
    : page.loading && !current ? <motion.div key={'loading'} {...fade}><CardSkeleton /></motion.div>
      : page.error ? <motion.div key={'error'} {...fade}><Notice tone="error" action={<button type="button" className="ui-notice-close" onClick={() => loadPage(true)}>{t('readiness.retry')}</button>}>{page.error}</Notice></motion.div>
        : current ? <MatchCard key={current.animal.id} candidate={current} t={t} busy={busy}
          onOpen={() => setDetail(current)} onSafety={() => setSafetyTarget(current)} onSwipe={(type, at) => (type === 'like' ? like(current, at) : act(type, current))} />
          : <motion.div key={`empty-${view}`} {...fade}><Empty art={view === 'saved' ? 'heart' : 'dog'} title={t(view === 'saved' ? 'readiness.noSaved' : 'readiness.noCandidates')}
            text={t(view === 'saved' ? 'readiness.noSavedHint' : 'readiness.noCandidatesHint')}
            action={activeFilters > 0 && <Button variant="secondary" onClick={clear}>{t('readiness.clearFilters')}</Button>} /></motion.div>;

  return <div data-testid="matches-tab" className="pp-match">
    {!myAnimals.length ? <Empty art="dog" title={t('matches.noAnimalTitle')} text={t('matches.noAnimalDesc')}
      action={<Button onClick={() => { navigate('createAnimal'); setActiveTab('profile'); }}>{t('matches.createProfile')}</Button>} /> : <>
      <div className="pp-match-controls">
        <Segment label={t('matches.showMe')} value={matchMode} onChange={setMatchMode} options={modes} className="ui-grow" />
        <motion.button type="button" whileTap={reducedMotion ? undefined : { scale: 0.92 }} data-testid="discover-saved" aria-pressed={view === 'saved'}
          aria-label={t('readiness.saved')} title={t('readiness.saved')} className="ui-icon-btn ui-icon-btn-soft pp-toggle"
          onClick={() => setView(value => (value === 'saved' ? 'browse' : 'saved'))}>
          {view === 'saved' ? <BookmarkCheck size={21} /> : <Bookmark size={21} />}
        </motion.button>
        <IconButton icon={SlidersHorizontal} variant="soft" label={t('readiness.filters')} badge={activeFilters} data-testid="matches-more-filters"
          onClick={() => { setDraft({ ...filters }); setShowFilters(true); }} />
      </div>
      {view === 'saved' && <p className="pp-match-mode-note">{t('readiness.saved')}</p>}
      <div className="pp-match-stage">
        {/* Every state shares one grid cell, so the next card rises where the last one left. */}
        <AnimatePresence initial={false} custom={cardAction}>{stage}</AnimatePresence>
        <HeartBurst burst={burst} />
        {current && eligible && !page.error && <div className="pp-match-float">{actions(current)}</div>}
      </div>
      <AnimatePresence>{(actionError || notice) && <div className="pp-match-notice">
        {actionError ? <Notice key="error" tone="error" onClose={() => setActionError('')}>{actionError}</Notice>
          : <Notice key="notice" tone="success" onClose={() => setNotice('')}>{notice}</Notice>}
      </div>}</AnimatePresence>
      {current && eligible && !page.error && <p className="pp-match-hint">{t(matchMode === 'SOCIAL' ? 'readiness.walkHintShort' : 'readiness.mutualHint')}</p>}
    </>}
    <FilterSheet open={Boolean(walkTarget)} onClose={requestWalkClose} draggable={false} title={t('readiness.proposeWalk')}
      footer={<Button block onClick={sendWalkRequest} busy={busy} disabled={!walkBody.trim() || [...walkBody].length > 4000}>{t('readiness.sendWalkRequest')}</Button>}>
      <div className="pp-walk-pair">
        <Avatar src={selectedAnimal?.photoUrls?.[0]} species={selectedAnimal?.species} size={44} className="is-round" />
        <Avatar src={walkTarget?.animal.photoUrls?.[0]} species={walkTarget?.animal.species} size={44} className="is-round" />
        <p className="ui-title-s">{selectedAnimal?.name} + {walkTarget?.animal.name}</p>
      </div>
      <p className="ui-small">{t('readiness.walkHint')}</p>
      <TextField multiline rows={4} label={t('readiness.walkFirstMessage')} data-testid="walk-request-input" value={walkBody} disabled={busy}
        hint={`${[...walkBody].length}/4000 ${t('readiness.characterCount')}`} error={actionError || undefined}
        onChange={event => {
          setWalkBody(event.target.value);
          if (!messaging.saveDraft(`walk:${selectedAnimalId}:${walkTarget.animal.id}`, event.target.value)) setActionError(t('readiness.storageFailed'));
        }} />
    </FilterSheet>
    {walkDiscardDialog}
    <SafetyMenu open={Boolean(safetyTarget)} onClose={() => setSafetyTarget(null)}
      onReport={() => safetyAction('report')} onBlock={() => safetyAction('block')} />
    <OverScreen><AnimatePresence>
      {detail && <MatchDetail key="detail" candidate={detail} t={t} onBack={() => setDetail(null)} onSafety={() => setSafetyTarget(detail)} actions={actions(detail)} />}
    </AnimatePresence></OverScreen>
    <Modal open={Boolean(matchSuccess)} onClose={() => setMatchSuccess(null)} className="pp-celebrate-full">
      <MatchCelebration matchSuccess={matchSuccess} t={t} onClose={() => setMatchSuccess(null)} onOpenMessages={requestOpenConversation} />
    </Modal>
    <FilterSheet open={showFilters} onClose={() => setShowFilters(false)} title={t('readiness.filters')} footer={<>
      <Button variant="secondary" onClick={() => { clear(); setShowFilters(false); }}>{t('readiness.reset')}</Button>
      <Button className="ui-grow" onClick={() => { setFilters({ ...draft }); setShowFilters(false); }}>{t('matches.applyFilters')}</Button></>}>
      <fieldset className="pp-fieldset"><legend className="ui-field-label">{t('matches.showMe')}</legend>
        <Segment label="species" value={draft.species} onChange={species => setDraft(d => ({ ...d, species, breed: '' }))}
          options={[['', t('readiness.allAnimals'), PawPrint], ['DOG', t('matches.dogs'), Dog], ['CAT', t('matches.cats'), Cat]]} />
      </fieldset>
      <label className="ui-field"><span className="ui-field-label">{t('matches.breed')}</span>
        <select value={draft.breed} onChange={event => setDraft(d => ({ ...d, breed: event.target.value }))} className="ui-input">
          <option value="">{t('matches.anyBreed')}</option>{breeds.map(breed => <option key={breed}>{breed}</option>)}</select></label>
      <fieldset className="pp-fieldset"><legend className="ui-field-label">{t('matches.sex')}</legend>
        {choice('sex', [['MALE', t('common.male')], ['FEMALE', t('common.female')]])}</fieldset>
      <fieldset className="pp-fieldset"><legend className="ui-field-label">{t('matches.size')}</legend>
        {choice('size', [['SMALL', t('common.small')], ['MEDIUM', t('common.medium')], ['LARGE', t('common.large')]])}</fieldset>
      <TextField label={t('matches.area')} value={draft.area} onChange={event => setDraft(d => ({ ...d, area: event.target.value }))} />
    </FilterSheet>
  </div>;
}
