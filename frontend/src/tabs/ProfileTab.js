import PlatformAdminEntry from '../components/PlatformAdmin';
import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useApp } from '../context/AppContext';
import { friendlyError } from '../services/errors';
import { deleteSupabaseAccount, exportSupabaseData, loadSupabaseDeletionBlockers } from '../services/supabaseApi';
import { useReducedPetMotion } from '../components/Motion';
import { useDiscardGuard } from '../components/FormGuard';
import { FilterSheet } from '../components/SharedComponents';
import { Screen } from '../foster/ui';
import { Toggle } from '../foster/Wizard';
import { Avatar, Button, Notice, PageTitle, Row, Section, Segment, TextField, fmt } from '../ui/kit';
import { list, listItem } from '../ui/motion';
import {
  Bell, CheckCircle2, Circle, Download, Heart, HelpCircle, Home, Languages, Lock, LogOut, Plus, Shield, Trash2,
} from 'lucide-react';
import './profile.css';

// Row icons share one quiet shape; danger rows use the danger colour.
const icon = (Icon, danger) => <span className={`pp-row-icon ${danger ? 'is-danger' : ''}`}><Icon size={20} aria-hidden="true" /></span>;

function Checklist({ checks, t, onEdit }) {
  const complete = checks.filter(([, answered]) => answered).length;
  return <details className="pp-checklist">
    <summary><span>{t('profile.checklistTitle')}</span>
      <span className={complete === checks.length ? 'is-done' : ''}>{fmt(t('profile.checklistComplete'), { count: complete, total: checks.length })}</span></summary>
    <ul>{checks.map(([label, answered]) => <li key={label}>
      {answered ? <CheckCircle2 size={16} className="pp-check" aria-hidden="true" /> : <Circle size={16} aria-hidden="true" />}
      {answered ? <span>{label}</span> : <button type="button" onClick={onEdit}>{label}</button>}
    </li>)}</ul>
    <p className="ui-small">{t('profile.checklistHint')}</p>
  </details>;
}

function animalBasicChecks(animal, t) {
  const ageAnswered = animal.ageMonths != null && String(animal.ageMonths).trim() !== '' && Number.isFinite(Number(animal.ageMonths));
  return [
    [t('profile.checklistName'), Boolean(animal.name?.trim())],
    [t('profile.checklistSpecies'), Boolean(animal.species?.trim())],
    [t('profile.checklistBreed'), Boolean(animal.breed?.trim())],
    [t('profile.checklistSex'), Boolean(animal.sex?.trim())],
    [t('profile.checklistAge'), ageAnswered],
    [t('profile.checklistSize'), Boolean(animal.sizeLabel?.trim())],
    [t('profile.checklistPhoto'), Boolean(animal.photoUrls?.[0])],
  ];
}

function useDraftDirty(draft) {
  const initial = useRef('');
  useEffect(() => {
    if (!draft) { initial.current = ''; return; }
    if (!initial.current) initial.current = JSON.stringify(draft);
  }, [draft]);
  return Boolean(draft && initial.current && initial.current !== JSON.stringify(draft));
}

function formatProfileAge(months, t) {
  if (months == null || months === '') return null;
  if (months < 12) return `${months} ${months === 1 ? t('common.month') : t('common.months')}`;
  const years = Math.floor(months / 12);
  return `${years} ${years === 1 ? t('common.year') : t('common.years')}`;
}

function animalLine(animal, t) {
  const breed = animal.breed && animal.breed !== 'Unknown' ? animal.breed : null;
  const sex = animal.sex === 'MALE' ? t('common.male') : animal.sex === 'FEMALE' ? t('common.female') : null;
  return [breed || (animal.species === 'CAT' ? t('common.cat') : t('common.dog')), formatProfileAge(animal.ageMonths, t), sex].filter(Boolean).join(' · ');
}

const roleKey = { OWNER: 'profile.roleOwner', FOSTER_VOLUNTEER: 'profile.roleFosterVolunteer', RESCUER: 'profile.roleRescuer', SHELTER_MEMBER: 'profile.roleShelterMember' };

