import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { DOG_BREEDS, CAT_BREEDS } from '../data/breeds';
import { formatDuration } from '../data/mockData';
import {
  Badge, Chip, PrimaryButton, SecondaryButton, ScreenHeader, EmptyState,
  PrivacyNote, UrgencyBadge, CoverageChips, FilterSheet, DemoBanner, Modal
} from '../components/SharedComponents';
import {
  Clock, MapPin, ShieldCheck, CheckCircle2, XCircle,
  AlertTriangle, Bookmark, ChevronRight, Dog, Cat, Filter, FileText,
  Home, Briefcase, Calendar, Users, ClipboardList, Plus, Eye, Star, Send
} from 'lucide-react';

const ROMANIAN_COUNTIES = [
  'Alba',
  'Arad',
  'Arges',
  'Bacau',
  'Bihor',
  'Bistrita-Nasaud',
  'Botosani',
  'Braila',
  'Brasov',
  'Bucuresti',
  'Buzau',
  'Calarasi',
  'Caras-Severin',
  'Cluj',
  'Constanta',
  'Covasna',
  'Dambovita',
  'Dolj',
  'Galati',
  'Giurgiu',
  'Gorj',
  'Harghita',
  'Hunedoara',
  'Ialomita',
  'Iasi',
  'Ilfov',
  'Maramures',
  'Mehedinti',
  'Mures',
  'Neamt',
  'Olt',
  'Prahova',
  'Salaj',
  'Satu Mare',
  'Sibiu',
  'Suceava',
  'Teleorman',
  'Timis',
  'Tulcea',
  'Valcea',
  'Vaslui',
  'Vrancea',
];

function getCaseCounty(fcase) {
  const city = (fcase.city || '').toLowerCase();
  const area = (fcase.coarseArea || '').toLowerCase();

  if (city.includes('bucharest') || city.includes('bucuresti') || area.includes('sector')) return 'Bucuresti';
  if (city.includes('cluj')) return 'Cluj';
  if (city.includes('timisoara')) return 'Timis';
  if (city.includes('ilfov')) return 'Ilfov';
  return fcase.county || null;
}

function getSizeLabel(size, t) {
  if (size === 'SMALL') return t('common.small');
  if (size === 'MEDIUM') return t('common.medium');
  if (size === 'LARGE') return t('common.large');
  return size || t('common.unknown');
}

function formatFosterAge(months, t) {
  if (!months) return t('common.unknown');
  if (months < 12) {
    return `${months} ${months === 1 ? t('common.month') : t('common.months')}`;
  }

  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  const yearLabel = years === 1 ? t('common.year') : t('common.years');

  if (remainingMonths > 0) {
    return `${years} ${yearLabel} ${remainingMonths} ${remainingMonths === 1 ? t('common.month') : t('common.months')}`;
  }

  return `${years} ${yearLabel}`;
}

