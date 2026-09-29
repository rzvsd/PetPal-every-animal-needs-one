import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { fosterRpc, loadFosterDirectory, reportFosterItem } from '../services/fosterApi';
import { FosterCheck, FosterField, FosterForm, FosterInfo, FosterPager, FosterPhotoField, FosterSelect } from './FosterComponents';

export function FosterHomeForm({ home, onClose, onSaved }) {
  const { t, user } = useApp();
  const [id] = useState(() => home?.id || crypto.randomUUID());
  const [data, setData] = useState(() => ({ name: home?.name || '', city: home?.city || user.city || '', area: home?.area || '',
    capacity: home?.capacity ?? 1, dogCapacity: home?.dog_capacity ?? '', catCapacity: home?.cat_capacity ?? '',
    availability: home?.availability || 'LIMITED', published: home?.published || false, species: home?.species || ['DOG', 'CAT'],
    bio: home?.bio || '', housingType: home?.housing_type || '', experience: home?.experience || '', photos: home?.photos || [],
    expectedUpdatedAt: home?.updated_at || null }));
  const field = (key, value) => setData(current => ({ ...current, [key]: value }));
  return <FosterForm values={data} title={t(home ? 'care.editHome' : 'care.addHome')} onClose={onClose} onSaved={onSaved}
    onSave={() => fosterRpc('save_foster_home', { home_id_input: id, data_input: data })}>
    <FosterField label={t('care.name')} required maxLength={100} value={data.name} onChange={e => field('name', e.target.value)} />
    <FosterField label={t('care.city')} required maxLength={100} value={data.city} onChange={e => field('city', e.target.value)} />
    <FosterField label={t('care.area')} maxLength={100} value={data.area} onChange={e => field('area', e.target.value)} />
    <FosterField label={t('care.capacity')} type="number" min="0" max="2147483647" step="1" required value={data.capacity} onChange={e => field('capacity', e.target.value)} />
    <div className="foster-grid">{[['dogCapacity', 'dogCapacity'], ['catCapacity', 'catCapacity']].map(([key, label]) =>
      <FosterField key={key} label={t(`care.${label}`)} type="number" min="0" max="2147483647" step="1" value={data[key]} onChange={e => field(key, e.target.value)} />)}</div>
    <FosterInfo title={t('care.capacity')}>{t('care.capacityInfo')}</FosterInfo>
    <FosterSelect label={t('care.availability')} value={data.availability} onChange={v => field('availability', v)} options={['AVAILABLE', 'LIMITED', 'UNAVAILABLE'].map(v => [v, t(`care.${v}`)])} />
    <div className="foster-row">{['DOG', 'CAT'].map(species => <FosterCheck key={species} label={t(species === 'DOG' ? 'care.dogs' : 'care.cats')}
      checked={data.species.includes(species)} onChange={checked => field('species', checked ? [...data.species, species] : data.species.filter(v => v !== species))} />)}</div>
    <FosterField label={t('care.housing')} maxLength={200} value={data.housingType} onChange={e => field('housingType', e.target.value)} />
    <FosterField label={t('care.experience')}><textarea maxLength={2000} value={data.experience} onChange={e => field('experience', e.target.value)} /></FosterField>
    <FosterField label={t('care.bio')}><textarea maxLength={4000} value={data.bio} onChange={e => field('bio', e.target.value)} /></FosterField>
    <FosterPhotoField itemId={id} value={data.photos[0]} onChange={photo => field('photos', [photo, ...data.photos.slice(1)])} />
    <FosterCheck label={t('care.published')} checked={data.published} onChange={v => field('published', v)} />
    <p className="foster-muted">{t('care.boundary')}</p>
  </FosterForm>;
}