function ProfileSheet({ draft, t, onChange, onClose, onSave, busy, error }) {
  const dirty = useDraftDirty(draft);
  const { requestClose, discardDialog } = useDiscardGuard({ dirty, busy, onClose });
  return <>
    <FilterSheet open={Boolean(draft)} onClose={requestClose} title={t('profile.editProfileTitle')} footer={<>
      <Button variant="secondary" onClick={requestClose} disabled={busy}>{t('common.cancel')}</Button>
      <Button className="ui-grow" busy={busy} onClick={onSave}>{t('profile.saveChanges')}</Button></>}>
      {draft && <>
        <p className="ui-small">{t('profile.editProfileDesc')}</p>
        <TextField label={t('profile.displayName')} value={draft.displayName} disabled={busy} onChange={event => onChange({ displayName: event.target.value })} />
        <TextField label={t('profile.city')} value={draft.city} disabled={busy} onChange={event => onChange({ city: event.target.value })} />
        <TextField label={t('profile.coarseArea')} value={draft.coarseArea} disabled={busy} onChange={event => onChange({ coarseArea: event.target.value })} />
        {error && <Notice tone="error">{error}</Notice>}
      </>}
    </FilterSheet>
    {discardDialog}
  </>;
}

function AnimalSheet({ draft, t, onChange, onClose, onSave, onDelete, busy, error }) {
  const previewUrl = draft?.photoPreviewUrl || draft?.photoUrls?.[0] || null;
  const localPreview = draft?.photoPreviewUrl;
  useEffect(() => () => { if (localPreview) URL.revokeObjectURL(localPreview); }, [localPreview]);
  const reduced = useReducedPetMotion();
  const dirty = useDraftDirty(draft);
  const { requestClose, discardDialog } = useDiscardGuard({ dirty, busy, onClose });
  const chips = (key, options) => <div className="pp-chips">{options.map(([value, label]) => <button type="button" key={value}
    className="pp-chip" aria-pressed={draft[key] === value} disabled={busy} onClick={() => onChange({ [key]: value })}>{label}</button>)}</div>;
  const modes = [['PLAY', 'matches.play'], ...(draft?.species === 'CAT' ? [] : [['SOCIAL', 'matches.social']])];
  return <>
    <FilterSheet open={Boolean(draft)} onClose={requestClose} title={draft?.id ? t('profile.editAnimalTitle') : t('profile.addAnimal')} footer={<>
      <Button variant="secondary" onClick={requestClose} disabled={busy}>{t('common.cancel')}</Button>
      <Button className="ui-grow" busy={busy} onClick={onSave}>{t('profile.saveChanges')}</Button></>}>
      {draft && <>
        <div className="pp-photo-pick">
          <span className="pp-photo-pick-img">
            {previewUrl ? <motion.img key={previewUrl} initial={reduced ? false : { opacity: 0 }} animate={{ opacity: 1 }} src={previewUrl} alt={draft.name || t('profile.photo')} />
              : <Avatar species={draft.species} size={88} />}
          </span>
          <label className="ui-btn ui-btn-secondary pp-photo-pick-btn">
            <Plus size={18} aria-hidden="true" />{previewUrl ? t('profile.replacePhoto') : t('profile.choosePhoto')}
            <input type="file" accept="image/*" disabled={busy} onChange={event => {
              const file = event.target.files?.[0];
              if (file) onChange({ photoFile: file, photoPreviewUrl: URL.createObjectURL(file) });
            }} />
          </label>
        </div>
        {localPreview && <p className="ui-small">{t('motion.photoPreview')}</p>}
        <TextField label={t('profile.name')} value={draft.name} disabled={busy} onChange={event => onChange({ name: event.target.value })} />
        <fieldset className="pp-fieldset"><legend className="ui-field-label">{t('profile.species')}</legend>
          <Segment label={t('profile.species')} value={draft.species} onChange={species => onChange({ species })}
            options={[['DOG', t('common.dog')], ['CAT', t('common.cat')]]} /></fieldset>
        <div className="pp-breed">
          <TextField label={t('profile.breed')} value={draft.breed === 'Unknown' ? '' : draft.breed} disabled={busy}
            placeholder={draft.breed === 'Unknown' ? t('profile.breedUnknown') : ''} onChange={event => onChange({ breed: event.target.value })} />
          <button type="button" data-testid="breed-unknown" className="pp-chip" aria-pressed={draft.breed === 'Unknown'} disabled={busy}
            onClick={() => onChange({ breed: 'Unknown' })}>{t('profile.breedUnknown')}</button>
        </div>
        <fieldset className="pp-fieldset"><legend className="ui-field-label">{t('profile.sex')}</legend>
          {chips('sex', [['MALE', t('common.male')], ['FEMALE', t('common.female')], ['UNKNOWN', t('common.unknown')]])}</fieldset>
        <TextField label={t('profile.ageMonths')} type="number" inputMode="numeric" min="0" value={draft.ageMonths} disabled={busy}
          onChange={event => onChange({ ageMonths: event.target.value })} />
        <fieldset className="pp-fieldset"><legend className="ui-field-label">{t('profile.size')}</legend>
          {chips('sizeLabel', [['SMALL', t('common.small')], ['MEDIUM', t('common.medium')], ['LARGE', t('common.large')]])}</fieldset>
        <fieldset className="pp-fieldset"><legend className="ui-field-label">{t('profile.matchSettings')}</legend>
          {modes.map(([mode, label]) => <Toggle key={mode} label={t(label)} disabled={busy} value={draft.activeMatchModes?.includes(mode) || false}
            onChange={on => onChange({ activeMatchModes: on ? [...(draft.activeMatchModes || []), mode] : (draft.activeMatchModes || []).filter(value => value !== mode) })} />)}
        </fieldset>
        {error && <Notice tone="error">{error}</Notice>}
        {draft.id && <Button variant="quiet" icon={Trash2} className="pp-danger-link" onClick={onDelete} disabled={busy}>{t('profile.deleteAnimal')}</Button>}
      </>}
    </FilterSheet>
    {discardDialog}
  </>;
}

