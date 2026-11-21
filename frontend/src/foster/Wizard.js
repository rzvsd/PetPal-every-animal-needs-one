import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Camera, Cat, Dog, Minus, Plus } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { friendlyError } from '../services/errors';
import { fosterRpc } from '../services/fosterApi';
import { animalPhotoUrl, uploadSupabaseAnimalPhotoPath } from '../services/supabaseApi';
import { prepareImageForUpload } from '../services/imageUpload';
import { motionSpring, useReducedPetMotion } from '../components/Motion';
import { useDiscardGuard } from '../components/FormGuard';
import { Button, Card, Choices, Field, Notice, Photo, Screen, fmt } from './ui';
import { durationLabel, traitAnswers, traitKeys, traitQuestion } from './Find';

export function Toggle({ label, description, value, onChange, disabled = false }) {
  const reduced = useReducedPetMotion();
  return <button type="button" className="fx-toggle" aria-pressed={value} disabled={disabled} onClick={() => onChange(!value)}>
    <span className="fx-toggle-text"><span>{label}</span>{description && <small>{description}</small>}</span>
    <span className="fx-switch" aria-hidden="true"><motion.span animate={{ x: value ? 20 : 0 }} transition={reduced ? { duration: 0 } : motionSpring} /></span>
  </button>;
}

export function PhotoPicker({ value, itemId, onChange }) {
  const { t, user } = useApp();
  const [preview, setPreview] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pick = async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024) { setError('JPEG, PNG, WebP · max 10 MB'); return; }
    setPreview(URL.createObjectURL(file)); setBusy(true); setError('');
    try { onChange(await uploadSupabaseAnimalPhotoPath({ ownerId: user.id, animalId: itemId, file: await prepareImageForUpload(file) })); }
    catch (failure) { setError(friendlyError(failure, t)); setPreview(''); }
    finally { setBusy(false); }
  };
  const shown = preview || animalPhotoUrl(value);
  return <div className="fx-stack" style={{ gap: 8 }}>
    <label className="fx-photo-picker">
      {shown ? <img src={shown} alt="" /> : <><Camera size={30} /><span>{t('fx.addPhoto')}</span></>}
      {shown && <span className="fx-badge">{busy ? t('fx.loading') : t('fx.changePhoto')}</span>}
      <input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={pick} aria-label={t('fx.addPhoto')} />
    </label>
    {error && <Notice tone="error">{error}</Notice>}
  </div>;
}

// Step-by-step form: one question per screen, a progress bar and one button.
function Wizard({ title, steps, step, setStep, canNext, missing, onFinish, finishLabel, busy, error, dirty, onClose }) {
  const { t } = useApp();
  const reduced = useReducedPetMotion();
  const [direction, setDirection] = useState(1);
  const { requestClose, discardDialog } = useDiscardGuard({ dirty, busy, onClose });
  const go = delta => { setDirection(delta); setStep(step + delta); };
  const last = step === steps.length - 1;
  return <Screen title={title} onBack={step ? () => go(-1) : requestClose}
    footer={<>{!canNext && missing && <p className="fx-hint" role="status" style={{ marginBottom: 8 }}>{missing}</p>}<div className="fx-actions" style={{ marginTop: 0 }}>
      {step > 0 && <Button variant="secondary" onClick={() => go(-1)} style={{ flex: '0 0 auto' }}>{t('fx.wizardBack')}</Button>}
      <Button disabled={!canNext || busy} onClick={() => (last ? onFinish() : go(1))}>{busy ? t('fx.loading') : last ? finishLabel : t('fx.wizardNext')}</Button>
    </div></>}>
    <div className="fx-stack" style={{ gap: 8, marginTop: 4 }}>
      <p className="fx-muted">{fmt(t('fx.stepOf'), { step: step + 1, total: steps.length })}</p>
      <div className="fx-progress"><motion.div animate={{ scaleX: (step + 1) / steps.length }} transition={reduced ? { duration: 0 } : motionSpring} /></div>
    </div>
    <AnimatePresence mode="wait" initial={false} custom={direction}>
      <motion.div key={step} className="fx-wizard-step" custom={direction}
        initial={reduced ? { opacity: 0 } : { opacity: 0, x: direction * 40 }} animate={{ opacity: 1, x: 0 }}
        exit={reduced ? { opacity: 0 } : { opacity: 0, x: direction * -40 }} transition={reduced ? { duration: 0.1 } : motionSpring}>
        {steps[step]}
      </motion.div>
    </AnimatePresence>
    {error && <Notice tone="error">{error}</Notice>}
    {discardDialog}
  </Screen>;
}