export function FosterCaseForm({ item, transfer, organizations = [], onClose, onSaved }) {
  const { t, user } = useApp();
  const [id] = useState(() => item?.id || crypto.randomUUID());
  const [animalId] = useState(() => item?.animal_id || transfer?.animal_id || crypto.randomUUID());
  const [data, setData] = useState(() => ({ name: item?.name || transfer?.name || '', species: item?.species || transfer?.species || 'DOG',
    description: item?.description || '', city: item?.city || user.city || '', area: item?.area || '', photo: item?.photo || transfer?.photo || '',
    breed: item?.breed || '', ageMonths: item?.age_months ?? '', size: item?.size_label || 'MEDIUM',
    urgency: item?.urgency || 'MEDIUM', duration: item?.duration || 'UNKNOWN', foodCovered: item?.food_covered || false,
    vetCovered: item?.vet_covered || false, transport: item?.transport_available || false, medicalNeeds: item?.medical_needs || '',
    homeFit: item?.home_fit || '', status: item ? (['ACTIVE', 'PAUSED', 'ARCHIVED'].includes(item.status) ? item.status : 'PAUSED') : 'ACTIVE', organizationId: item?.organization_id || '', expectedUpdatedAt: item?.updated_at || null }));
  const field = (key, value) => setData(current => ({ ...current, [key]: value }));
  return <FosterForm values={data} title={t(item ? 'care.editCase' : 'care.postCase')} onClose={onClose} onSaved={onSaved}
    onSave={() => fosterRpc('save_foster_case', { case_id_input: id, animal_id_input: animalId, data_input: data })}>
    {transfer && <p className="foster-alert">{t('care.transferHint')}</p>}
    <FosterField label={t('care.animalName')} required maxLength={80} value={data.name} onChange={e => field('name', e.target.value)} />
    <FosterSelect label={t('care.species')} disabled={Boolean(item || transfer)} value={data.species} onChange={v => field('species', v)} options={['DOG', 'CAT'].map(v => [v, t(v === 'DOG' ? 'care.dogs' : 'care.cats')])} />
    <FosterField label={t('care.description')}><textarea required maxLength={4000} value={data.description} onChange={e => field('description', e.target.value)} /></FosterField>
    <FosterSelect label={t('care.organization')} value={data.organizationId} onChange={v => field('organizationId', v)} empty={t('care.individual')}
      options={organizations.map(org => [org.organization_id, org.organizations?.name || org.organization_id])} />
    <div className="foster-grid"><FosterField label={t('care.city')} required maxLength={100} value={data.city} onChange={e => field('city', e.target.value)} />
      <FosterField label={t('care.area')} maxLength={100} value={data.area} onChange={e => field('area', e.target.value)} /></div>
    <FosterField label={t('care.breed')} maxLength={100} value={data.breed} onChange={e => field('breed', e.target.value)} />
    <div className="foster-grid"><FosterField label={t('care.age')} type="number" min="0" max="360" step="1" value={data.ageMonths} onChange={e => field('ageMonths', e.target.value)} />
      <FosterSelect label={t('care.size')} value={data.size} onChange={v => field('size', v)} options={['SMALL', 'MEDIUM', 'LARGE'].map(v => [v, t(`care.${v}`)])} /></div>
    <FosterSelect label={t('care.urgency')} value={data.urgency} onChange={v => field('urgency', v)} options={['LOW', 'MEDIUM', 'HIGH'].map(v => [v, t(`care.${v}`)])} />
    <FosterSelect label={t('care.duration')} value={data.duration} onChange={v => field('duration', v)} options={['FEW_DAYS', 'ONE_TWO_WEEKS', 'ONE_MONTH', 'UNTIL_ADOPTION', 'UNKNOWN'].map(v => [v, t(`care.${v}`)])} />
    {[['foodCovered', 'food'], ['vetCovered', 'vet'], ['transport', 'transport']].map(([key, label]) => <FosterCheck key={key} label={t(`care.${label}`)} checked={data[key]} onChange={v => field(key, v)} />)}
    <FosterField label={t('care.medical')}><textarea maxLength={2000} value={data.medicalNeeds} onChange={e => field('medicalNeeds', e.target.value)} /></FosterField>
    <FosterField label={t('care.homeFit')}><textarea maxLength={2000} value={data.homeFit} onChange={e => field('homeFit', e.target.value)} /></FosterField>
    <FosterPhotoField itemId={animalId} value={data.photo} onChange={v => field('photo', v)} />
    <FosterSelect label={t('care.caseStatus')} value={data.status} onChange={v => field('status', v)} options={['ACTIVE', 'PAUSED', 'ARCHIVED'].map(v => [v, t(`care.${v}`)])} />
  </FosterForm>;
}

