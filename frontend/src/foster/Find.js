import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Bookmark, BookmarkCheck, Cat, Dog, Flag, Home, MapPin, Search, Star, Zap } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { friendlyError } from '../services/errors';
import { loadFosterDirectory } from '../services/fosterApi';
import { Button, Card, Choices, Empty, Field, Notice, Photo, Screen, Sheet, fmt, itemMotion, listMotion } from './ui';
import { Segment, person } from '../ui/kit';

const durationKey = { FEW_DAYS: 'fewDays', ONE_TWO_WEEKS: 'oneTwoWeeks', ONE_MONTH: 'oneMonth', UNTIL_ADOPTION: 'untilAdoption', UNKNOWN: 'notSure' };
export const durationLabel = (value, t) => t(`fx.${durationKey[value] || 'notSure'}`);

export default function Find({ data, onOpenCase, onOpenHome }) {
  const { t, user } = useApp();
  const [type, setType] = useState('animals');
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState([]);
  const [page, setPage] = useState(0);
  const [result, setResult] = useState({ rows: [], count: 0, loading: true, error: '' });
  const species = filters.includes('DOG') && !filters.includes('CAT') ? 'DOG' : filters.includes('CAT') && !filters.includes('DOG') ? 'CAT' : '';

  useEffect(() => {
    let cancelled = false;
    setResult(current => ({ ...current, loading: true, error: '' }));
    const savedIds = filters.includes('SAVED') ? data.saved.map(item => (type === 'homes' ? item.home_id : item.case_id)).filter(Boolean) : undefined;
    const timer = setTimeout(() => loadFosterDirectory({ type, query, species, urgent: filters.includes('URGENT'), page, savedIds, excludeOwnerId: user.id })
      .then(value => { if (!cancelled) setResult(current => ({ rows: page ? [...current.rows, ...value.rows] : value.rows, count: value.count, loading: false, error: '' })); })
      .catch(error => { if (!cancelled) setResult({ rows: [], count: 0, loading: false, error: friendlyError(error, t) }); }), 200);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [type, query, species, filters, page, data.saved, t, user.id]);

  const change = setter => value => { setter(value); setPage(0); };
  const filterOptions = [['DOG', t('fx.dogs'), Dog], ['CAT', t('fx.cats'), Cat],
    ...(type === 'animals' ? [['URGENT', t('fx.urgent'), Zap]] : []), ['SAVED', t('fx.saved'), Bookmark]];

  return <>
    <header className="fx-hello"><h1>{t('fx.tabFind')}</h1></header>
    <div className="fx-stack" style={{ marginTop: 12 }}>
      <Segment label={t('fx.tabFind')} value={type} onChange={change(value => { setType(value); setFilters(current => current.filter(f => f !== 'URGENT')); })}
        options={[['animals', t('fx.segAnimals')], ['homes', t('fx.homesOffer')]]} />
      <label className="fx-search"><Search size={18} />
        <input className="fx-input" value={query} placeholder={t('fx.search')} aria-label={t('fx.search')} onChange={event => change(setQuery)(event.target.value)} /></label>
      <div className="fx-filters"><Choices label={t('care.filters')} multiple value={filters} onChange={change(setFilters)} options={filterOptions} /></div>
    </div>

    {result.error && <Notice tone="error">{result.error}</Notice>}
    <AnimatePresence mode="wait">
      <motion.div key={`${type}-${species}-${filters.join()}`} variants={listMotion} initial="hidden" animate="show" style={{ marginTop: 16 }}
        className={type === 'animals' ? 'fx-grid' : 'fx-stack'}>
        {result.loading && !result.rows.length ? [0, 1, 2, 3].map(i => <div key={i} className="fx-skeleton" style={{ height: type === 'animals' ? 220 : 96 }} />)
          : !result.rows.length ? <div style={{ gridColumn: '1 / -1' }}><Empty art="dog" title={t('fx.nothingFound')} /></div>
            : type === 'animals' ? result.rows.map(item => <Card key={item.id} className="fx-animal" onClick={() => onOpenCase(item)}>
              <Photo src={item.photo} name={item.name} species={item.species} layoutId={`case-photo-${item.id}`} />
              {item.urgency === 'HIGH' && <span className="fx-badge is-clay"><Zap size={12} />{t('fx.urgent')}</span>}
              <div className="fx-animal-info"><h2>{item.name}</h2><p>{durationLabel(item.duration, t)} · {item.area || item.city}</p></div>
            </Card>)
              : result.rows.map(home => <HomeCard key={home.id} home={home} onClick={() => onOpenHome(home)} />)}
      </motion.div>
    </AnimatePresence>
    {result.rows.length < result.count && <Button variant="secondary" className="fx-button-block" style={{ marginTop: 16 }}
      disabled={result.loading} onClick={() => setPage(value => value + 1)}>{t('care.loadMore')}</Button>}
  </>;
}

export function freePlaces(home) {
  return Math.max(0, (home.capacity || 0) - (home.occupied || 0) - (home.reserved || 0));
}

function HomeCard({ home, onClick }) {
  const { t } = useApp();
  const free = freePlaces(home);
  return <Card className="fx-home" onClick={onClick}>
    <Photo src={home.photos?.[0]} name={home.name} className="fx-photo-md" />
    <div className="fx-grow">
      <h2>{home.name}</h2>
      <p className="fx-muted"><MapPin size={12} style={{ display: 'inline', marginRight: 3 }} />{home.area || home.city}</p>
      <div className="fx-row" style={{ gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
        <span className={`fx-badge ${free ? '' : 'is-muted'}`}>{free ? fmt(t('fx.placesFree'), { count: free }) : t('fx.full')}</span>
        {home.review_count > 0 && <span className="fx-badge is-sun"><Star size={12} />{home.rating} · {fmt(t('fx.reviews'), { count: home.review_count })}</span>}
      </div>
    </div>
  </Card>;
}

export function CaseDetail({ item, data, onBack, onOffer, onEdit, onToggleSave, onReport }) {
  const { t, user } = useApp();
  const mine = item.responsible_id === user.id;
  const alreadyOffered = data.outgoing.some(r => r.case_id === item.id && ['PENDING', 'ACCEPTED'].includes(r.status));
  const saved = data.saved.some(s => s.case_id === item.id);
  const covered = [['food_covered', 'fx.food'], ['vet_covered', 'fx.vet'], ['transport_available', 'fx.transport']].filter(([key]) => item[key]);
  return <Screen title={item.name} onBack={onBack}
    action={!mine && <button type="button" className="fx-icon-button" aria-pressed={saved} aria-label={t(saved ? 'fx.unsave' : 'fx.save')} onClick={onToggleSave}>
      {saved ? <BookmarkCheck size={20} color="var(--pp-green)" /> : <Bookmark size={20} />}</button>}
    footer={mine ? <Button className="fx-button-block" variant="secondary" onClick={onEdit}>{t('fx.edit')}</Button>
      : alreadyOffered ? <Button className="fx-button-block" variant="soft" disabled>{t('fx.offered')}</Button>
        : <Button className="fx-button-block" icon={Home} onClick={onOffer}>{t('fx.offerMyHome')}</Button>}>
    <div className="fx-hero">
      <Photo src={item.photo} name={item.name} species={item.species} className="fx-photo-hero" layoutId={`case-photo-${item.id}`} />
      <div className="fx-hero-overlay">
        {item.urgency === 'HIGH' && <span className="fx-badge is-clay"><Zap size={12} />{t('fx.urgent')}</span>}
        <span className="fx-badge">{durationLabel(item.duration, t)}</span>
      </div>
    </div>
    <motion.div className="fx-stack" variants={listMotion} initial="hidden" animate="show" style={{ marginTop: 16 }}>
      <motion.div variants={itemMotion}>
        <h2 className="fx-page-title">{item.name}</h2>
        <p className="fx-lead"><MapPin size={14} style={{ display: 'inline', marginRight: 4 }} />{[item.area, item.city].filter(Boolean).join(', ')}
          {item.breed ? ` · ${item.breed}` : ''}</p>
      </motion.div>
      <Card><p className="fx-eyebrow">{fmt(t('fx.aboutAnimal'), { name: item.name })}</p>
        <p style={{ marginTop: 8, fontSize: 15, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{item.description}</p></Card>
      {covered.length > 0 && <Card><p className="fx-eyebrow">{t('fx.covered')}</p>
        <div className="fx-row" style={{ gap: 6, marginTop: 10, flexWrap: 'wrap' }}>{covered.map(([key, label]) => <span key={key} className="fx-badge">✓ {t(label)}</span>)}</div></Card>}
      {item.medical_needs && <Card><p className="fx-eyebrow">{t('fx.medical')}</p><p style={{ marginTop: 8, fontSize: 15, lineHeight: 1.5 }}>{item.medical_needs}</p></Card>}
      {item.home_fit && <Card><p className="fx-eyebrow">{t('fx.homeFit')}</p><p style={{ marginTop: 8, fontSize: 15, lineHeight: 1.5 }}>{item.home_fit}</p></Card>}
      <Card><p className="fx-eyebrow">{t('fx.postedBy')}</p><p style={{ marginTop: 6, fontWeight: 650 }}>{item.organization_name || person(item.responsible_name, t)}</p></Card>
      <p className="fx-muted" style={{ padding: '0 4px' }}>{t('fx.chatFirst')}</p>
      {!mine && <Button variant="ghost" icon={Flag} onClick={onReport}>{t('fx.report')}</Button>}
    </motion.div>
  </Screen>;
}

export function HomeDetail({ home, onBack, onInvite, onReport }) {
  const { t, user } = useApp();
  const free = freePlaces(home);
  const mine = home.profile_id === user.id;
  return <Screen title={home.name} onBack={onBack}
    footer={!mine && <Button className="fx-button-block" onClick={onInvite} disabled={!free}>{t('care.invite')}</Button>}>
    <div className="fx-hero"><Photo src={home.photos?.[0]} name={home.name} className="fx-photo-hero" /></div>
    <motion.div className="fx-stack" variants={listMotion} initial="hidden" animate="show" style={{ marginTop: 16 }}>
      <motion.div variants={itemMotion}>
        <h2 className="fx-page-title">{home.name}</h2>
        <p className="fx-lead">{[home.area, home.city].filter(Boolean).join(', ')}{home.housing_type ? ` · ${home.housing_type}` : ''}</p>
        <div className="fx-row" style={{ gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
          <span className={`fx-badge ${free ? '' : 'is-muted'}`}>{free ? fmt(t('fx.placesFree'), { count: free }) : t('fx.full')}</span>
          {(home.species || []).map(s => <span key={s} className="fx-badge is-muted">{t(s === 'DOG' ? 'fx.dogs' : 'fx.cats')}</span>)}
          {home.review_count > 0 && <span className="fx-badge is-sun"><Star size={12} />{home.rating} · {fmt(t('fx.reviews'), { count: home.review_count })}</span>}
        </div>
      </motion.div>
      {home.bio && <Card><p style={{ fontSize: 15, lineHeight: 1.6 }}>{home.bio}</p></Card>}
      {home.experience && <Card><p className="fx-eyebrow">{t('fx.experience')}</p><p style={{ marginTop: 8, fontSize: 15, lineHeight: 1.5 }}>{home.experience}</p></Card>}
      <p className="fx-muted" style={{ padding: '0 4px' }}>{t('fx.notInPetPal')}</p>
      {!mine && <Button variant="ghost" icon={Flag} onClick={onReport}>{t('fx.report')}</Button>}
    </motion.div>
  </Screen>;
}

// Sends an offer (my home for their animal) or an invite (their home for my animal).
export function OfferSheet({ open, kind, item, data, onClose, onSend, onSetUpHome }) {
  const { t } = useApp();
  const homes = data.ownHomes;
  const myActiveCases = data.myCases.filter(c => c.status === 'ACTIVE');
  const [homeId, setHomeId] = useState('');
  const [caseId, setCaseId] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  useEffect(() => {
    if (!open || !item) return;
    setHomeId(kind === 'INVITE' ? item.id : homes[0]?.id || '');
    setCaseId(kind === 'APPLICATION' ? item.id : myActiveCases[0]?.id || '');
    setMessage(kind === 'APPLICATION' ? fmt(t('fx.offerTemplate'), { name: item.name }) : '');
    setError('');
  }, [open, item, kind]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!item) return null;
  const needsHome = kind === 'APPLICATION' && !homes.length;
  const send = async () => {
    setSending(true); setError('');
    try { await onSend({ kind, caseId, homeId, message }); }
    catch (failure) { setError(friendlyError(failure, t)); }
    finally { setSending(false); }
  };
  return <Sheet open={open} onClose={onClose} title={kind === 'APPLICATION' ? fmt(t('fx.offerTitle'), { name: item.name }) : t('care.invite')}
    footer={needsHome ? <Button onClick={onSetUpHome} icon={Home}>{t('fx.setUpHome')}</Button>
      : <><Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
        <Button disabled={sending || !message.trim() || !homeId || !caseId} onClick={send}>{sending ? t('fx.loading') : t('fx.sendOffer')}</Button></>}>
    {needsHome ? <p className="fx-lead">{t('fx.needHomeFirst')}</p> : <>
      {kind === 'APPLICATION' && homes.length > 1 && <Field label={t('fx.whichHome')}>
        <Choices label={t('fx.whichHome')} value={homeId} onChange={setHomeId} options={homes.map(h => [h.id, h.name])} /></Field>}
      {kind === 'INVITE' && (myActiveCases.length ? <Field label={t('care.chooseCase')}>
        <Choices label={t('care.chooseCase')} value={caseId} onChange={setCaseId} options={myActiveCases.map(c => [c.id, c.name])} /></Field>
        : <p className="fx-lead">{t('fx.noAnimalsYet')}</p>)}
      <Field label={t('fx.offerMessage')}><textarea className="fx-input" maxLength={4000} value={message} onChange={event => setMessage(event.target.value)} /></Field>
      <p className="fx-muted">{t('fx.chatFirst')}</p>
      {error && <Notice tone="error">{error}</Notice>}
    </>}
  </Sheet>;
}