const ageMonths = { YOUNG: 6, ADULT: 36, SENIOR: 120 };
const ageGroup = months => (months == null || months === '' ? '' : months < 12 ? 'YOUNG' : months >= 96 ? 'SENIOR' : 'ADULT');

// The case fields save_foster_case expects, from a directory row.
export function caseToData(item) {
  return { name: item.name || '', species: item.species || 'DOG', description: item.description || '', city: item.city || '',
    area: item.area || '', photo: item.photo || '', breed: item.breed || '', ageMonths: item.age_months ?? '', size: item.size_label || 'MEDIUM',
    urgency: item.urgency || 'MEDIUM', duration: item.duration || 'UNKNOWN', foodCovered: Boolean(item.food_covered),
    vetCovered: Boolean(item.vet_covered), transport: Boolean(item.transport_available), medicalNeeds: item.medical_needs || '',
    homeFit: item.home_fit || '', status: ['ACTIVE', 'PAUSED', 'ARCHIVED'].includes(item.status) ? item.status : 'PAUSED',
    organizationId: item.organization_id || '', expectedUpdatedAt: item.updated_at || null,
    traits: Object.fromEntries(traitKeys.map(key => [key, item.care_traits?.[key] || 'UNKNOWN'])) };
}

export function CaseWizard({ item, transfer, organizations = [], onClose, onSaved }) {
  const { t, user } = useApp();
  const [caseId] = useState(() => item?.id || crypto.randomUUID());
  const [animalId] = useState(() => item?.animal_id || transfer?.animal_id || crypto.randomUUID());
  const [data, setData] = useState(() => (item ? caseToData(item) : { ...caseToData({ care_traits: transfer?.care_traits, age_months: transfer?.age_months, size_label: transfer?.size_label, breed: transfer?.breed }), name: transfer?.name || '', species: transfer?.species || 'DOG',
    photo: transfer?.photo || '', city: user.city || '', status: 'ACTIVE' }));
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [dirty, setDirty] = useState(false);
  const field = (key, value) => { setDirty(true); setData(current => ({ ...current, [key]: value })); };
  const locked = Boolean(item || transfer);
  const name = data.name.trim() || t('fx.animalName');

  const steps = [
    <><h2>{t('fx.caseStep1')}</h2>
      {transfer && <Notice>{t('care.transferHint')}</Notice>}
      <PhotoPicker value={data.photo} itemId={animalId} onChange={value => field('photo', value)} />
      <Field label={t('fx.animalName')}><input className="fx-input" maxLength={80} value={data.name} onChange={event => field('name', event.target.value)} /></Field>
      {!locked && <Choices label={t('care.species')} value={data.species} onChange={value => field('species', value)} columns={2}
        options={[['DOG', t('fx.dog'), Dog], ['CAT', t('fx.cat'), Cat]]} />}</>,
    <><h2>{fmt(t('fx.caseStep2'), { name })}</h2>
      <Field label={t('fx.description')} hint={t('fx.descriptionHint')}>
        <textarea className="fx-input" maxLength={4000} value={data.description} onChange={event => field('description', event.target.value)} /></Field>
      <Field label={t('fx.age')}><Choices label={t('fx.age')} value={ageGroup(data.ageMonths)} columns={3} onChange={value => field('ageMonths', ageMonths[value])}
        options={[['YOUNG', t('fx.young')], ['ADULT', t('fx.adult')], ['SENIOR', t('fx.senior')]]} /></Field>
      <Field label={t('fx.size')}><Choices label={t('fx.size')} value={data.size} columns={3} onChange={value => field('size', value)}
        options={[['SMALL', t('fx.small')], ['MEDIUM', t('fx.medium')], ['LARGE', t('fx.large')]]} /></Field>
      <Field label={t('fx.city')}><input className="fx-input" maxLength={100} value={data.city} onChange={event => field('city', event.target.value)} /></Field>
      <Field label={t('fx.area')}><input className="fx-input" maxLength={100} value={data.area} onChange={event => field('area', event.target.value)} /></Field></>,
    <><h2>{fmt(t('fx.caseStepTraits'), { name })}</h2>
      <p className="fx-muted">{t('fx.caseStepTraitsHint')}</p>
      {traitKeys.map(key => <Field key={key} label={traitQuestion(key, t)}><Choices label={traitQuestion(key, t)} value={data.traits[key]} columns={3}
        onChange={value => field('traits', { ...data.traits, [key]: value })} options={traitAnswers(t)} /></Field>)}</>,
    <><h2>{t('fx.caseStep3')}</h2>
      <Field label={t('fx.howLong')}><Choices label={t('fx.howLong')} value={data.duration} columns={2} onChange={value => field('duration', value)}
        options={['FEW_DAYS', 'ONE_TWO_WEEKS', 'ONE_MONTH', 'UNTIL_ADOPTION', 'UNKNOWN'].map(value => [value, durationLabel(value, t)])} /></Field>
      <Field label={t('fx.howUrgent')}><Choices label={t('fx.howUrgent')} value={data.urgency} columns={3} onChange={value => field('urgency', value)}
        options={[['LOW', t('fx.urgencyLow')], ['MEDIUM', t('fx.urgencyMedium')], ['HIGH', t('fx.urgencyHigh')]]} /></Field></>,
    <><h2>{t('fx.caseStep4')}</h2>
      <Toggle label={t('fx.food')} value={data.foodCovered} onChange={value => field('foodCovered', value)} />
      <Toggle label={t('fx.vet')} value={data.vetCovered} onChange={value => field('vetCovered', value)} />
      <Toggle label={t('fx.transport')} value={data.transport} onChange={value => field('transport', value)} />
      <Field label={t('fx.medicalOptional')}><textarea className="fx-input" maxLength={2000} value={data.medicalNeeds} onChange={event => field('medicalNeeds', event.target.value)} /></Field></>,
    <><h2>{t('fx.caseStep5')}</h2>
      <Card className="fx-animal" style={{ maxWidth: 220, margin: '0 auto' }}>
        <Photo src={data.photo} name={data.name} species={data.species} />
        <div className="fx-animal-info"><h3>{data.name}</h3><p>{durationLabel(data.duration, t)} · {data.area || data.city}</p></div>
      </Card>
      {organizations.length > 0 && <Field label={t('care.organization')}><Choices label={t('care.organization')} value={data.organizationId}
        onChange={value => field('organizationId', value)} options={[['', t('care.individual')], ...organizations.map(org => [org.organization_id, org.organizations?.name || org.organization_id])]} /></Field>}
      <Toggle label={t('fx.visibleToHomes')} value={data.status === 'ACTIVE'} onChange={value => field('status', value ? 'ACTIVE' : 'PAUSED')} />
      <p className="fx-muted">{t('fx.notInPetPal')}</p></>,
  ];
  const canNext = [data.name.trim().length > 0, data.description.trim().length > 0 && data.city.trim().length > 0, true, true, true, true][step];
  const missing = step === 0 ? t('fx.missingAnimalName')
    : step === 1 ? [!data.description.trim() && t('fx.missingDescription'), !data.city.trim() && t('fx.missingCity')].filter(Boolean).join(', ') : '';
  const finish = async () => {
    setBusy(true); setError('');
    const { traits, ...payload } = data;
    try {
      await fosterRpc('save_foster_case', { case_id_input: caseId, animal_id_input: animalId, data_input: payload });
      await fosterRpc('save_animal_care_traits', { animal_id_input: animalId, traits_input: traits });
      onSaved(caseId);
    }
    catch (failure) { setError(friendlyError(failure, t)); }
    finally { setBusy(false); }
  };
  return <Wizard title={item ? t('fx.edit') : t('fx.postAnimal')} steps={steps} step={step} setStep={setStep} canNext={canNext}
    missing={missing && fmt(t('fx.stillMissing'), { what: missing })}
    onFinish={finish} finishLabel={item ? t('fx.saveChanges') : t('fx.publish')} busy={busy} error={error} dirty={dirty} onClose={onClose} />;
}