function DeleteAnimalSheet({ animal, t, onClose, onDelete }) {
  return <FilterSheet open={Boolean(animal)} onClose={onClose} title={t('profile.deleteAnimalTitle')} footer={<>
    <Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
    <Button variant="danger" className="ui-grow" icon={Trash2} onClick={onDelete}>{t('profile.deleteAnimal')}</Button></>}>
    {animal && <p className="ui-lede">{fmt(t('profile.deleteAnimalDesc'), { animalName: animal.name })}</p>}
  </FilterSheet>;
}

function InfoScreen({ title, intro, bullets, note, primary, onBack }) {
  return <Screen title={title} onBack={onBack}>
    <div className="pp-info">
      <p className="ui-lede">{intro}</p>
      <ul>{bullets.map(item => <li key={item}><CheckCircle2 size={18} className="pp-check" aria-hidden="true" /><span>{item}</span></li>)}</ul>
      {note && <p className="ui-small pp-info-note"><Lock size={14} aria-hidden="true" />{note}</p>}
      {primary}
    </div>
  </Screen>;
}

function DeleteAccountScreen({ t, onBack, onDeleted }) {
  const [blockers, setBlockers] = useState(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadSupabaseDeletionBlockers().then(setBlockers).catch((failure) => setError(friendlyError(failure, t)));
  }, [t]);

  const blocked = Boolean(blockers && (blockers.pendingRequests > 0 || blockers.activePlacements > 0));

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      const result = await deleteSupabaseAccount();
      if (result?.deleted === false) {
        setBlockers(result.blockers);
        return;
      }
      await onDeleted();
    } catch (failure) {
      setError(friendlyError(failure, t));
    } finally {
      setBusy(false);
    }
  };

  return <Screen title={t('profile.deleteAccount')} onBack={onBack}
    footer={<Button variant="danger" block busy={busy} disabled={!confirmed || blocked || !blockers} onClick={submit}>{t('profile.deleteAccountAction')}</Button>}>
    <div className="pp-info">
      <p className="ui-lede pp-ink">{t('profile.deleteAccountIntro')}</p>
      <ul className="is-plain">{['deleteAccountBullet1', 'deleteAccountBullet2', 'deleteAccountBullet3'].map(key => <li key={key}><span>{t(`profile.${key}`)}</span></li>)}</ul>
      {blocked && <Notice tone="error"><strong>{t('profile.deleteAccountBlocked')}</strong><br />
        {t('profile.deleteAccountPendingRequests')}: {blockers.pendingRequests} · {t('profile.deleteAccountActivePlacements')}: {blockers.activePlacements}</Notice>}
      {error && <Notice tone="error">{error}</Notice>}
      <label className="ui-check"><input type="checkbox" checked={confirmed} disabled={blocked || busy}
        onChange={(event) => setConfirmed(event.target.checked)} /><span>{t('profile.deleteAccountConfirm')}</span></label>
    </div>
  </Screen>;
}