function FosterCaseCard({ fcase, onView, onSave, t, lang }) {
  return (
    <div data-testid={`foster-card-${fcase.id}`} className="bg-white rounded-2xl border border-[#E4E2DC] overflow-hidden shadow-sm">
      <div className="flex">
        <img
          src={fcase.photoUrl || 'https://images.unsplash.com/photo-1699727314431-36ab60fcc3e1?w=300&h=300&fit=crop'}
          alt={fcase.animalName}
          className="w-28 h-full object-cover flex-shrink-0"
        />
        <div className="flex-1 p-3.5 space-y-2">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-base font-semibold text-[#1F2924] font-heading">{fcase.animalName}</h3>
              <p className="text-xs text-[#57645C]">
                {fcase.species === 'DOG' ? t('common.dog') : t('common.cat')} - {formatFosterAge(fcase.ageMonths, t)} - {getSizeLabel(fcase.sizeLabel, t)}
              </p>
            </div>
            <UrgencyBadge urgency={fcase.urgency} />
          </div>

          <div className="flex items-center gap-1.5 text-xs text-[#57645C]">
            <Clock size={12} className="text-[#C07E67]" />
            <span>{formatDuration(fcase.duration, lang)}</span>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-[#57645C]">
            <MapPin size={12} className="text-[#9BAE96]" />
            <span>{fcase.city}{fcase.coarseArea ? ` / ${fcase.coarseArea}` : ''}</span>
          </div>

          <CoverageChips food={fcase.foodCovered} vet={fcase.vetCovered} transport={fcase.transportAvailable} />

          {fcase.rescuerVerified && (
            <div className="flex items-center gap-1 text-xs text-[#2C402B]">
              <ShieldCheck size={12} />
              <span className="font-medium">{fcase.rescuerName}</span>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <PrimaryButton onClick={onView} className="flex-1 !py-2 !text-sm">{t('foster.viewCase')}</PrimaryButton>
            <button
              type="button"
              data-testid={`foster-save-${fcase.id}`}
              onClick={onSave}
              aria-label={t('foster.saveCase')}
              className="p-2 rounded-xl border border-[#E4E2DC] text-[#57645C] hover:bg-[#F8F7F4] transition-colors"
            >
              <Bookmark size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function FosterCaseDetail({ fcase, onClose, onApply, t, lang }) {
  return (
    <div data-testid="foster-detail-screen" className="absolute inset-0 z-[60] bg-[#F8F7F4] flex flex-col">
      <ScreenHeader title={fcase.animalName} onBack={onClose} />
      <div className="flex-1 overflow-y-auto no-scrollbar">
        <div className="relative h-56">
          <img
            src={fcase.photoUrl || 'https://images.unsplash.com/photo-1699727314431-36ab60fcc3e1?w=600&h=400&fit=crop'}
            alt={fcase.animalName}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#F8F7F4] via-transparent to-transparent" />
        </div>

        <div className="px-5 -mt-8 relative space-y-4 pb-32">
          <div>
            <h1 className="text-2xl font-bold text-[#1F2924] font-heading">{fcase.animalName}</h1>
            <p className="text-sm text-[#57645C] mt-1">
              {fcase.species === 'DOG' ? t('common.dog') : t('common.cat')} - {formatFosterAge(fcase.ageMonths, t)} - {getSizeLabel(fcase.sizeLabel, t)}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <UrgencyBadge urgency={fcase.urgency} />
            <Badge variant="sky"><Clock size={11} />{formatDuration(fcase.duration, lang)}</Badge>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-[#E4E2DC] space-y-3">
            <h3 className="text-sm font-semibold text-[#1F2924] uppercase tracking-wider">{t('foster.covered')}</h3>
            <CoverageChips food={fcase.foodCovered} vet={fcase.vetCovered} transport={fcase.transportAvailable} />
          </div>

          <div className="bg-white rounded-2xl p-4 border border-[#E4E2DC] space-y-2">
            <h3 className="text-sm font-semibold text-[#1F2924] uppercase tracking-wider">{t('foster.homeFit')}</h3>
            <p className="text-sm text-[#57645C]">{fcase.homeFit}</p>
            <div className="flex gap-2">
              {fcase.goodWithChildren !== null && (
                <Badge variant={fcase.goodWithChildren ? 'sage' : 'default'}>
                  {fcase.goodWithChildren ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
                  {t('foster.goodWithChildren')}
                </Badge>
              )}
              {fcase.goodWithOtherAnimals !== null && (
                <Badge variant={fcase.goodWithOtherAnimals ? 'sage' : 'default'}>
                  {fcase.goodWithOtherAnimals ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
                  {t('foster.goodWithAnimals')}
                </Badge>
              )}
            </div>
          </div>

          {fcase.medicalNeeds && (
            <div className="bg-white rounded-2xl p-4 border border-[#E4E2DC] space-y-2">
              <h3 className="text-sm font-semibold text-[#1F2924] uppercase tracking-wider">{t('foster.medicalNeeds')}</h3>
              <p className="text-sm text-[#57645C]">{fcase.medicalNeeds}</p>
            </div>
          )}

          <div className="bg-white rounded-2xl p-4 border border-[#E4E2DC] space-y-2">
            <h3 className="text-sm font-semibold text-[#1F2924] uppercase tracking-wider">{t('foster.rescuer')}</h3>
            <div className="flex items-center gap-2">
              {fcase.rescuerVerified && <ShieldCheck size={16} className="text-[#9BAE96]" />}
              <span className="text-sm font-medium text-[#1F2924]">{fcase.rescuerName}</span>
              {fcase.rescuerVerified && <Badge variant="success">{t('foster.verifiedRescuer')}</Badge>}
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-[#E4E2DC] space-y-2">
            <div className="flex items-center gap-1.5 text-sm text-[#57645C]">
              <MapPin size={14} className="text-[#9BAE96]" />
              <span>{fcase.city}{fcase.coarseArea ? ` / ${fcase.coarseArea}` : ''}</span>
            </div>
            <PrivacyNote text={t('matches.locationPrivate')} />
          </div>

          <div className="bg-[#E3ECE4]/40 rounded-2xl p-4 border border-[#E3ECE4] space-y-2.5">
            <h3 className="text-sm font-semibold text-[#2C402B]">{t('foster.whatHappens')}</h3>
            <div className="space-y-2">
              {[t('foster.step1'), t('foster.step2'), t('foster.step3')].map((step, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-[#2C402B] text-white text-xs flex items-center justify-center flex-shrink-0 mt-0.5 font-semibold">{i + 1}</div>
                  <span className="text-sm text-[#57645C]">{step}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-5 pb-6 bg-gradient-to-t from-[#F8F7F4] via-[#F8F7F4] to-transparent">
        <PrimaryButton onClick={onApply} icon={FileText}>{t('foster.applyFoster')}</PrimaryButton>
      </div>
    </div>
  );
}

function ApplicationFlow({ fcase, onClose, onSubmit, t }) {
  const steps = [
    { key: 'home', label: t('foster.home'), icon: Home },
    { key: 'experience', label: t('foster.experience'), icon: Briefcase },
    { key: 'availability', label: t('foster.availability'), icon: Calendar },
    { key: 'household', label: t('foster.household'), icon: Users },
    { key: 'review', label: t('foster.review'), icon: ClipboardList },
  ];

  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    housingType: '', experience: '', availability: '', otherPets: '',
    childrenInHome: '', canTransport: null, canHandleMedicalNeeds: null, motivation: '',
  });
  const [error, setError] = useState('');

  const update = (key, val) => {
    setForm(prev => ({ ...prev, [key]: val }));
    setError('');
  };

  const isStepValid = () => {
    if (step === 0) return !!form.housingType;
    if (step === 1) return form.experience.trim().length >= 20;
    if (step === 2) return !!form.availability && form.canTransport !== null && form.canHandleMedicalNeeds !== null;
    if (step === 3) return form.otherPets.trim().length > 0 && form.childrenInHome.trim().length > 0 && form.motivation.trim().length >= 20;
    return true;
  };

  const validationMessage = () => {
    if (step === 0) return t('foster.validationHousing');
    if (step === 1) return t('foster.validationExperience');
    if (step === 2) return t('foster.validationAvailability');
    if (step === 3) return t('foster.validationHousehold');
    return t('foster.validationRequired');
  };

  const goNext = () => {
    if (!isStepValid()) {
      setError(validationMessage());
      return;
    }
    setStep(s => s + 1);
    setError('');
  };

  const submit = () => {
    if (!isStepValid()) {
      setError(validationMessage());
      return;
    }
    onSubmit(form);
  };

  const inputClass = "w-full bg-white border border-[#E4E2DC] rounded-xl px-4 py-3 text-[#1F2924] text-sm placeholder:text-[#57645C]/50 focus:outline-none focus:ring-2 focus:ring-[#9BAE96] transition-all";
  const labelClass = "text-xs font-semibold text-[#57645C] uppercase tracking-wider mb-1.5 block";
  const toggleClass = (active) => `flex-1 py-3 rounded-xl text-sm font-medium transition-all border ${active ? 'bg-[#2C402B] text-white border-[#2C402B]' : 'bg-white text-[#57645C] border-[#E4E2DC]'}`;

  return (
    <div data-testid="foster-application-flow" className="absolute inset-0 z-[60] bg-[#F8F7F4] flex flex-col">
      <ScreenHeader
        title={`${t('foster.applyFoster')} - ${fcase.animalName}`}
        onBack={step === 0 ? onClose : () => setStep(s => s - 1)}
      />

      <div className="px-5 py-3">
        <div className="flex gap-1.5">
          {steps.map((s, i) => (
            <div key={s.key} className={`flex-1 h-1.5 rounded-full transition-colors ${i <= step ? 'bg-[#9BAE96]' : 'bg-[#E4E2DC]'}`} />
          ))}
        </div>
        <div className="flex items-center gap-2 mt-3">
          {React.createElement(steps[step].icon, { size: 16, className: 'text-[#9BAE96]' })}
          <span className="text-sm font-semibold text-[#1F2924]">{steps[step].label}</span>
          <span className="text-xs text-[#57645C] ml-auto">{step + 1}/{steps.length}</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-32 no-scrollbar">
        {step === 0 && (
          <div className="space-y-4 mt-2">
            <div>
              <label className={labelClass}>{t('foster.housingType')}</label>
              <select value={form.housingType} onChange={e => update('housingType', e.target.value)} className={inputClass}>
                <option value="">{t('foster.select')}</option>
                <option value="apartment">{t('foster.apartment')}</option>
                <option value="house_yard">{t('foster.houseWithYard')}</option>
                <option value="house_no_yard">{t('foster.houseNoYard')}</option>
                <option value="rural">{t('foster.ruralProperty')}</option>
              </select>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4 mt-2">
            <div>
              <label className={labelClass}>{t('foster.animalExperience')}</label>
              <textarea
                value={form.experience}
                onChange={e => update('experience', e.target.value)}
                placeholder={t('foster.experiencePlaceholder')}
                className={`${inputClass} min-h-[100px] resize-none`}
              />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4 mt-2">
            <div>
              <label className={labelClass}>{t('foster.availabilityField')}</label>
              <select value={form.availability} onChange={e => update('availability', e.target.value)} className={inputClass}>
                <option value="">{t('foster.select')}</option>
                <option value="few_days">{t('foster.fewDays')}</option>
                <option value="1-2_weeks">{t('foster.oneTwoWeeks')}</option>
                <option value="1_month">{t('foster.oneMonth')}</option>
                <option value="until_adoption">{t('foster.untilAdoption')}</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>{t('foster.canTransport')}</label>
              <div className="flex gap-3">
                <button type="button" className={toggleClass(form.canTransport === true)} onClick={() => update('canTransport', true)}>{t('common.yes')}</button>
                <button type="button" className={toggleClass(form.canTransport === false)} onClick={() => update('canTransport', false)}>{t('common.no')}</button>
              </div>
            </div>
            <div>
              <label className={labelClass}>{t('foster.canHandleMedical')}</label>
              <div className="flex gap-3">
                <button type="button" className={toggleClass(form.canHandleMedicalNeeds === true)} onClick={() => update('canHandleMedicalNeeds', true)}>{t('common.yes')}</button>
                <button type="button" className={toggleClass(form.canHandleMedicalNeeds === false)} onClick={() => update('canHandleMedicalNeeds', false)}>{t('common.no')}</button>
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4 mt-2">
            <div>
              <label className={labelClass}>{t('foster.otherPets')}</label>
              <input
                value={form.otherPets}
                onChange={e => update('otherPets', e.target.value)}
                placeholder={t('foster.otherPetsPlaceholder')}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>{t('foster.childrenInHome')}</label>
              <input
                value={form.childrenInHome}
                onChange={e => update('childrenInHome', e.target.value)}
                placeholder={t('foster.childrenPlaceholder')}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>{t('foster.motivation')}</label>
              <textarea
                value={form.motivation}
                onChange={e => update('motivation', e.target.value)}
                placeholder={t('foster.motivationPlaceholder')}
                className={`${inputClass} min-h-[100px] resize-none`}
              />
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-3 mt-2">
            <div className="bg-white rounded-2xl p-4 border border-[#E4E2DC] space-y-2">
              <h4 className="text-sm font-semibold text-[#1F2924]">{t('foster.applicationSummary')}</h4>
              {[
                [t('foster.housingType'), form.housingType || '-'],
                [t('foster.animalExperience'), form.experience || '-'],
                [t('foster.availabilityField'), form.availability || '-'],
                [t('foster.canTransport'), form.canTransport === true ? t('common.yes') : form.canTransport === false ? t('common.no') : '-'],
                [t('foster.canHandleMedical'), form.canHandleMedicalNeeds === true ? t('common.yes') : form.canHandleMedicalNeeds === false ? t('common.no') : '-'],
                [t('foster.otherPets'), form.otherPets || '-'],
                [t('foster.childrenInHome'), form.childrenInHome || '-'],
                [t('foster.motivation'), form.motivation || '-'],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between py-1.5 border-b border-[#E4E2DC]/50 last:border-0">
                  <span className="text-xs text-[#57645C]">{label}</span>
                  <span className="text-xs font-medium text-[#1F2924] text-right max-w-[55%]">{value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-5 pb-6 bg-gradient-to-t from-[#F8F7F4] via-[#F8F7F4] to-transparent">
        {error && <p className="mb-2 text-xs font-medium text-[#8B4C2F] bg-[#F5DDD0] border border-[#E8C3AF] rounded-xl px-3 py-2">{error}</p>}
        {step < 4 ? (
          <PrimaryButton onClick={goNext} disabled={!isStepValid()}>{t('foster.next')}</PrimaryButton>
        ) : (
          <PrimaryButton onClick={submit} icon={FileText}>{t('foster.submit')}</PrimaryButton>
        )}
      </div>
    </div>
  );
}

function InviteFlow({ profile, fosterCases, onClose, onSubmit, t }) {
  const activeCases = fosterCases.filter((item) => item.status === 'ACTIVE');
  const [selectedCaseId, setSelectedCaseId] = useState(activeCases[0]?.id || '');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const selectedCase = activeCases.find((item) => item.id === selectedCaseId);

  const submit = () => {
    if (!selectedCaseId) {
      setError(t('foster.selectCaseForInvite'));
      return;
    }

    onSubmit({
      fosterCaseId: selectedCaseId,
      fosterHomeProfileId: profile.id,
      message,
    });
  };

  return (
    <div data-testid="foster-invite-flow" className="absolute inset-0 z-[60] bg-[#F8F7F4] flex flex-col">
      <ScreenHeader title={t('foster.inviteToFoster')} onBack={onClose} />
      <div className="flex-1 overflow-y-auto no-scrollbar px-5 pt-4 pb-32 space-y-4">
        <div className="rounded-2xl border border-[#E4E2DC] bg-white p-4 space-y-1">
          <p className="text-sm font-semibold text-[#1F2924]">{profile.displayName}</p>
          <p className="text-sm text-[#57645C]">{t('foster.inviteIntro')}</p>
          <PrivacyNote text={t('foster.noDirectChat')} />
        </div>

        <label className="block space-y-1.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#57645C]">{t('foster.chooseAnimalCase')}</span>
          <select
            value={selectedCaseId}
            onChange={(event) => {
              setSelectedCaseId(event.target.value);
              setError('');
            }}
            className="w-full rounded-xl border border-[#E4E2DC] bg-white px-3.5 py-3 text-sm text-[#1F2924] outline-none transition-colors focus:border-[#9BAE96]"
          >
            {activeCases.map((item) => (
              <option key={item.id} value={item.id}>{item.animalName} - {item.city}{item.coarseArea ? ` / ${item.coarseArea}` : ''}</option>
            ))}
          </select>
        </label>

        {selectedCase && (
          <div className="rounded-2xl border border-[#E4E2DC] bg-white p-4 space-y-2">
            <div className="flex items-center gap-3">
              <img src={selectedCase.photoUrl} alt={selectedCase.animalName} className="h-14 w-14 rounded-xl object-cover" />
              <div>
                <p className="text-sm font-semibold text-[#1F2924]">{selectedCase.animalName}</p>
                <p className="text-xs text-[#57645C]">{formatFosterAge(selectedCase.ageMonths, t)} - {getSizeLabel(selectedCase.sizeLabel, t)}</p>
              </div>
            </div>
            <CoverageChips food={selectedCase.foodCovered} vet={selectedCase.vetCovered} transport={selectedCase.transportAvailable} />
          </div>
        )}

        <label className="block space-y-1.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#57645C]">{t('foster.inviteMessage')}</span>
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder={t('foster.inviteMessagePlaceholder')}
            className="min-h-[110px] w-full resize-none rounded-xl border border-[#E4E2DC] bg-white px-3.5 py-3 text-sm text-[#1F2924] outline-none transition-colors placeholder:text-[#57645C]/50 focus:border-[#9BAE96]"
          />
        </label>

        {error && <p className="text-xs font-medium text-[#8B4C2F] bg-[#F5DDD0] border border-[#E8C3AF] rounded-xl px-3 py-2">{error}</p>}
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-5 pb-6 bg-gradient-to-t from-[#F8F7F4] via-[#F8F7F4] to-transparent">
        <PrimaryButton onClick={submit} icon={Send}>{t('foster.sendInvite')}</PrimaryButton>
      </div>
    </div>
  );
}

function ApplicationCard({ app, t, onOpenMessages }) {
  const statusMap = {
    DRAFT: { label: t('common.draft'), variant: 'default' },
    SUBMITTED: { label: t('common.submitted'), variant: 'sky' },
    IN_REVIEW: { label: t('common.inReview'), variant: 'warning' },
    ACCEPTED: { label: t('common.accepted'), variant: 'success' },
    REJECTED: { label: t('common.rejected'), variant: 'rose' },
    WITHDRAWN: { label: t('common.withdrawn'), variant: 'default' },
    COMPLETED: { label: t('common.completed'), variant: 'sage' },
  };
  const s = statusMap[app.status] || statusMap.DRAFT;

  return (
    <div data-testid={`application-card-${app.id}`} className="bg-white rounded-2xl p-4 border border-[#E4E2DC] shadow-sm space-y-2.5">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-base font-semibold text-[#1F2924] font-heading">{app.animalName}</h3>
          <p className="text-xs text-[#57645C]">{t('messages.foster')} - {app.rescuerName}</p>
        </div>
        <Badge variant={s.variant}>{s.label}</Badge>
      </div>
      {app.status === 'ACCEPTED' && (
        <PrimaryButton onClick={() => onOpenMessages(app)} className="!py-2 !text-sm">{t('matches.openMessages')}</PrimaryButton>
      )}
    </div>
  );
}

function getFosterHomeCounty(profile) {
  const city = (profile.city || '').toLowerCase();
  const area = (profile.coarseArea || '').toLowerCase();

  if (city.includes('bucharest') || city.includes('bucuresti') || area.includes('sector')) return 'Bucuresti';
  if (city.includes('cluj')) return 'Cluj';
  if (city.includes('timisoara')) return 'Timis';
  if (city.includes('ilfov')) return 'Ilfov';
  return profile.county || null;
}

function getAvailabilityLabel(status, t) {
  if (status === 'AVAILABLE') return t('foster.available');
  if (status === 'LIMITED') return t('foster.limited');
  if (status === 'UNAVAILABLE') return t('foster.unavailable');
  return t('common.unknown');
}

function FosterHomeCard({ profile, onView, onInvite, onSave, t, lang }) {
  const species = profile.acceptsSpecies.map((item) => item === 'DOG' ? t('common.dog') : t('common.cat')).join(', ');
  const sizes = profile.acceptsSizes.map((size) => getSizeLabel(size, t)).join(', ');

  return (
    <div data-testid={`foster-home-card-${profile.id}`} className="bg-white rounded-2xl border border-[#E4E2DC] overflow-hidden shadow-sm">
      <div className="flex">
        <img
          src={profile.photos?.[0] || 'https://images.unsplash.com/photo-1517849845537-4d257902454a?w=300&h=300&fit=crop'}
          alt={profile.displayName}
          className="w-28 h-full object-cover flex-shrink-0"
        />
        <div className="flex-1 p-3.5 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="text-base font-semibold text-[#1F2924] font-heading">{profile.displayName}</h3>
              <p className="text-xs text-[#57645C]">{species} - {sizes}</p>
            </div>
            {profile.verifiedStatus === 'VERIFIED' && <Badge variant="success">{t('foster.verifiedHome')}</Badge>}
          </div>

          <div className="flex items-center gap-1.5 text-xs text-[#57645C]">
            <MapPin size={12} className="text-[#9BAE96]" />
            <span>{profile.city}{profile.coarseArea ? ` / ${profile.coarseArea}` : ''}</span>
          </div>

          <div className="flex flex-wrap gap-1.5">
            <Badge variant={profile.availabilityStatus === 'AVAILABLE' ? 'success' : 'warning'}>{getAvailabilityLabel(profile.availabilityStatus, t)}</Badge>
            <Badge variant="sky"><Clock size={11} />{formatDuration(profile.preferredDuration, lang)}</Badge>
            {profile.canHandleMedicalNeeds && <Badge variant="sage">{t('foster.medicalCare')}</Badge>}
          </div>

          <div className="flex items-center gap-2 text-xs text-[#57645C]">
            <Star size={12} className="text-[#C07E67]" />
            <span>{profile.ratingAverage ? `${profile.ratingAverage} - ${profile.reviewCount} ${t('foster.reviews')}` : t('foster.noReviews')}</span>
          </div>

          <p className="line-clamp-2 text-xs leading-relaxed text-[#57645C]">{profile.bio}</p>

          <div className="flex gap-2 pt-1">
            <PrimaryButton onClick={onView} className="flex-1 !py-2 !text-sm">{t('foster.viewProfile')}</PrimaryButton>
            <button
              type="button"
              onClick={onInvite}
              aria-label={t('foster.inviteToFoster')}
              className="p-2 rounded-xl border border-[#E4E2DC] text-[#2C402B] hover:bg-[#F8F7F4] transition-colors"
            >
              <Send size={16} />
            </button>
            <button
              type="button"
              onClick={onSave}
              aria-label={t('foster.saveFosterHome')}
              className="p-2 rounded-xl border border-[#E4E2DC] text-[#57645C] hover:bg-[#F8F7F4] transition-colors"
            >
              <Bookmark size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function FosterHomeDetail({ profile, onClose, onInvite, onSave, onRatingSaved, t, lang }) {
  const species = profile.acceptsSpecies.map((item) => item === 'DOG' ? t('common.dog') : t('common.cat')).join(', ');
  const sizes = profile.acceptsSizes.map((size) => getSizeLabel(size, t)).join(', ');
  const [ratingOpen, setRatingOpen] = useState(false);
  const [ratingValue, setRatingValue] = useState(5);

  const submitRating = () => {
    setRatingOpen(false);
    onRatingSaved?.(ratingValue);
  };

  return (
    <div data-testid="foster-home-detail-screen" className="absolute inset-0 z-[60] bg-[#F8F7F4] flex flex-col">
      <ScreenHeader title={profile.displayName} onBack={onClose} />
      <div className="flex-1 overflow-y-auto no-scrollbar">
        <div className="relative h-52">
          <img
            src={profile.photos?.[0] || 'https://images.unsplash.com/photo-1517849845537-4d257902454a?w=600&h=400&fit=crop'}
            alt={profile.displayName}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#F8F7F4] via-transparent to-transparent" />
        </div>

        <div className="px-5 -mt-8 relative space-y-4 pb-32">
          <div>
            <h1 className="text-2xl font-bold text-[#1F2924] font-heading">{profile.displayName}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {profile.verifiedStatus === 'VERIFIED' && <Badge variant="success"><ShieldCheck size={11} />{t('foster.verifiedHome')}</Badge>}
              <Badge variant={profile.availabilityStatus === 'AVAILABLE' ? 'success' : 'warning'}>{getAvailabilityLabel(profile.availabilityStatus, t)}</Badge>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-[#E4E2DC] space-y-2">
            <div className="flex items-center gap-1.5 text-sm text-[#57645C]">
              <MapPin size={14} className="text-[#9BAE96]" />
              <span>{profile.city}{profile.coarseArea ? ` / ${profile.coarseArea}` : ''}</span>
            </div>
            <PrivacyNote text={t('matches.locationPrivate')} />
          </div>

          <div className="bg-white rounded-2xl p-4 border border-[#E4E2DC] space-y-3">
            <h3 className="text-sm font-semibold text-[#1F2924] uppercase tracking-wider">{t('foster.canFoster')}</h3>
            <div className="flex flex-wrap gap-2">
              <Badge variant="sage">{species}</Badge>
              <Badge variant="sky">{sizes}</Badge>
              <Badge variant="default">{t('foster.capacity')}: {profile.maxAnimalsAtOnce}</Badge>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-[#E4E2DC] space-y-2">
            <h3 className="text-sm font-semibold text-[#1F2924] uppercase tracking-wider">{t('foster.availability')}</h3>
            <p className="text-sm text-[#57645C]">{profile.availableFrom ? `${t('foster.availableFrom')} ${profile.availableFrom}` : t('foster.availableNow')}</p>
            <Badge variant="sky"><Clock size={11} />{formatDuration(profile.preferredDuration, lang)}</Badge>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-[#E4E2DC] space-y-2">
            <h3 className="text-sm font-semibold text-[#1F2924] uppercase tracking-wider">{t('foster.home')}</h3>
            <p className="text-sm text-[#57645C]">{profile.housingType}</p>
            <div className="flex flex-wrap gap-2">
              <Badge variant={profile.hasSeparateRoom ? 'sage' : 'default'}>
                {profile.hasSeparateRoom ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
                {t('foster.separateRoom')}
              </Badge>
              <Badge variant="default">{profile.otherPets}</Badge>
              <Badge variant="default">{profile.childrenInHome}</Badge>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-[#E4E2DC] space-y-2">
            <h3 className="text-sm font-semibold text-[#1F2924] uppercase tracking-wider">{t('foster.experience')}</h3>
            <p className="text-sm text-[#57645C]">{profile.experienceSummary}</p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="sage">{profile.previousFosterCount} {t('foster.previousFosters')}</Badge>
              <Badge variant={profile.canTransport ? 'sage' : 'default'}>{t('foster.transportAvailable')}</Badge>
              <Badge variant={profile.canHandleMedicalNeeds ? 'sage' : 'default'}>{t('foster.medicalCare')}</Badge>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-[#E4E2DC] space-y-2">
            <h3 className="text-sm font-semibold text-[#1F2924] uppercase tracking-wider">{t('foster.reviews')}</h3>
            <div className="flex items-center gap-2 text-sm text-[#57645C]">
              <Star size={15} className="text-[#C07E67]" />
              <span>{profile.ratingAverage ? `${profile.ratingAverage} / 5 - ${profile.reviewCount} ${t('foster.reviews')}` : t('foster.noReviews')}</span>
            </div>
            {profile.responseTimeLabel && <p className="text-xs text-[#57645C]">{profile.responseTimeLabel}</p>}
            <button
              type="button"
              onClick={() => setRatingOpen(true)}
              className="mt-2 inline-flex items-center gap-1.5 rounded-xl border border-[#E4E2DC] bg-[#F8F7F4] px-3 py-2 text-xs font-semibold text-[#2C402B] transition-colors hover:bg-[#EFEDE8]"
            >
              <Star size={13} />
              {t('foster.rateFoster')}
            </button>
          </div>

          {profile.pastFosters?.length > 0 && (
            <div className="bg-white rounded-2xl p-4 border border-[#E4E2DC] space-y-2">
              <h3 className="text-sm font-semibold text-[#1F2924] uppercase tracking-wider">{t('foster.pastFosters')}</h3>
              <div className="flex flex-wrap gap-2">
                {profile.pastFosters.map((name) => (
                  <Badge key={name} variant="default">{name}</Badge>
                ))}
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl p-4 border border-[#E4E2DC] space-y-2">
            <h3 className="text-sm font-semibold text-[#1F2924] uppercase tracking-wider">{t('foster.safetyVocabulary')}</h3>
            <div className="space-y-1.5 text-xs leading-relaxed text-[#57645C]">
              <p><span className="font-semibold text-[#1F2924]">{t('foster.fosterCaseTerm')}:</span> {t('foster.fosterCaseDefinition')}</p>
              <p><span className="font-semibold text-[#1F2924]">{t('foster.fosterHomeTerm')}:</span> {t('foster.fosterHomeDefinition')}</p>
              <p><span className="font-semibold text-[#1F2924]">{t('foster.fosterPlacementTerm')}:</span> {t('foster.fosterPlacementDefinition')}</p>
            </div>
          </div>

          <div className="bg-[#E3ECE4]/40 rounded-2xl p-4 border border-[#E3ECE4] space-y-2.5">
            <h3 className="text-sm font-semibold text-[#2C402B]">{t('foster.whatHappensInvite')}</h3>
            {[t('foster.inviteStep1'), t('foster.inviteStep2'), t('foster.inviteStep3')].map((step, i) => (
              <div key={step} className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-full bg-[#2C402B] text-white text-xs flex items-center justify-center flex-shrink-0 mt-0.5 font-semibold">{i + 1}</div>
                <span className="text-sm text-[#57645C]">{step}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 grid grid-cols-[1fr_auto] gap-3 p-5 pb-6 bg-gradient-to-t from-[#F8F7F4] via-[#F8F7F4] to-transparent">
        <PrimaryButton onClick={onInvite} icon={Send}>{t('foster.inviteToFoster')}</PrimaryButton>
        <button
          type="button"
          onClick={onSave}
          aria-label={t('foster.saveFosterHome')}
          className="p-3 rounded-xl border border-[#E4E2DC] bg-white text-[#57645C] hover:bg-[#F8F7F4] transition-colors"
        >
          <Bookmark size={18} />
        </button>
      </div>

      <Modal open={ratingOpen} onClose={() => setRatingOpen(false)}>
        <div className="p-5 space-y-4">
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-[#1F2924] font-heading">{t('foster.rateFosterTitle')}</h3>
            <p className="text-sm text-[#57645C]">{t('foster.rateFosterDesc')}</p>
          </div>

          <div className="flex justify-center gap-1.5 py-2" role="radiogroup" aria-label={t('foster.rateFoster')}>
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={ratingValue === value}
                onClick={() => setRatingValue(value)}
                className={`rounded-xl p-2 transition-colors ${
                  value <= ratingValue ? 'text-[#C07E67] bg-[#F5DDD0]' : 'text-[#B9B4AA] bg-[#F8F7F4]'
                }`}
              >
                <Star size={24} fill={value <= ratingValue ? 'currentColor' : 'none'} />
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <SecondaryButton onClick={() => setRatingOpen(false)}>{t('common.cancel')}</SecondaryButton>
            <PrimaryButton onClick={submitRating}>{t('common.save')}</PrimaryButton>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function InviteCard({ invite, fosterCase, fosterHome, t, onOpenMessages }) {
  const statusMap = {
    SENT: { label: t('common.submitted'), variant: 'sky' },
    ACCEPTED: { label: t('common.accepted'), variant: 'success' },
    DECLINED: { label: t('common.rejected'), variant: 'rose' },
    EXPIRED: { label: t('common.withdrawn'), variant: 'default' },
  };
  const status = statusMap[invite.status] || statusMap.SENT;

  return (
    <div data-testid={`foster-invite-card-${invite.id}`} className="bg-white rounded-2xl p-4 border border-[#E4E2DC] shadow-sm space-y-2.5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-[#1F2924] font-heading">{fosterCase?.animalName || t('messages.foster')}</h3>
          <p className="text-xs text-[#57645C]">{t('foster.invitedHome')}: {fosterHome?.displayName || t('foster.fosterHome')}</p>
        </div>
        <Badge variant={status.variant}>{status.label}</Badge>
      </div>
      {invite.message && <p className="text-xs leading-relaxed text-[#57645C]">{invite.message}</p>}
      {invite.status === 'ACCEPTED' && (
        <PrimaryButton onClick={() => onOpenMessages(invite)} className="!py-2 !text-sm">{t('matches.openMessages')}</PrimaryButton>
      )}
    </div>
  );
}

function MyFosterDashboard({
  t,
  lang,
  user,
  fosterHomeProfiles,
  fosterApplications,
  fosterInvites,
  fosterCases,
  canManageFoster,
  rescuerAccessState,
  accessLoading,
  accessError,
  onRequestAccess,
  onDemoPreview,
  onOpenApplicationMessages,
  onOpenInviteMessages,
  onEditProfile,
  onPostCase,
}) {
  const myProfile = fosterHomeProfiles[0];
  const acceptedApplications = fosterApplications.filter((item) => item.status === 'ACCEPTED');
  const sentInvites = fosterInvites.filter((item) => item.sentByUserId === user.id || item.status === 'SENT' || item.status === 'ACCEPTED');
  const profileCompletion = 78;

  return (
    <div data-testid="my-foster-dashboard" className="px-5 pt-3 pb-8 space-y-4">
      <p className="text-sm leading-relaxed text-[#57645C]">{t('foster.myFosterSubtitle')}</p>

      <section className="space-y-3">
        <h3 className="text-xs font-semibold text-[#57645C] uppercase tracking-wider">{t('foster.asFosterVolunteer')}</h3>

        {myProfile && (
          <div className="bg-white rounded-2xl border border-[#E4E2DC] p-4 shadow-sm space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-[#1F2924] font-heading">{t('foster.myFosterProfile')}</h3>
                <p className="text-sm text-[#57645C]">{myProfile.displayName} - {myProfile.city}{myProfile.coarseArea ? ` / ${myProfile.coarseArea}` : ''}</p>
              </div>
              <Badge variant={myProfile.availabilityStatus === 'AVAILABLE' ? 'success' : 'warning'}>{getAvailabilityLabel(myProfile.availabilityStatus, t)}</Badge>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                [t('foster.applications'), fosterApplications.length],
                [t('foster.acceptedFosters'), acceptedApplications.length],
                [t('foster.pastFosters'), myProfile.previousFosterCount],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl bg-[#F8F7F4] p-3 text-center">
                  <div className="text-lg font-bold text-[#1F2924] font-heading">{value}</div>
                  <div className="text-[11px] font-medium text-[#57645C]">{label}</div>
                </div>
              ))}
            </div>
            <SecondaryButton icon={EditFallbackIcon} onClick={onEditProfile}>{t('foster.editFosterProfile')}</SecondaryButton>
          </div>
        )}

        <div className="bg-white rounded-2xl border border-[#E4E2DC] p-4 shadow-sm space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-[#1F2924] font-heading">{t('foster.profileCompletion')}</h3>
              <p className="text-sm text-[#57645C]">{t('foster.profileCompletionDesc')}</p>
            </div>
            <div className="text-lg font-bold text-[#2C402B] font-heading">{profileCompletion}%</div>
          </div>
          <div className="h-2 rounded-full bg-[#EFEDE8] overflow-hidden">
            <div className="h-full rounded-full bg-[#9BAE96]" style={{ width: `${profileCompletion}%` }} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[t('foster.completionAvailability'), t('foster.completionHomePhotos'), t('foster.completionAnimalTypes'), t('foster.completionMedicalCare')].map((item) => (
              <div key={item} className="flex items-center gap-1.5 rounded-xl bg-[#F8F7F4] px-2.5 py-2 text-[11px] font-medium text-[#57645C]">
                <CheckCircle2 size={12} className="text-[#9BAE96]" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-[#57645C] uppercase tracking-wider">{t('foster.myApplications')}</h3>
          {fosterApplications.length === 0 ? (
            <EmptyState icon={FileText} title={t('foster.noRequests')} description={t('foster.noRequestsDesc')} />
          ) : (
            fosterApplications.map((app) => <ApplicationCard key={app.id} app={app} t={t} onOpenMessages={onOpenApplicationMessages} />)
          )}
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-xs font-semibold text-[#57645C] uppercase tracking-wider">{t('foster.asRescuerOwner')}</h3>

        {canManageFoster ? (
          <>
            <button
              type="button"
              onClick={onPostCase}
              className="w-full flex items-center gap-3 bg-white rounded-2xl p-4 border border-[#E4E2DC] hover:bg-[#FAFAF8] transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-[#E3ECE4] flex items-center justify-center">
                <Plus size={18} className="text-[#2C402B]" />
              </div>
              <span className="text-sm font-medium text-[#1F2924]">{t('foster.postAnimalCase')}</span>
              <ChevronRight size={16} className="text-[#57645C] ml-auto" />
            </button>

            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-[#57645C] uppercase tracking-wider">{t('foster.invitesSent')}</h3>
              {sentInvites.length === 0 ? (
                <EmptyState icon={Send} title={t('foster.noInvites')} description={t('foster.noInvitesDesc')} />
              ) : (
                sentInvites.map((invite) => (
                  <InviteCard
                    key={invite.id}
                    invite={invite}
                    fosterCase={fosterCases.find((item) => item.id === invite.fosterCaseId)}
                    fosterHome={fosterHomeProfiles.find((item) => item.id === invite.fosterHomeProfileId)}
                    t={t}
                    onOpenMessages={onOpenInviteMessages}
                  />
                ))
              )}
            </div>

            <ManageDashboard
              t={t}
              isDemoMode={rescuerAccessState === 'demo_preview'}
              fosterCases={fosterCases}
              applications={fosterApplications}
              invites={fosterInvites}
              onPostCase={onPostCase}
            />
          </>
        ) : (
          <RescuerAccessCard
            state={rescuerAccessState}
            loading={accessLoading}
            error={accessError}
            onRequestAccess={onRequestAccess}
            onDemoPreview={onDemoPreview}
            t={t}
          />
        )}
      </section>
    </div>
  );
}

function EditFallbackIcon(props) {
  return <ClipboardList {...props} />;
}

function ManageDashboard({ t, isDemoMode, fosterCases, applications, invites = [], onPostCase }) {
  const activeCases = fosterCases.filter(item => item.status === 'ACTIVE').length;
  const newApplications = applications.filter(item => item.status === 'SUBMITTED' || item.status === 'IN_REVIEW').length;
  const urgentCases = fosterCases.filter(item => item.status === 'ACTIVE' && item.urgency === 'HIGH').length;
  const activeInvites = invites.filter(item => item.status === 'SENT').length;

  return (
    <div data-testid="foster-manage-dashboard" className="space-y-4">
      {isDemoMode && <DemoBanner text={t('foster.demoBanner')} />}

      <div className="grid grid-cols-2 gap-3">
        {[
          { label: t('foster.activeCases'), value: activeCases, color: 'bg-[#E3ECE4] text-[#2C402B]' },
          { label: t('foster.newApplications'), value: newApplications, color: 'bg-[#D8EAF0] text-[#3A7080]' },
          { label: t('foster.urgentCases'), value: urgentCases, color: 'bg-[#F5DDD0] text-[#8B4C2F]' },
          { label: t('foster.invitesSent'), value: activeInvites, color: 'bg-[#EFEDE8] text-[#57645C]' },
        ].map(s => (
          <div key={s.label} className={`${s.color} rounded-2xl p-3 text-center`}>
            <div className="text-2xl font-bold font-heading">{s.value}</div>
            <div className="text-xs font-medium mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        {[
          { label: t('foster.addCase'), icon: Plus, onClick: onPostCase },
          { label: t('foster.reviewApps'), icon: ClipboardList, onClick: undefined },
        ].map(item => (
          <button type="button" key={item.label} onClick={item.onClick} className="w-full flex items-center gap-3 bg-white rounded-2xl p-4 border border-[#E4E2DC] hover:bg-[#FAFAF8] transition-colors">
            <div className="w-10 h-10 rounded-xl bg-[#E3ECE4] flex items-center justify-center">
              <item.icon size={18} className="text-[#2C402B]" />
            </div>
            <span className="text-sm font-medium text-[#1F2924]">{item.label}</span>
            <ChevronRight size={16} className="text-[#57645C] ml-auto" />
          </button>
        ))}
      </div>
    </div>
  );
}

function FilterGroup({ title, children }) {
  return (
    <div>
      <h4 className="text-xs font-semibold text-[#57645C] uppercase tracking-wider mb-2">{title}</h4>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function FilterPill({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={Boolean(active)}
      className={`px-3 py-2 rounded-xl text-sm font-medium border transition-colors ${
        active
          ? 'bg-[#2C402B] text-white border-[#2C402B]'
          : 'bg-[#F8F7F4] text-[#57645C] border-[#E4E2DC] hover:bg-[#EFEDE8]'
      }`}
    >
      {children}
    </button>
  );
}

function FilterSelect({ label, value, onChange, options, emptyLabel }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-semibold uppercase tracking-wider text-[#57645C]">{label}</span>
      <select
        value={value || ''}
        onChange={(event) => onChange(event.target.value || null)}
        className="w-full rounded-xl border border-[#E4E2DC] bg-[#F8F7F4] px-3.5 py-3 text-sm text-[#1F2924] outline-none transition-colors focus:border-[#9BAE96] focus:bg-white"
      >
        <option value="">{emptyLabel}</option>
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}

function FilterInput({ label, value, onChange, placeholder }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-semibold uppercase tracking-wider text-[#57645C]">{label}</span>
      <input
        value={value || ''}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-[#E4E2DC] bg-[#F8F7F4] px-3.5 py-3 text-sm text-[#1F2924] outline-none transition-colors placeholder:text-[#57645C]/50 focus:border-[#9BAE96] focus:bg-white"
      />
    </label>
  );
}

function RescuerAccessCard({ state, loading, error, onRequestAccess, onDemoPreview, t }) {
  if (state === 'request_sent' || state === 'rejected') {
    return (
      <div className="bg-white rounded-2xl p-5 border border-[#E4E2DC] text-center space-y-3">
        <div className="w-14 h-14 rounded-2xl bg-[#D8EAF0] flex items-center justify-center mx-auto">
          <Clock size={26} className="text-[#3A7080]" />
        </div>
        <h3 className="text-base font-semibold text-[#1F2924] font-heading">
          {state === 'rejected' ? t('foster.requestRejected') : t('foster.requestSent')}
        </h3>
        <p className="text-sm text-[#57645C]">
          {state === 'rejected' ? t('foster.requestRejectedDesc') : t('foster.requestSentDesc')}
        </p>
        {error && <p className="text-xs font-medium text-[#8B4C2F]">{error}</p>}
        <SecondaryButton onClick={onDemoPreview} icon={Eye}>{t('foster.demoPreview')}</SecondaryButton>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl p-5 border border-[#E4E2DC] text-center space-y-3">
      <div className="w-14 h-14 rounded-2xl bg-[#E3ECE4] flex items-center justify-center mx-auto">
        <ShieldCheck size={26} className="text-[#2C402B]" />
      </div>
      <h3 className="text-base font-semibold text-[#1F2924] font-heading">{t('foster.rescuerAccess')}</h3>
      <p className="text-sm text-[#57645C]">{t('foster.rescuerAccessDesc')}</p>
      {error && <p className="text-xs font-medium text-[#8B4C2F]">{error}</p>}
      <PrimaryButton onClick={onRequestAccess} disabled={loading}>
        {loading ? t('auth.working') : t('foster.requestAccess')}
      </PrimaryButton>
    </div>
  );
}

export default function FosterTab() {
  const {
    t,
    lang,
    user,
    fosterCases,
    fosterHomeProfiles,
    fosterInvites,
    fosterApplications,
    submitFosterApplication,
    openFosterConversation,
    sendFosterInvite,
    openFosterInviteConversation,
    rescuerAccessState,
    setRescuerAccessState,
    requestRescuerAccess,
  } = useApp();

  const [section, setSection] = useState('animals');
  const [viewCase, setViewCase] = useState(null);
  const [viewHome, setViewHome] = useState(null);
  const [applyCase, setApplyCase] = useState(null);
  const [inviteHome, setInviteHome] = useState(null);
  const [applicationSuccess, setApplicationSuccess] = useState(false);
  const [applicationError, setApplicationError] = useState('');
  const [fosterNotice, setFosterNotice] = useState('');
  const [speciesFilter, setSpeciesFilter] = useState(null);
  const [urgencyFilter, setUrgencyFilter] = useState(false);
  const [homeSpeciesFilter, setHomeSpeciesFilter] = useState(null);
  const [availableOnly, setAvailableOnly] = useState(false);
  const [medicalCareOnly, setMedicalCareOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [accessLoading, setAccessLoading] = useState(false);
  const [accessError, setAccessError] = useState('');
  const [fosterFilters, setFosterFilters] = useState({
    county: null,
    citySearch: '',
    size: null,
    ageRange: null,
    breed: null,
  });

  const canManageFoster = rescuerAccessState === 'verified' || rescuerAccessState === 'demo_preview';

  const handleRequestAccess = async () => {
    setAccessLoading(true);
    setAccessError('');

    try {
      await requestRescuerAccess();
    } catch (error) {
      setAccessError(error.message || t('foster.requestAccessFailed'));
    } finally {
      setAccessLoading(false);
    }
  };

  const setChoiceFilter = (key, value) => {
    setFosterFilters(prev => ({ ...prev, [key]: prev[key] === value ? null : value }));
  };

  const resetFilters = () => {
    setSpeciesFilter(null);
    setUrgencyFilter(false);
    setFosterFilters({
      county: null,
      citySearch: '',
      size: null,
      ageRange: null,
      breed: null,
    });
  };

  const advancedFilterActive = Object.values(fosterFilters).some(value => Boolean(value));
  const fosterBreedOptions = speciesFilter === 'CAT'
    ? CAT_BREEDS
    : speciesFilter === 'DOG'
      ? DOG_BREEDS
      : Array.from(new Set([...DOG_BREEDS, ...CAT_BREEDS])).sort((a, b) => a.localeCompare(b));

  const filteredCases = fosterCases.filter(c => {
    if (speciesFilter && c.species !== speciesFilter) return false;
    if (urgencyFilter && c.urgency !== 'HIGH') return false;
    if (fosterFilters.size && c.sizeLabel !== fosterFilters.size) return false;
    if (fosterFilters.county && getCaseCounty(c) !== fosterFilters.county) return false;
    if (fosterFilters.breed && c.breed !== fosterFilters.breed) return false;
    if (fosterFilters.citySearch.trim()) {
      const search = fosterFilters.citySearch.trim().toLowerCase();
      const searchableLocation = `${c.city || ''} ${c.coarseArea || ''}`.toLowerCase();
      if (!searchableLocation.includes(search)) return false;
    }
    if (fosterFilters.ageRange === 'YOUNG' && c.ageMonths > 24) return false;
    if (fosterFilters.ageRange === 'ADULT' && (c.ageMonths < 24 || c.ageMonths > 84)) return false;
    if (fosterFilters.ageRange === 'SENIOR' && c.ageMonths < 84) return false;
    return c.status === 'ACTIVE';
  });

  const filteredHomes = fosterHomeProfiles.filter((profile) => {
    if (homeSpeciesFilter && !profile.acceptsSpecies.includes(homeSpeciesFilter)) return false;
    if (availableOnly && profile.availabilityStatus !== 'AVAILABLE') return false;
    if (medicalCareOnly && !profile.canHandleMedicalNeeds) return false;
    if (fosterFilters.county && getFosterHomeCounty(profile) !== fosterFilters.county) return false;
    if (fosterFilters.citySearch.trim()) {
      const search = fosterFilters.citySearch.trim().toLowerCase();
      const searchableLocation = `${profile.city || ''} ${profile.coarseArea || ''}`.toLowerCase();
      if (!searchableLocation.includes(search)) return false;
    }
    if (fosterFilters.size && !profile.acceptsSizes.includes(fosterFilters.size)) return false;
    return true;
  });

  const sections = [
    { key: 'animals', label: t('foster.animals') },
    { key: 'homes', label: t('foster.fosterHomes') },
    { key: 'myFoster', label: t('foster.myFoster') },
  ];

  if (viewCase && !applyCase) {
    return (
      <FosterCaseDetail
        fcase={viewCase}
        onClose={() => setViewCase(null)}
        onApply={() => setApplyCase(viewCase)}
        t={t}
        lang={lang}
      />
    );
  }

  if (viewHome && !inviteHome) {
    return (
      <FosterHomeDetail
        profile={viewHome}
        onClose={() => setViewHome(null)}
        onInvite={() => setInviteHome(viewHome)}
        onSave={() => {
          setFosterNotice(t('foster.savedFosterHome'));
          setTimeout(() => setFosterNotice(''), 2000);
        }}
        onRatingSaved={() => {
          setFosterNotice(t('foster.ratingSaved'));
          setTimeout(() => setFosterNotice(''), 2500);
        }}
        t={t}
        lang={lang}
      />
    );
  }

  if (applyCase) {
    return (
      <ApplicationFlow
        fcase={applyCase}
        onClose={() => setApplyCase(null)}
        onSubmit={async (formData) => {
          try {
            await submitFosterApplication(applyCase.id, formData);
            setApplicationError('');
            setApplyCase(null);
            setViewCase(null);
            setApplicationSuccess(true);
            setTimeout(() => setApplicationSuccess(false), 3000);
            setSection('myFoster');
          } catch (error) {
            setApplicationError(error.message || t('foster.validationRequired'));
            setApplyCase(null);
            setViewCase(null);
            setSection('myFoster');
          }
        }}
        t={t}
      />
    );
  }

  if (inviteHome) {
    return (
      <InviteFlow
        profile={inviteHome}
        fosterCases={fosterCases}
        onClose={() => setInviteHome(null)}
        onSubmit={({ fosterCaseId, fosterHomeProfileId, message }) => {
          sendFosterInvite({ fosterCaseId, fosterHomeProfileId, message });
          setInviteHome(null);
          setViewHome(null);
          setFosterNotice(t('foster.inviteSent'));
          setTimeout(() => setFosterNotice(''), 3000);
          setSection('myFoster');
        }}
        t={t}
      />
    );
  }

  return (
    <div data-testid="foster-tab" className="flex-1 flex flex-col relative">
      <div className="px-5 pt-4 pb-3 bg-[#F8F7F4]">
        <h1 className="text-2xl font-bold text-[#1F2924] tracking-tight font-heading mb-1">{t('foster.title')}</h1>
        <div className="mb-3 rounded-2xl border border-[#E4E2DC] bg-white/80 p-3.5 shadow-sm">
          <h2 className="text-sm font-semibold text-[#1F2924] font-heading">{t('foster.networkTitle')}</h2>
          <p className="mt-1 text-xs leading-relaxed text-[#57645C]">{t('foster.networkAnimalsLine')}</p>
          <p className="text-xs leading-relaxed text-[#57645C]">{t('foster.networkHomesLine')}</p>
          <p className="mt-2 text-xs font-semibold text-[#2C402B]">{t('foster.chooseNeed')}</p>
        </div>

        <div className="flex gap-1 bg-[#EFEDE8] rounded-xl p-1">
          {sections.map(s => (
            <button
              type="button"
              key={s.key}
              data-testid={`foster-section-${s.key}`}
              onClick={() => setSection(s.key)}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                section === s.key ? 'bg-white text-[#1F2924] shadow-sm' : 'text-[#57645C]'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar pb-20">
        {section === 'animals' && (
          <div className="px-5 pt-3 space-y-3">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-[#1F2924]">{t('foster.animalsNeedHelp')}</p>
              <p className="text-sm leading-relaxed text-[#57645C]">{t('foster.animalsSubtitle')}</p>
              <p className="text-xs font-medium text-[#2C402B]">{t('foster.animalsRule')}</p>
            </div>

            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
              <Chip label={t('matches.dogs')} active={speciesFilter === 'DOG'} onClick={() => setSpeciesFilter(speciesFilter === 'DOG' ? null : 'DOG')} icon={Dog} />
              <Chip label={t('matches.cats')} active={speciesFilter === 'CAT'} onClick={() => setSpeciesFilter(speciesFilter === 'CAT' ? null : 'CAT')} icon={Cat} />
              <Chip label={t('foster.urgent')} active={urgencyFilter} onClick={() => setUrgencyFilter(!urgencyFilter)} icon={AlertTriangle} />
              <Chip label={t('matches.filters')} active={advancedFilterActive} onClick={() => setShowFilters(true)} icon={Filter} />
            </div>

            {fosterNotice && (
              <div className="bg-[#D4EDDA] rounded-2xl p-4 border border-[#C3E6CB] animate-scaleIn">
                <p className="text-sm font-semibold text-[#2C5E3F]">{fosterNotice}</p>
              </div>
            )}

            <div className="space-y-3">
              {filteredCases.map(fc => (
                <FosterCaseCard
                  key={fc.id}
                  fcase={fc}
                  onView={() => setViewCase(fc)}
                  onSave={() => {
                    setFosterNotice(t('foster.savedCase'));
                    setTimeout(() => setFosterNotice(''), 2000);
                  }}
                  t={t}
                  lang={lang}
                />
              ))}
            </div>
          </div>
        )}

        {section === 'homes' && (
          <div className="px-5 pt-3 space-y-3">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-[#1F2924]">{t('foster.fosterHomes')}</p>
              <p className="text-sm leading-relaxed text-[#57645C]">{t('foster.homesSubtitle')}</p>
              <p className="text-xs font-medium text-[#2C402B]">{t('foster.homesRule')}</p>
            </div>

            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
              <Chip label={t('matches.dogs')} active={homeSpeciesFilter === 'DOG'} onClick={() => setHomeSpeciesFilter(homeSpeciesFilter === 'DOG' ? null : 'DOG')} icon={Dog} />
              <Chip label={t('matches.cats')} active={homeSpeciesFilter === 'CAT'} onClick={() => setHomeSpeciesFilter(homeSpeciesFilter === 'CAT' ? null : 'CAT')} icon={Cat} />
              <Chip label={t('foster.available')} active={availableOnly} onClick={() => setAvailableOnly(!availableOnly)} icon={CheckCircle2} />
              <Chip label={t('foster.medicalCare')} active={medicalCareOnly} onClick={() => setMedicalCareOnly(!medicalCareOnly)} icon={ShieldCheck} />
            </div>

            {fosterNotice && (
              <div className="bg-[#D4EDDA] rounded-2xl p-4 border border-[#C3E6CB] animate-scaleIn">
                <p className="text-sm font-semibold text-[#2C5E3F]">{fosterNotice}</p>
              </div>
            )}

            <div className="space-y-3">
              {filteredHomes.map((profile) => (
                <FosterHomeCard
                  key={profile.id}
                  profile={profile}
                  onView={() => setViewHome(profile)}
                  onInvite={() => setInviteHome(profile)}
                  onSave={() => {
                    setFosterNotice(t('foster.savedFosterHome'));
                    setTimeout(() => setFosterNotice(''), 2000);
                  }}
                  t={t}
                  lang={lang}
                />
              ))}
            </div>
          </div>
        )}

        {section === 'myFoster' && (
          <>
            {(applicationError || applicationSuccess || fosterNotice) && (
              <div className="px-5 pt-3 space-y-2">
                {applicationError && (
                  <div className="bg-[#F5DDD0] rounded-2xl p-4 border border-[#E8C3AF] animate-scaleIn">
                    <p className="text-sm font-semibold text-[#8B4C2F]">{applicationError}</p>
                  </div>
                )}
                {applicationSuccess && (
                  <div className="bg-[#D4EDDA] rounded-2xl p-4 border border-[#C3E6CB] animate-scaleIn">
                    <p className="text-sm font-semibold text-[#2C5E3F]">{t('foster.applicationSent')}</p>
                    <p className="text-xs text-[#2C5E3F]/80 mt-1">{t('foster.applicationSentDesc')}</p>
                  </div>
                )}
                {fosterNotice && (
                  <div className="bg-[#D4EDDA] rounded-2xl p-4 border border-[#C3E6CB] animate-scaleIn">
                    <p className="text-sm font-semibold text-[#2C5E3F]">{fosterNotice}</p>
                  </div>
                )}
              </div>
            )}
            <MyFosterDashboard
              t={t}
              lang={lang}
              user={user}
              fosterHomeProfiles={fosterHomeProfiles}
              fosterApplications={fosterApplications}
              fosterInvites={fosterInvites}
              fosterCases={fosterCases}
              canManageFoster={canManageFoster}
              rescuerAccessState={rescuerAccessState}
              accessLoading={accessLoading}
              accessError={accessError}
              onRequestAccess={handleRequestAccess}
              onDemoPreview={() => {
                setRescuerAccessState('demo_preview');
                setSection('myFoster');
              }}
              onOpenApplicationMessages={openFosterConversation}
              onOpenInviteMessages={openFosterInviteConversation}
              onEditProfile={() => {
                setFosterNotice(t('foster.editFosterProfileNotice'));
                setTimeout(() => setFosterNotice(''), 2500);
              }}
              onPostCase={() => {
                setFosterNotice(t('foster.postCaseNotice'));
                setTimeout(() => setFosterNotice(''), 2500);
              }}
            />
          </>
        )}
      </div>

      <FilterSheet open={showFilters} onClose={() => setShowFilters(false)} title={t('matches.filters')}>
        <FilterSelect
          label={t('foster.county')}
          value={fosterFilters.county}
          onChange={(value) => setChoiceFilter('county', value)}
          options={ROMANIAN_COUNTIES}
          emptyLabel={t('foster.anyCounty')}
        />

        <FilterInput
          label={t('foster.city')}
          value={fosterFilters.citySearch}
          onChange={(value) => setFosterFilters(prev => ({ ...prev, citySearch: value }))}
          placeholder={t('foster.cityPlaceholder')}
        />

        <FilterGroup title={t('matches.age')}>
          {[
            ['YOUNG', t('foster.young')],
            ['ADULT', t('foster.adult')],
            ['SENIOR', t('foster.senior')],
          ].map(([value, label]) => (
            <FilterPill key={value} active={fosterFilters.ageRange === value} onClick={() => setChoiceFilter('ageRange', value)}>
              {label}
            </FilterPill>
          ))}
        </FilterGroup>

        <FilterGroup title={t('matches.size')}>
          {['SMALL', 'MEDIUM', 'LARGE'].map(size => (
            <FilterPill key={size} active={fosterFilters.size === size} onClick={() => setChoiceFilter('size', size)}>
              {getSizeLabel(size, t)}
            </FilterPill>
          ))}
        </FilterGroup>

        <FilterSelect
          label={t('matches.breed')}
          value={fosterFilters.breed}
          onChange={(value) => setChoiceFilter('breed', value)}
          options={fosterBreedOptions}
          emptyLabel={t('matches.anyBreed')}
        />

        <div className="flex gap-3 pt-2">
          <SecondaryButton onClick={resetFilters}>{t('foster.reset')}</SecondaryButton>
          <PrimaryButton onClick={() => setShowFilters(false)}>{t('foster.saveFilters')}</PrimaryButton>
        </div>
      </FilterSheet>
    </div>
  );
}