export function FosterRegisterForm({ homeId, onClose, onSaved }) {
  const { t, myAnimals } = useApp();
  const [id] = useState(() => crypto.randomUUID());
  const [data, setData] = useState({ ownerAnimalId: '', name: '', species: 'DOG', photo: '', provenance: '' });
  const field = (key, value) => setData(current => ({ ...current, [key]: value }));
  return <FosterForm values={data} title={t('care.registerAnimal')} onClose={onClose} onSaved={onSaved}
    onSave={() => fosterRpc('register_foster_animal', { placement_id_input: id, home_id_input: homeId, data_input: data })}>
    <FosterSelect label={t('care.existingAnimal')} value={data.ownerAnimalId} onChange={v => field('ownerAnimalId', v)} empty={t('care.newAnimal')} options={myAnimals.map(a => [a.id, a.name])} />
    {!data.ownerAnimalId && <><FosterField label={t('care.animalName')} required maxLength={80} value={data.name} onChange={e => field('name', e.target.value)} />
      <FosterSelect label={t('care.species')} value={data.species} onChange={v => field('species', v)} options={['DOG', 'CAT'].map(v => [v, t(v === 'DOG' ? 'care.dogs' : 'care.cats')])} />
      <FosterPhotoField itemId={id} value={data.photo} onChange={v => field('photo', v)} /></>}
    <FosterField label={t('care.origin')}><textarea required maxLength={2000} value={data.provenance} onChange={e => field('provenance', e.target.value)} /></FosterField>
    <p className="foster-muted">{t('care.originHint')}</p>
  </FosterForm>;
}

export function FosterRequestForm({ item, kind, homes, onClose, onSaved }) {
  const { t, user } = useApp();
  const [id] = useState(() => crypto.randomUUID());
  const [homeId, setHomeId] = useState(kind === 'INVITE' ? item.id : homes[0]?.id || '');
  const [caseId, setCaseId] = useState(kind === 'APPLICATION' ? item.id : '');
  const [message, setMessage] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [cases, setCases] = useState({ rows: [], count: 0, error: '' });
  useEffect(() => {
    if (kind !== 'INVITE') return undefined;
    let cancelled = false;
    loadFosterDirectory({ type: 'animals', ownerId: user.id, query, page }).then(data => { if (!cancelled) setCases({ ...data, error: '' }); })
      .catch(error => { if (!cancelled) setCases({ rows: [], count: 0, error: error.message }); });
    return () => { cancelled = true; };
  }, [kind, user.id, query, page]);
  return <FosterForm values={{ homeId, caseId, message }} title={t(kind === 'APPLICATION' ? 'care.apply' : 'care.invite')} onClose={onClose} onSaved={onSaved} submitLabel="care.send"
    onSave={() => fosterRpc('create_foster_request', { request_id_input: id, case_id_input: caseId, home_id_input: homeId, kind_input: kind, message_input: message })}>
    <h3>{item.name}</h3><p className="foster-muted">{t('care.requestHint')}</p>
    {kind === 'APPLICATION' ? <FosterSelect required label={t('care.chooseHome')} value={homeId} onChange={setHomeId} empty={t('care.chooseHome')} options={homes.map(h => [h.id, h.name])} />
      : <><FosterField label={t('care.search')} value={query} onChange={e => { setQuery(e.target.value); setPage(0); }} />
        <FosterSelect required label={t('care.chooseCase')} value={caseId} onChange={setCaseId} empty={t('care.chooseCase')}
          options={cases.rows.filter(c => c.status === 'ACTIVE').map(c => [c.id, c.name])} />
        <FosterPager page={page} count={cases.count} onChange={value => { setPage(value); setCaseId(''); }} />
        {cases.error && <p role="alert" className="foster-alert">{cases.error}</p>}</>}
    <FosterField label={t('care.firstMessage')}><textarea required maxLength={4000} value={message} onChange={e => setMessage(e.target.value)} /></FosterField>
  </FosterForm>;
}

export function FosterReasonForm({ title, description, onSave, onClose, onSaved, requireReason = true, submitLabel }) {
  const { t } = useApp();
  const [body, setBody] = useState('');
  return <FosterForm values={body} title={title} onClose={onClose} onSave={ack => onSave(body, ack)} onSaved={onSaved} submitLabel={submitLabel || 'care.confirmDecision'}>
    {description && <p className="foster-muted">{description}</p>}
    {requireReason && <FosterField label={t('care.reason')}><textarea required maxLength={2000} value={body} onChange={e => setBody(e.target.value)} /></FosterField>}
  </FosterForm>;
}

export function FosterReportForm({ profileId, listingId, onClose, onSaved }) {
  const { t } = useApp();
  const [category, setCategory] = useState('SPAM');
  const [details, setDetails] = useState('');
  return <FosterForm values={{ category, details }} title={t('care.report')} onClose={onClose} onSaved={onSaved}
    onSave={() => reportFosterItem({ profileId, listingId, category, details })}>
    <FosterSelect label={t('care.category')} value={category} onChange={setCategory} options={['SPAM', 'ABUSE', 'MISLEADING', 'OTHER'].map(v => [v, v])} />
    <FosterField label={t('care.details')}><textarea required maxLength={2000} value={details} onChange={e => setDetails(e.target.value)} /></FosterField>
  </FosterForm>;
}