function formatPaymentAmount(session) {
  const amount = (session.amountCents || 0) / 100;
  return `${amount.toLocaleString(document.documentElement.lang === 'ro' ? 'ro-RO' : 'en-GB', { maximumFractionDigits: 2 })} ${session.currency || 'RON'}`;
}

function formatPaymentDate(value) {
  if (!value) return '';
  return new Date(value).toLocaleDateString(document.documentElement.lang === 'ro' ? 'ro-RO' : 'en-GB', { month: 'short', day: 'numeric' });
}

const paymentStatusKey = { CREATED: 'paymentStatusCreated', PENDING: 'paymentStatusPending', PAID: 'paymentStatusPaid', FAILED: 'paymentStatusFailed', CANCELED: 'paymentStatusCanceled' };

function SupportScreen({ t, onBack, onCreateDonation, paymentSessions = [] }) {
  const [selectedAmount, setSelectedAmount] = useState(2500);
  const [loading, setLoading] = useState(false);
  const amounts = [1000, 2500, 5000, 10000];

  const submitDonation = async () => {
    setLoading(true);
    try {
      const session = await onCreateDonation({ amountCents: selectedAmount, currency: 'RON' });
      const checkoutUrl = session?.checkout_url || session?.checkoutUrl;
      if (checkoutUrl && checkoutUrl.startsWith('http')) {
        window.open(checkoutUrl, '_blank', 'noopener,noreferrer');
      }
      return session;
    } catch { return null; }
    finally {
      setLoading(false);
    }
  };

  return <Screen title={t('profile.supportPetPal')} onBack={onBack}
    footer={<Button block icon={Heart} busy={loading} onClick={submitDonation}>{t('profile.createDonation')} · {selectedAmount / 100} RON</Button>}>
    <div className="pp-info">
      <h2 className="ui-title-l">{t('profile.donationTitle')}</h2>
      <p className="ui-lede">{t('profile.donationIntro')}</p>
      <div className="pp-chips pp-amounts">{amounts.map(amount => <button key={amount} type="button" className="pp-chip" aria-pressed={selectedAmount === amount}
        onClick={() => setSelectedAmount(amount)}>{amount / 100} RON</button>)}</div>
      <ul>{['donationRule1', 'donationRule2', 'donationRule3'].map(key => <li key={key}><CheckCircle2 size={18} className="pp-check" aria-hidden="true" /><span>{t(`profile.${key}`)}</span></li>)}</ul>
      <p className="ui-small pp-info-note"><Lock size={14} aria-hidden="true" />{t('profile.paymentPrivacyNote')}</p>
      <h3 className="ui-overline pp-info-head">{t('profile.paymentHistory')}</h3>
      {paymentSessions.length ? <div className="ui-list">{paymentSessions.map(session => <Row key={session.id} title={formatPaymentAmount(session)}
        subtitle={`${session.provider} · ${formatPaymentDate(session.createdAt)}`}
        trailing={<span className={`pp-status ${session.status === 'PAID' ? 'is-good' : session.status === 'FAILED' ? 'is-bad' : ''}`}>
          {t(`profile.${paymentStatusKey[session.status] || 'paymentStatusCreated'}`)}</span>} />)}</div>
        : <p className="ui-small">{t('profile.noPaymentHistory')}</p>}
    </div>
  </Screen>;
}

function ComfortScreen({ t, onBack, environment, prefs, onToggle, reduceMotion, onReduceMotionToggle, showTypingActivity, onTypingToggle, typingBusy, preferenceError }) {
  const rows = [
    ['push', t('profile.pushNotifications'), t('profile.pushNotificationsDesc')],
    environment === 'foster'
      ? ['foster', t('profile.fosterUpdates'), t('profile.fosterUpdatesDesc')]
      : ['matches', t('profile.matchUpdates'), t('profile.matchUpdatesDesc')],
    ['safety', t('profile.safetyUpdates'), t('profile.safetyUpdatesDesc')],
  ];
  return <Screen title={t('profile.notificationsAndComfort')} onBack={onBack}>
    <div className="pp-info">
      <h3 className="ui-overline pp-info-head">{t('motion.preferences')}</h3>
      <div>
        <Toggle label={t('motion.reduceMotion')} description={t('motion.reduceMotionDescription')} value={reduceMotion} onChange={onReduceMotionToggle} />
        <Toggle label={t('motion.shareTyping')} description={t('motion.shareTypingDescription')} value={showTypingActivity} disabled={typingBusy} onChange={onTypingToggle} />
      </div>
      {preferenceError && <Notice tone="error">{preferenceError}</Notice>}
      <h3 className="ui-overline pp-info-head">{t('profile.notifications')}</h3>
      <p className="ui-small">{t('profile.notificationPreferencesDesc')}</p>
      <div>{rows.map(([key, label, description]) => <Toggle key={key} label={label} description={description} value={Boolean(prefs[key])} onChange={() => onToggle(key)} />)}</div>
      <p className="ui-small">{t('profile.notificationPreferencesNotice')}</p>
    </div>
  </Screen>;
}

