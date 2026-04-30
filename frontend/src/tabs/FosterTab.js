import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { DOG_BREEDS, CAT_BREEDS } from '../data/breeds';
import { formatDuration } from '../data/mockData';
import {
  Badge, Chip, PrimaryButton, SecondaryButton, ScreenHeader, EmptyState,
  PrivacyNote, UrgencyBadge, CoverageChips, FilterSheet, DemoBanner
} from '../components/SharedComponents';
import {
  Clock, MapPin, ShieldCheck, CheckCircle2, XCircle,
  AlertTriangle, Bookmark, ChevronRight, Dog, Cat, Filter, FileText,
  Home, Briefcase, Calendar, Users, ClipboardList, Plus, Eye
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

function ManageDashboard({ t, isDemoMode, fosterCases, applications }) {
  const activeCases = fosterCases.filter(item => item.status === 'ACTIVE').length;
  const newApplications = applications.filter(item => item.status === 'SUBMITTED' || item.status === 'IN_REVIEW').length;
  const urgentCases = fosterCases.filter(item => item.status === 'ACTIVE' && item.urgency === 'HIGH').length;

  return (
    <div data-testid="foster-manage-dashboard" className="space-y-4 px-5 pt-4 pb-8">
      {isDemoMode && <DemoBanner text={t('foster.demoBanner')} />}

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: t('foster.activeCases'), value: activeCases, color: 'bg-[#E3ECE4] text-[#2C402B]' },
          { label: t('foster.newApplications'), value: newApplications, color: 'bg-[#D8EAF0] text-[#3A7080]' },
          { label: t('foster.urgentCases'), value: urgentCases, color: 'bg-[#F5DDD0] text-[#8B4C2F]' },
        ].map(s => (
          <div key={s.label} className={`${s.color} rounded-2xl p-3 text-center`}>
            <div className="text-2xl font-bold font-heading">{s.value}</div>
            <div className="text-xs font-medium mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        {[
          { label: t('foster.addCase'), icon: Plus },
          { label: t('foster.reviewApps'), icon: ClipboardList },
        ].map(item => (
          <button type="button" key={item.label} className="w-full flex items-center gap-3 bg-white rounded-2xl p-4 border border-[#E4E2DC] hover:bg-[#FAFAF8] transition-colors">
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
  const { t, lang, fosterCases, fosterApplications, submitFosterApplication, openFosterConversation, rescuerAccessState, setRescuerAccessState, requestRescuerAccess } = useApp();

  const [section, setSection] = useState('find');
  const [viewCase, setViewCase] = useState(null);
  const [applyCase, setApplyCase] = useState(null);
  const [applicationSuccess, setApplicationSuccess] = useState(false);
  const [applicationError, setApplicationError] = useState('');
  const [fosterNotice, setFosterNotice] = useState('');
  const [speciesFilter, setSpeciesFilter] = useState(null);
  const [urgencyFilter, setUrgencyFilter] = useState(false);
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
  const visibleSection = !canManageFoster && section === 'manage' ? 'find' : section;

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

  const sections = [
    { key: 'find', label: t('foster.find') },
    { key: 'requests', label: t('foster.myRequests') },
    ...(canManageFoster ? [{ key: 'manage', label: t('foster.manage') }] : []),
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
            setSection('requests');
          } catch (error) {
            setApplicationError(error.message || t('foster.validationRequired'));
            setApplyCase(null);
            setViewCase(null);
            setSection('requests');
          }
        }}
        t={t}
      />
    );
  }

  return (
    <div data-testid="foster-tab" className="flex-1 flex flex-col relative">
      <div className="px-5 pt-4 pb-3 bg-[#F8F7F4]">
        <h1 className="text-2xl font-bold text-[#1F2924] tracking-tight font-heading mb-3">{t('foster.title')}</h1>

        <div className="flex gap-1 bg-[#EFEDE8] rounded-xl p-1">
          {sections.map(s => (
            <button
              type="button"
              key={s.key}
              data-testid={`foster-section-${s.key}`}
              onClick={() => setSection(s.key)}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                visibleSection === s.key ? 'bg-white text-[#1F2924] shadow-sm' : 'text-[#57645C]'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar pb-20">
        {visibleSection === 'find' && (
          <div className="px-5 pt-3 space-y-3">
            <p className="text-sm text-[#57645C]">{t('foster.animalsNeedHelp')}</p>

            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
              <Chip label={t('matches.dogs')} active={speciesFilter === 'DOG'} onClick={() => setSpeciesFilter(speciesFilter === 'DOG' ? null : 'DOG')} icon={Dog} />
              <Chip label={t('matches.cats')} active={speciesFilter === 'CAT'} onClick={() => setSpeciesFilter(speciesFilter === 'CAT' ? null : 'CAT')} icon={Cat} />
              <Chip label={t('foster.urgent')} active={urgencyFilter} onClick={() => setUrgencyFilter(!urgencyFilter)} icon={AlertTriangle} />
              <Chip label={t('matches.filters')} active={advancedFilterActive} onClick={() => setShowFilters(true)} icon={Filter} />
            </div>

            <div className="space-y-3">
              {fosterNotice && (
                <div className="bg-[#D4EDDA] rounded-2xl p-4 border border-[#C3E6CB] animate-scaleIn">
                  <p className="text-sm font-semibold text-[#2C5E3F]">{fosterNotice}</p>
                </div>
              )}
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

            {!canManageFoster && (
              <RescuerAccessCard
                state={rescuerAccessState}
                loading={accessLoading}
                error={accessError}
                onRequestAccess={handleRequestAccess}
                onDemoPreview={() => {
                  setRescuerAccessState('demo_preview');
                  setSection('manage');
                }}
                t={t}
              />
            )}
          </div>
        )}

        {visibleSection === 'requests' && (
          <div className="px-5 pt-3 space-y-3">
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
            {fosterApplications.length === 0 ? (
              <EmptyState
                icon={FileText}
                title={t('foster.noRequests')}
                description={t('foster.noRequestsDesc')}
              />
            ) : (
              fosterApplications.map(app => (
                <ApplicationCard key={app.id} app={app} t={t} onOpenMessages={openFosterConversation} />
              ))
            )}

            {!canManageFoster && (
              <RescuerAccessCard
                state={rescuerAccessState}
                loading={accessLoading}
                error={accessError}
                onRequestAccess={handleRequestAccess}
                onDemoPreview={() => {
                  setRescuerAccessState('demo_preview');
                  setSection('manage');
                }}
                t={t}
              />
            )}
          </div>
        )}

        {visibleSection === 'manage' && canManageFoster && (
          <ManageDashboard
            t={t}
            isDemoMode={rescuerAccessState === 'demo_preview'}
            fosterCases={fosterCases}
            applications={fosterApplications}
          />
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