const housingOptions = t => [['FLAT', t('fx.housingFlat')], ['HOUSE', t('fx.housingHouse')], ['GARDEN', t('fx.housingGarden')]];

export function HomeWizard({ home, onClose, onSaved }) {
  const { t, user } = useApp();
  const [homeId] = useState(() => home?.id || crypto.randomUUID());
  const firstName = (user.displayName || '').split(' ')[0];
  const housingMatch = home ? housingOptions(t).find(([, label]) => label === home.housing_type)?.[0] : 'FLAT';
  const [data, setData] = useState(() => ({ name: home?.name || fmt(t('fx.homeNameDefault'), { name: firstName }), city: home?.city || user.city || '',
    area: home?.area || user.coarseArea || '', capacity: home?.capacity || 1, dogCapacity: home?.dog_capacity ?? '', catCapacity: home?.cat_capacity ?? '',
    availability: home?.availability || 'AVAILABLE', published: home ? home.published : true, species: home?.species || ['DOG', 'CAT'],
    bio: home?.bio || '', housing: housingMatch || '', housingType: home?.housing_type || '', experience: home?.experience || '',
    website: home?.website || '', photos: home?.photos || [], expectedUpdatedAt: home?.updated_at || null }));
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [dirty, setDirty] = useState(false);
  const field = (key, value) => { setDirty(true); setData(current => ({ ...current, [key]: value })); };
  const steps = [
    <><h2>{t('fx.homeStep1')}</h2>
      <Field label={t('fx.homeName')}><input className="fx-input" maxLength={100} value={data.name} onChange={event => field('name', event.target.value)} /></Field>
      <Field label={t('fx.city')}><input className="fx-input" maxLength={100} value={data.city} onChange={event => field('city', event.target.value)} /></Field>
      <Field label={t('fx.area')}><input className="fx-input" maxLength={100} value={data.area} onChange={event => field('area', event.target.value)} /></Field></>,
    <><h2>{t('fx.homeStep2')}</h2>
      <Choices label={t('care.species')} multiple value={data.species} onChange={value => field('species', value)} columns={2}
        options={[['DOG', t('fx.dogs'), Dog], ['CAT', t('fx.cats'), Cat]]} />
      <Field label={t('fx.howMany')}>
        <div className="fx-stepper">
          <Button variant="secondary" aria-label="-" icon={Minus} disabled={data.capacity <= 1} onClick={() => field('capacity', Math.max(1, data.capacity - 1))} style={{ width: 56 }} />
          <output aria-live="polite">{data.capacity}</output>
          <Button variant="secondary" aria-label="+" icon={Plus} disabled={data.capacity >= 20} onClick={() => field('capacity', Math.min(20, data.capacity + 1))} style={{ width: 56 }} />
        </div>
      </Field>
      <Field label={t('fx.availability')}><Choices label={t('fx.availability')} value={data.availability} columns={3} onChange={value => field('availability', value)}
        options={[['AVAILABLE', t('fx.availableYes')], ['LIMITED', t('fx.availableLimited')], ['UNAVAILABLE', t('fx.availableNo')]]} /></Field></>,
    <><h2>{t('fx.homeStep3')}</h2>
      <PhotoPicker value={data.photos[0]} itemId={homeId} onChange={value => field('photos', [value, ...data.photos.slice(1)])} />
      <Choices label={t('care.housing')} value={data.housing} columns={3} onChange={value => { field('housing', value); field('housingType', housingOptions(t).find(([key]) => key === value)[1]); }}
        options={housingOptions(t)} />
      <Field label={t('fx.experience')}><textarea className="fx-input" maxLength={2000} value={data.experience} onChange={event => field('experience', event.target.value)} /></Field>
      <Field label={t('fx.bio')}><textarea className="fx-input" maxLength={4000} value={data.bio} onChange={event => field('bio', event.target.value)} /></Field>
      <Field label={t('fx.website')} hint={t('fx.websiteHint')}><input className="fx-input" type="url" inputMode="url" autoCapitalize="off" autoCorrect="off" spellCheck={false}
        maxLength={200} placeholder="casalabute.ro" value={data.website} onChange={event => field('website', event.target.value)} /></Field>
      <Toggle label={t('fx.showHome')} value={data.published} onChange={value => field('published', value)} />
      <p className="fx-muted">{t('fx.notInPetPal')}</p></>,
  ];
  const canNext = [data.name.trim() && data.city.trim(), data.species.length > 0, true][step];
  const missing = step === 0 ? [!data.name.trim() && t('fx.homeName').toLowerCase(), !data.city.trim() && t('fx.missingCity')].filter(Boolean).join(', ')
    : step === 1 ? t('fx.missingSpecies') : '';
  const finish = async () => {
    setBusy(true); setError('');
    const { housing, ...payload } = data;
    try { await fosterRpc('save_foster_home', { home_id_input: homeId, data_input: payload }); onSaved(homeId); }
    catch (failure) { setError(friendlyError(failure, t)); }
    finally { setBusy(false); }
  };
  return <Wizard title={home ? t('fx.edit') : t('fx.setUpHome')} steps={steps} step={step} setStep={setStep} canNext={Boolean(canNext)}
    missing={missing && fmt(t('fx.stillMissing'), { what: missing })}
    onFinish={finish} finishLabel={home ? t('fx.saveChanges') : t('fx.saveHome')} busy={busy} error={error} dirty={dirty} onClose={onClose} />;
}