export default function ProfileTab({ environment = 'match' }) {
  const {
    t, lang, setLang, user, updateUserProfile, myAnimals, saveAnimalProfile, deleteAnimalProfile, authConfigured, signOut,
    dataSource, paymentSessions, createDonationSession, paymentReturnNotice, clearPaymentReturnNotice,
    activeScreen, screenParams, goBack, setActiveTab, reduceMotion, setReduceMotion, setShowTypingActivity,
  } = useApp();
  const reduced = useReducedPetMotion();
  const isFoster = environment === 'foster';
  const [page, setPage] = useState(null);
  const [notice, setNotice] = useState(null);
  const [sheetError, setSheetError] = useState('');
  const [profileDraft, setProfileDraft] = useState(null);
  const [animalDraft, setAnimalDraft] = useState(null);
  const [deleteDraft, setDeleteDraft] = useState(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingAnimal, setSavingAnimal] = useState(false);
  const [typingBusy, setTypingBusy] = useState(false);
  const [preferenceError, setPreferenceError] = useState('');
  const [notificationPrefs, setNotificationPrefs] = useState({ push: true, matches: true, foster: true, safety: true });
  const say = (text, tone = 'success') => setNotice({ text, tone });

  const blankAnimal = { id: null, name: '', species: 'DOG', breed: '', sex: 'UNKNOWN', ageMonths: '', sizeLabel: 'MEDIUM',
    activeMatchModes: ['PLAY', 'SOCIAL'], photoUrls: [], photoFile: null, photoPreviewUrl: '' };
  const draftFrom = animal => ({ ...blankAnimal, id: animal.id, name: animal.name || '', species: animal.species || 'DOG', breed: animal.breed || '',
    sex: animal.sex || 'UNKNOWN', ageMonths: String(animal.ageMonths ?? ''), sizeLabel: animal.sizeLabel || 'MEDIUM',
    activeMatchModes: animal.activeMatchModes || [], photoUrls: animal.photoUrls || [] });
  const openAnimal = animal => { setSheetError(''); setAnimalDraft(animal ? draftFrom(animal) : { ...blankAnimal }); };

  // Other screens (Match) can ask to create or edit an animal here.
  useEffect(() => {
    if (!activeScreen) return;
    if (activeScreen === 'editAnimal' || activeScreen === 'createAnimal') {
      const animal = myAnimals.find(item => item.id === screenParams?.animalId);
      setSheetError('');
      setAnimalDraft(animal ? draftFrom(animal) : { ...blankAnimal });
    }
    goBack();
  }, [activeScreen, screenParams, myAnimals, goBack]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!paymentReturnNotice) return;
    say(paymentReturnNotice, 'info');
    clearPaymentReturnNotice();
  }, [paymentReturnNotice, clearPaymentReturnNotice]);

  useEffect(() => {
    if (notice?.tone !== 'success') return undefined;
    const timer = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(timer);
  }, [notice]);

  const toggleTypingActivity = async () => {
    if (typingBusy) return;
    setPreferenceError('');
    setTypingBusy(true);
    try { await setShowTypingActivity(user.showTypingActivity === false); }
    catch (error) { setPreferenceError(friendlyError(error, t, t('motion.preferenceError'))); }
    finally { setTypingBusy(false); }
  };

  const exportProfileData = async () => {
    let serverData = null;
    if (dataSource === 'supabase') {
      try { serverData = await exportSupabaseData(); }
      catch (error) { say(friendlyError(error, t), 'error'); return; }
    }
    const exportPayload = serverData ? { ...serverData, language: lang, notificationPreferences: notificationPrefs } : {
      exportedAt: new Date().toISOString(), language: lang,
      account: { id: user.id, displayName: user.displayName, city: user.city, coarseArea: user.coarseArea, roles: user.roles },
      animals: myAnimals, notificationPreferences: notificationPrefs, privacy: { exactLocationPublic: false },
    };
    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `petpal-data-export-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    say(t('profile.dataExportReady'));
  };

  const createDonation = async ({ amountCents, currency }) => {
    try {
      const session = await createDonationSession({ amountCents, currency });
      say(t('profile.donationSessionCreated'));
      return session;
    } catch (error) {
      say(friendlyError(error, t, t('profile.donationSessionFailed')), 'error');
      throw error;
    }
  };

  const saveProfileDraft = async () => {
    if (!profileDraft || savingProfile) return;
    setSavingProfile(true); setSheetError('');
    try {
      await updateUserProfile(profileDraft);
      setProfileDraft(null);
      say(t('profile.profileSaved'));
    } catch (error) {
      setSheetError(friendlyError(error, t, t('profile.profileSaveFailed')));
    } finally {
      setSavingProfile(false);
    }
  };

  const saveAnimalDraft = async () => {
    if (!animalDraft || savingAnimal) return;
    setSavingAnimal(true); setSheetError('');
    const normalizedAge = Number.parseInt(animalDraft.ageMonths, 10);
    const existingAnimal = myAnimals.find((animal) => animal.id === animalDraft.id);
    const nextAnimal = {
      ...(existingAnimal || {}),
      id: animalDraft.id,
      name: animalDraft.name.trim() || existingAnimal?.name || t('profile.newAnimalFallbackName'),
      species: animalDraft.species,
      breed: animalDraft.breed.trim() || existingAnimal?.breed || '',
      isMixedBreed: existingAnimal?.isMixedBreed || false,
      sex: animalDraft.sex,
      ageMonths: Number.isNaN(normalizedAge) ? existingAnimal?.ageMonths ?? null : Math.max(0, normalizedAge),
      sizeLabel: animalDraft.sizeLabel,
      weightKg: existingAnimal?.weightKg ?? null,
      sterilizedStatus: existingAnimal?.sterilizedStatus || 'UNKNOWN',
      vaccineStatus: existingAnimal?.vaccineStatus || 'UNKNOWN',
      temperamentTags: existingAnimal?.temperamentTags || [],
      energyLevel: existingAnimal?.energyLevel || 'MEDIUM',
      goodWithDogs: existingAnimal?.goodWithDogs ?? null,
      goodWithCats: existingAnimal?.goodWithCats ?? null,
      goodWithChildren: existingAnimal?.goodWithChildren ?? null,
      city: existingAnimal?.city || user.city || '',
      coarseArea: existingAnimal?.coarseArea || user.coarseArea || '',
      photoUrls: existingAnimal?.photoUrls || [],
      photoFile: animalDraft.photoFile || null,
      photoPreviewUrl: animalDraft.photoPreviewUrl || '',
      // Social walks are for dogs only.
      activeMatchModes: (animalDraft.activeMatchModes || ['PLAY', 'SOCIAL'])
        .filter((mode) => animalDraft.species !== 'CAT' || mode !== 'SOCIAL'),
      profileCompleteness: existingAnimal?.profileCompleteness || 0,
      verificationStatus: existingAnimal?.verificationStatus || 'UNVERIFIED',
      healthDocumentStatus: existingAnimal?.healthDocumentStatus || 'UNVERIFIED',
      adminMateApprovalStatus: existingAnimal?.adminMateApprovalStatus || 'UNVERIFIED',
    };
    try {
      await saveAnimalProfile(nextAnimal);
      setAnimalDraft(null);
      say(t('profile.animalSaved'));
    } catch (error) {
      setSheetError(friendlyError(error, t, t('profile.animalSaveFailed')));
    } finally {
      setSavingAnimal(false);
    }
  };

  const confirmDeleteAnimal = async () => {
    if (!deleteDraft) return;
    try {
      await deleteAnimalProfile(deleteDraft.id);
      say(fmt(t('profile.animalDeleted'), { animalName: deleteDraft.name }));
      setDeleteDraft(null);
    } catch (error) {
      setDeleteDraft(null);
      say(friendlyError(error, t, t('profile.animalDeleteFailed')), 'error');
    }
  };

  const topic = (key, count = 4) => ({
    intro: t(`profile.${key}Intro`),
    bullets: Array.from({ length: count }, (_, index) => t(`profile.${key}Bullet${index + 1}`)),
    note: t(`profile.${key}Note`),
  });
  const helpTopics = [
    ['howItWorks', isFoster ? t('profile.howFosterWorks') : t('profile.howMatchingWorks'), isFoster ? 'fosterHelp' : 'matchingHelp', isFoster ? Home : Heart],
    ['safety', t('profile.safetyRules'), 'safetyRules', Shield],
    ['termsSafety', t('profile.termsAndSafety'), 'termsSafety', HelpCircle],
    ['terms', t('profile.terms'), 'terms', HelpCircle],
    ['privacy', t('profile.privacyPolicy'), 'privacyPolicy', Lock],
    ['welfare', t('profile.animalWelfare'), 'animalWelfare', Heart],
  ];
  const openTopic = helpTopics.find(([key]) => key === page);
  const back = () => setPage(value => (helpTopics.some(([key]) => key === value) ? 'help' : null));
  const roles = (user.roles || []).map(role => (roleKey[role] ? t(roleKey[role]) : role)).join(' · ');

  let screen = null;
  if (page === 'help') {
    screen = <Screen key="help" title={t('profile.help')} onBack={back}>
      <div className="ui-list pp-screen-list">{helpTopics.map(([key, label, , Icon]) => <Row key={key} leading={icon(Icon)} title={label} onClick={() => setPage(key)} />)}</div>
    </Screen>;
  } else if (openTopic) {
    screen = <InfoScreen key={page} title={openTopic[1]} {...topic(openTopic[2])} onBack={back} />;
  } else if (page === 'dataExport') {
    screen = <InfoScreen key="export" title={t('profile.dataExport')} {...topic('dataExport', 3)} onBack={back}
      primary={<Button block icon={Download} onClick={exportProfileData}>{t('profile.downloadDataExport')}</Button>} />;
  } else if (page === 'comfort') {
    screen = <ComfortScreen key="comfort" t={t} onBack={back} environment={environment} prefs={notificationPrefs}
      onToggle={key => setNotificationPrefs(current => ({ ...current, [key]: !current[key] }))}
      reduceMotion={reduceMotion} onReduceMotionToggle={() => { setPreferenceError(''); setReduceMotion(!reduceMotion); }}
      showTypingActivity={user.showTypingActivity !== false} onTypingToggle={toggleTypingActivity} typingBusy={typingBusy} preferenceError={preferenceError} />;
  } else if (page === 'support') {
    screen = <SupportScreen key="support" t={t} onBack={back} onCreateDonation={createDonation} paymentSessions={paymentSessions} />;
  } else if (page === 'deleteAccount') {
    screen = <DeleteAccountScreen key="delete" t={t} onBack={back} onDeleted={signOut} />;
  }

  return <div data-testid="profile-tab" className="pp-profile ui-page">
    <div className="ui-scroll">
      <PageTitle title={t('profile.title')} />
      <AnimatePresence>{notice && <div className="ui-gutter"><Notice tone={notice.tone} onClose={() => setNotice(null)}>{notice.text}</Notice></div>}</AnimatePresence>

      <motion.div variants={list} initial={reduced ? false : 'hidden'} animate="show">
        <motion.section variants={listItem} className="pp-identity ui-gutter">
          <span className="pp-initial" aria-hidden="true">{(user.displayName || '?').trim().charAt(0).toUpperCase()}</span>
          <div className="ui-grow">
            <h2 className="ui-title-l">{user.displayName}</h2>
            <p className="ui-small">{[user.coarseArea, user.city].filter(Boolean).join(', ')}{roles && ` · ${roles}`}</p>
            <Button variant="quiet" className="pp-edit" onClick={() => { setSheetError(''); setProfileDraft({ displayName: user.displayName || '', city: user.city || '', coarseArea: user.coarseArea || '' }); }}>
              {t('profile.editProfile')}</Button>
          </div>
        </motion.section>
        <motion.div variants={listItem} className="ui-gutter">
          <Checklist t={t} onEdit={() => setProfileDraft({ displayName: user.displayName || '', city: user.city || '', coarseArea: user.coarseArea || '' })}
            checks={[[t('profile.checklistName'), Boolean(user.displayName?.trim())], [t('profile.checklistCity'), Boolean(user.city?.trim())]]} />
        </motion.div>

        {!isFoster && <motion.div variants={listItem}><Section title={t('profile.myAnimals')}
          action={<Button variant="quiet" icon={Plus} onClick={() => openAnimal(null)}>{t('profile.addAnimal')}</Button>}>
          {myAnimals.length ? <div className="ui-list ui-list-inset">{myAnimals.map(animal => {
            const checks = animalBasicChecks(animal, t);
            const done = checks.filter(([, answered]) => answered).length;
            return <Row key={animal.id} data-testid={`animal-card-${animal.id}`} onClick={() => openAnimal(animal)}
              leading={<Avatar src={animal.photoUrls?.[0]} name={animal.name} species={animal.species} size={56} />}
              title={animal.name} subtitle={animalLine(animal, t)}
              meta={done < checks.length ? fmt(t('profile.checklistComplete'), { count: done, total: checks.length }) : undefined} />;
          })}</div>
            : <button type="button" className="pp-add-first" onClick={() => openAnimal(null)}>
              <span className="ui-title-s">{t('profile.noAnimals')}</span><span className="ui-small">{t('profile.noAnimalsDesc')}</span></button>}
        </Section></motion.div>}

        {isFoster && <motion.div variants={listItem}><Section title={t('environment.fosterTitle')}>
          <div className="ui-list"><Row leading={icon(Home)} title={t('fx.myHome')} onClick={() => setActiveTab('foster-mine')} /></div>
        </Section></motion.div>}

        <motion.div variants={listItem}><Section title={t('profile.account')}>
          <div className="ui-list pp-list">
            <div className="ui-row" data-testid="language-toggle">
              <span className="ui-row-lead">{icon(Languages)}</span>
              <span className="ui-row-body"><span className="ui-row-title">{t('profile.language')}</span></span>
              <Segment label={t('profile.language')} value={lang} onChange={setLang} options={[['ro', 'RO'], ['en', 'EN']]} className="pp-lang" />
            </div>
            <Row leading={icon(Bell)} title={t('profile.notificationsAndComfort')} onClick={() => setPage('comfort')} />
            <Row leading={icon(Download)} title={t('profile.dataExport')} onClick={() => setPage('dataExport')} />
            {authConfigured && <Row leading={icon(LogOut)} title={t('profile.signOut')} onClick={signOut} />}
          </div>
        </Section></motion.div>

        <motion.div variants={listItem}><Section title={t('profile.help')}>
          <div className="ui-list pp-list">
            <Row leading={icon(Shield)} title={t('profile.helpAndRules')} subtitle={t('profile.helpAndRulesDesc')} onClick={() => setPage('help')} />
            <Row leading={icon(Heart)} title={t('profile.supportPetPal')} onClick={() => setPage('support')} />
          </div>
        </Section></motion.div>

        <div className="ui-gutter pp-admin"><PlatformAdminEntry /></div>

        <motion.div variants={listItem}><Section>
          <div className="ui-list pp-list">
            <Row leading={icon(Trash2, true)} title={t('profile.deleteAccount')} className="pp-row-danger" onClick={() => (
              dataSource === 'supabase' ? setPage('deleteAccount') : say(t('profile.deleteAccountNotice'), 'info'))} />
          </div>
        </Section></motion.div>
        <p className="pp-version" aria-label={t('profile.appVersion')}>PetPal 1.0.0</p>
      </motion.div>
    </div>

    <AnimatePresence>{screen}</AnimatePresence>
    <ProfileSheet draft={profileDraft} t={t} busy={savingProfile} error={sheetError}
      onChange={patch => setProfileDraft(current => ({ ...current, ...patch }))} onClose={() => setProfileDraft(null)} onSave={saveProfileDraft} />
    <AnimalSheet draft={animalDraft} t={t} busy={savingAnimal} error={sheetError}
      onChange={patch => setAnimalDraft(current => ({ ...current, ...patch }))} onClose={() => setAnimalDraft(null)} onSave={saveAnimalDraft}
      onDelete={() => { const animal = myAnimals.find(item => item.id === animalDraft.id); setAnimalDraft(null); setDeleteDraft(animal || null); }} />
    <DeleteAnimalSheet animal={deleteDraft} t={t} onClose={() => setDeleteDraft(null)} onDelete={confirmDeleteAnimal} />
  </div>;
}
