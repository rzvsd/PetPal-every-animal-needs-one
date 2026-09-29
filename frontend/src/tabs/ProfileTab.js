import PlatformAdminEntry from '../components/PlatformAdmin';
import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useApp } from '../context/AppContext';
import { friendlyError } from '../services/errors';
import { deleteSupabaseAccount, exportSupabaseData, loadSupabaseDeletionBlockers } from '../services/supabaseApi';
import { useBackHandler } from '../navigation/backNavigation';
import { motionSpring, SavedCheck, useReducedPetMotion } from '../components/Motion';
import { useDiscardGuard } from '../components/FormGuard';
import {
  Badge, SecondaryButton, ScreenHeader, EmptyState, PrivacyNote,
  Modal, PrimaryButton
} from '../components/SharedComponents';
import {
  User, Dog, Cat, Shield, MapPin, Lock, CheckCircle2, Circle,
  ChevronRight, Edit3, Plus, Settings, Bell, HelpCircle,
  FileText, Trash2, EyeOff, Heart, Home, AlertTriangle, Languages, LogOut
} from 'lucide-react';

function AnimalCard({
  animal,
  t,
  onEditAnimal = () => {},
  onMatchSettings = () => {},
  onDeleteAnimal = () => {},
  showMatchDetails = true,
  justCompleted = false,
}) {
  const reducedMotion = useReducedPetMotion();
  const modeLabels = {
    PLAY: t('matches.play'),
    SOCIAL: t('matches.social'),
  };

  return (
    <motion.div data-testid={`animal-card-${animal.id}`} className="overflow-hidden rounded-2xl border border-[#E4E2DC] bg-white shadow-sm"
      initial={reducedMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={reducedMotion ? { duration: 0 } : motionSpring}>
      <div className="flex">
        <div className="w-24 h-28 flex-shrink-0">
          {animal.photoUrls?.[0] ? (
            <img src={animal.photoUrls[0]} alt={animal.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-[#E3ECE4] flex items-center justify-center">
              {animal.species === 'CAT' ? <Cat size={28} className="text-[#9BAE96]" /> : <Dog size={28} className="text-[#9BAE96]" />}
            </div>
          )}
        </div>
        <div className="flex-1 p-3.5 space-y-1.5">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-base font-semibold text-[#1F2924] font-heading">{animal.name}</h3>
              <p className="text-xs text-[#57645C]">
                {getSpeciesLabel(animal.species, t)} - {animal.breed === 'Unknown' ? t('common.unknown') : animal.breed || '—'} - {getSexLabel(animal.sex, t)} - {formatProfileAge(animal.ageMonths, t)}
              </p>
            </div>
          </div>
          {showMatchDetails && (
            <div className="flex flex-wrap gap-1">
              {(animal.activeMatchModes || []).filter(mode => modeLabels[mode]).map(m => (
                <Badge key={m} variant="default">
                  {modeLabels[m]}
                </Badge>
              ))}
            </div>
          )}
          <AnimalChecklist animal={animal} t={t} justCompleted={justCompleted} onEdit={() => onEditAnimal(animal)} />
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => onEditAnimal(animal)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F8F7F4] border border-[#E4E2DC] text-xs font-medium text-[#57645C] hover:bg-[#EFEDE8] transition-colors"
            >
              <Edit3 size={12} />{t('profile.editAnimal')}
            </button>
            {showMatchDetails && (
              <button
                type="button"
                onClick={() => onMatchSettings(animal)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F8F7F4] border border-[#E4E2DC] text-xs font-medium text-[#57645C] hover:bg-[#EFEDE8] transition-colors"
              >
                <Settings size={12} />{t('profile.matchSettings')}
              </button>
            )}
            <button
              type="button"
              onClick={() => onDeleteAnimal(animal)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F5D5D8] border border-[#F0BEC3] text-xs font-medium text-[#9A4A4F] hover:bg-[#EFC4C9] transition-colors"
            >
              <Trash2 size={12} />{t('profile.deleteAnimal')}
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function SectionItem({ icon: Icon, label, badge, danger, onClick }) {
  return (
    <button
      type="button"
      data-testid={`profile-section-${label?.toLowerCase().replace(/\s/g, '-')}`}
      onClick={onClick}
      className="w-full flex items-center gap-3.5 py-3.5 px-1 border-b border-[#E4E2DC]/50 last:border-0 hover:bg-[#FAFAF8] transition-colors rounded-lg"
    >
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${danger ? 'bg-[#F5D5D8]' : 'bg-[#E3ECE4]'}`}>
        <Icon size={17} className={danger ? 'text-[#CD7A7E]' : 'text-[#2C402B]'} />
      </div>
      <span className={`text-sm font-medium flex-1 text-left ${danger ? 'text-[#CD7A7E]' : 'text-[#1F2924]'}`}>{label}</span>
      {badge && <span className="text-xs text-[#57645C] bg-[#E8E6E1] px-2 py-0.5 rounded-full">{badge}</span>}
      <ChevronRight size={16} className="text-[#57645C]" />
    </button>
  );
}

function NoticeBanner({ message }) {
  if (!message) return null;

  return (
    <div data-testid="profile-prototype-notice" className="flex items-start gap-2.5 rounded-2xl border border-[#E8C3AF] bg-[#F5DDD0] px-4 py-3 text-sm text-[#8B4C2F]">
      <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
      <span>{message}</span>
    </div>
  );
}

function Checklist({ checks, t, justCompleted = false, onEdit }) {
  const complete = checks.filter(([, answered]) => answered).length;
  const summary = t('profile.checklistComplete')
    .replace('{count}', String(complete))
    .replace('{total}', String(checks.length));

  return (
    <details className="mt-2 rounded-xl border border-[#E4E2DC] bg-[#F8F7F4] px-3">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-xs font-semibold text-[#2C402B]">
        <span>{t('profile.checklistTitle')}</span><span className="flex items-center gap-1">{justCompleted && <SavedCheck />}{summary}</span>
      </summary>
      <div className="space-y-2 border-t border-[#E4E2DC]/70 pb-3 pt-3">
        {checks.map(([label, answered]) => (
          <div key={label} className="flex items-center gap-2 text-xs text-[#57645C]">
            {answered ? <CheckCircle2 size={14} className="text-[#2C402B]" /> : <Circle size={14} className="text-[#9BAE96]" />}
            {answered ? <span>{label}</span> : <button type="button" onClick={onEdit} className="text-left underline underline-offset-2">{label}</button>}
          </div>
        ))}
        <p className="pt-1 text-[11px] leading-relaxed text-[#57645C]">{t('profile.checklistHint')}</p>
      </div>
    </details>
  );
}

function OwnerChecklist({ user, t, justCompleted, onEdit }) {
  return <Checklist t={t} justCompleted={justCompleted} onEdit={onEdit} checks={[
    [t('profile.checklistName'), Boolean(user.displayName?.trim())],
    [t('profile.checklistCity'), Boolean(user.city?.trim())],
  ]} />;
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

function AnimalChecklist({ animal, t, justCompleted, onEdit }) {
  return <Checklist t={t} checks={animalBasicChecks(animal, t)} justCompleted={justCompleted} onEdit={onEdit} />;
}

function useDraftDirty(draft) {
  const initial = useRef('');
  useEffect(() => {
    if (!draft) { initial.current = ''; return; }
    if (!initial.current) initial.current = JSON.stringify(draft);
  }, [draft]);
  return Boolean(draft && initial.current && initial.current !== JSON.stringify(draft));
}

function FormField({ label, value, onChange, type = 'text', placeholder = '' }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-semibold uppercase tracking-wider text-[#57645C]">{label}</span>
      <input
        type={type}
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-[#E4E2DC] bg-[#F8F7F4] px-3.5 py-3 text-sm text-[#1F2924] outline-none transition-colors focus:border-[#9BAE96] focus:bg-white"
      />
    </label>
  );
}

function SelectField({ label, value, onChange, options }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-semibold uppercase tracking-wider text-[#57645C]">{label}</span>
      <select
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-[#E4E2DC] bg-[#F8F7F4] px-3.5 py-3 text-sm text-[#1F2924] outline-none transition-colors focus:border-[#9BAE96] focus:bg-white"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}

function ProfileEditModal({ draft, t, onChange, onClose, onSave, busy = false, error }) {
  const dirty = useDraftDirty(draft);
  const { requestClose, discardDialog } = useDiscardGuard({ dirty, busy, onClose });

  return (
    <>
      <Modal open={Boolean(draft)} onClose={requestClose}>
      {draft && (
        <div className="p-5 space-y-4">
          <div>
            <h2 className="text-lg font-bold text-[#1F2924] font-heading">{t('profile.editProfileTitle')}</h2>
            <p className="text-xs text-[#57645C] mt-1">{t('profile.editProfileDesc')}</p>
          </div>
          <fieldset disabled={busy} className="space-y-3">
            <FormField label={t('profile.displayName')} value={draft.displayName} onChange={(value) => onChange({ displayName: value })} />
            <FormField label={t('profile.city')} value={draft.city} onChange={(value) => onChange({ city: value })} />
            <FormField label={t('profile.coarseArea')} value={draft.coarseArea} onChange={(value) => onChange({ coarseArea: value })} />
          </fieldset>
          {error && <p role="alert" className="text-sm text-[#9B4650]">{error}</p>}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <SecondaryButton onClick={requestClose} disabled={busy}>{t('common.cancel')}</SecondaryButton>
            <PrimaryButton onClick={onSave} disabled={busy}>{t(busy ? 'common.loading' : 'profile.saveChanges')}</PrimaryButton>
          </div>
        </div>
      )}
      </Modal>
      {discardDialog}
    </>
  );
}

function AnimalEditModal({ draft, t, onChange, onClose, onSave, busy = false, error }) {
  const previewUrl = draft?.photoPreviewUrl || draft?.photoUrls?.[0] || null;
  const localPreview = draft?.photoPreviewUrl;
  useEffect(() => () => { if (localPreview) URL.revokeObjectURL(localPreview); }, [localPreview]);
  const reduced = useReducedPetMotion();
  const dirty = useDraftDirty(draft);
  const { requestClose, discardDialog } = useDiscardGuard({ dirty, busy, onClose });

  return (
    <>
      <Modal open={Boolean(draft)} onClose={requestClose}>
      {draft && (
        <div className="p-5 space-y-4">
          <div>
            <h2 className="text-lg font-bold text-[#1F2924] font-heading">{t('profile.editAnimalTitle')}</h2>
            <p className="text-xs text-[#57645C] mt-1">{t('profile.editAnimalDesc')}</p>
          </div>
          <fieldset disabled={busy} className="space-y-3">
            <div className="flex items-center gap-4 rounded-2xl border border-[#E4E2DC] bg-[#F8F7F4] p-3">
              <div className="w-20 h-20 overflow-hidden rounded-2xl bg-[#E3ECE4] flex items-center justify-center">
                {previewUrl ? (
                  <motion.img key={previewUrl} initial={reduced ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }} src={previewUrl} alt={draft.name || t('profile.photo')} className="h-full w-full object-cover" />
                ) : draft.species === 'CAT' ? (
                  <Cat size={28} className="text-[#9BAE96]" />
                ) : (
                  <Dog size={28} className="text-[#9BAE96]" />
                )}
              </div>
              <div className="flex-1 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-[#57645C]">{t('profile.photo')}</p>
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-[#E4E2DC] bg-white px-3 py-2 text-xs font-semibold text-[#2C402B] hover:bg-[#EFEDE8]">
                  <Plus size={13} />
                  {previewUrl ? t('profile.replacePhoto') : t('profile.choosePhoto')}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (!file) return;
                      onChange({
                        photoFile: file,
                        photoPreviewUrl: URL.createObjectURL(file),
                      });
                    }}
                  />
                </label>
              </div>
            </div>
            <FormField label={t('profile.name')} value={draft.name} onChange={(value) => onChange({ name: value })} />
            <fieldset className="space-y-2"><legend className="font-semibold text-sm">{t('profile.matchSettings')}</legend>
              {[['PLAY', 'matches.play'], ['SOCIAL', 'matches.social']].map(([mode, label]) =>
                <label key={mode} className="flex items-center gap-2 min-h-11 text-sm"><input type="checkbox" checked={draft.activeMatchModes?.includes(mode) || false}
                  onChange={event => onChange({ activeMatchModes: event.target.checked ? [...(draft.activeMatchModes || []), mode] : draft.activeMatchModes.filter(value => value !== mode) })} />{t(label)}</label>)}
            </fieldset>
            <SelectField
              label={t('profile.species')}
              value={draft.species}
              onChange={(value) => onChange({ species: value })}
              options={[
                { value: 'DOG', label: t('common.dog') },
                { value: 'CAT', label: t('common.cat') },
              ]}
            />
            <div className="flex items-end gap-2">
              <div className="min-w-0 flex-1"><FormField label={t('profile.breed')} value={draft.breed} onChange={(value) => onChange({ breed: value })} /></div>
              <button type="button" data-testid="breed-unknown" className="mb-0.5 min-h-11 shrink-0 rounded-xl border border-[#E4E2DC] bg-white px-3 text-xs font-semibold text-[#57645C]"
                onClick={() => onChange({ breed: 'Unknown' })}>{t('common.unknown')}</button>
            </div>
            <SelectField
              label={t('profile.sex')}
              value={draft.sex}
              onChange={(value) => onChange({ sex: value })}
              options={[
                { value: 'UNKNOWN', label: t('common.unknown') },
                { value: 'MALE', label: t('common.male') },
                { value: 'FEMALE', label: t('common.female') },
              ]}
            />
            <FormField
              label={t('profile.ageMonths')}
              type="number"
              value={draft.ageMonths}
              onChange={(value) => onChange({ ageMonths: value })}
            />
            <SelectField
              label={t('profile.size')}
              value={draft.sizeLabel}
              onChange={(value) => onChange({ sizeLabel: value })}
              options={[
                { value: 'SMALL', label: t('common.small') },
                { value: 'MEDIUM', label: t('common.medium') },
                { value: 'LARGE', label: t('common.large') },
              ]}
            />
          </fieldset>
          {localPreview && <p className="text-xs text-[#57645C]">{t('motion.photoPreview')}</p>}
          {error && <p role="alert" className="text-sm text-[#9B4650]">{error}</p>}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <SecondaryButton onClick={requestClose} disabled={busy}>{t('common.cancel')}</SecondaryButton>
            <PrimaryButton onClick={onSave} disabled={busy}>{t(busy ? 'common.loading' : 'profile.saveChanges')}</PrimaryButton>
          </div>
        </div>
      )}
      </Modal>
      {discardDialog}
    </>
  );
}

function DeleteAnimalModal({ animal, t, onClose, onDelete }) {
  return (
    <Modal open={Boolean(animal)} onClose={onClose}>
      {animal && (
        <div className="p-5 space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-[#F5D5D8] flex items-center justify-center">
            <Trash2 size={22} className="text-[#CD7A7E]" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#1F2924] font-heading">{t('profile.deleteAnimalTitle')}</h2>
            <p className="text-sm text-[#57645C] mt-1">
              {t('profile.deleteAnimalDesc').replace('{animalName}', animal.name)}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 pt-1">
            <SecondaryButton onClick={onClose}>{t('common.cancel')}</SecondaryButton>
            <PrimaryButton
              onClick={onDelete}
              className="bg-[#8F343D] hover:bg-[#7A2B33]"
            >
              {t('profile.deleteAnimal')}
            </PrimaryButton>
          </div>
        </div>
      )}
    </Modal>
  );
}

function getSpeciesLabel(species, t) {
  if (species === 'DOG') return t('common.dog');
  if (species === 'CAT') return t('common.cat');
  return t('common.unknown');
}

function getSexLabel(sex, t) {
  if (sex === 'MALE') return t('common.male');
  if (sex === 'FEMALE') return t('common.female');
  return t('common.unknown');
}

function formatProfileAge(months, t) {
  if (months == null || months === '') return t('common.unknown');
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

function getRoleLabel(role, t) {
  const roleLabels = {
    OWNER: t('profile.roleOwner'),
    FOSTER_VOLUNTEER: t('profile.roleFosterVolunteer'),
    RESCUER: t('profile.roleRescuer'),
    SHELTER_MEMBER: t('profile.roleShelterMember'),
  };

  return roleLabels[role] || role;
}

function PreferenceDetailScreen({ title, description, rows, notice, t, onBack }) {
  return (
    <div className="flex-1 flex flex-col">
      <ScreenHeader title={title} onBack={onBack} />
      <div className="min-h-0 flex-1 overflow-y-auto no-scrollbar px-5 pt-4 pb-20 space-y-4">
        <div className="rounded-2xl border border-[#E4E2DC] bg-white p-4">
          <p className="text-sm leading-relaxed text-[#57645C]">{description}</p>
        </div>
        <div className="rounded-2xl border border-[#E4E2DC] bg-white p-4 shadow-sm">
          {rows.map(([label, value]) => (
            <div key={label} className="flex items-start justify-between gap-4 border-b border-[#E4E2DC]/50 py-3 first:pt-0 last:border-0 last:pb-0">
              <span className="text-sm text-[#57645C]">{label}</span>
              <span className="max-w-[55%] text-right text-sm font-semibold text-[#1F2924]">{value}</span>
            </div>
          ))}
        </div>
        <NoticeBanner message={notice} />
        <SecondaryButton onClick={onBack}>{t('common.back')}</SecondaryButton>
      </div>
    </div>
  );
}

function ToggleRow({ label, description, enabled, onToggle, t, disabled = false }) {
  const reduced = useReducedPetMotion();
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      className={`flex w-full items-center justify-between gap-4 border-b border-[#E4E2DC]/50 py-3 first:pt-0 last:border-0 last:pb-0 ${disabled ? 'cursor-wait opacity-60' : ''}`}
      aria-pressed={enabled}
    >
      <div className="text-left">
        <span className="block text-sm font-semibold text-[#1F2924]">{label}</span>
        {description && <span className="mt-0.5 block text-xs leading-relaxed text-[#57645C]">{description}</span>}
      </div>
      <span className={`relative h-7 w-12 flex-shrink-0 rounded-full transition-colors ${enabled ? 'bg-[#2C402B]' : 'bg-[#D8D4CC]'}`}>
        <motion.span className="absolute left-0 top-1 h-5 w-5 rounded-full bg-white shadow-sm" initial={false}
          animate={{ x: enabled ? 24 : 4 }} transition={reduced ? { duration: 0 } : motionSpring} />
      </span>
      <span className="sr-only">{enabled ? t('profile.enabled') : t('profile.disabled')}</span>
    </button>
  );
}

function NotificationPreferenceScreen({ prefs, onToggle, t, onBack, environment, reduceMotion, onReduceMotionToggle,
  showTypingActivity, onTypingToggle, typingBusy, preferenceError }) {
  const rows = [
    ['push', t('profile.pushNotifications'), t('profile.pushNotificationsDesc')],
    environment === 'foster'
      ? ['foster', t('profile.fosterUpdates'), t('profile.fosterUpdatesDesc')]
      : ['matches', t('profile.matchUpdates'), t('profile.matchUpdatesDesc')],
    ['safety', t('profile.safetyUpdates'), t('profile.safetyUpdatesDesc')],
  ];

  return (
    <div className="flex-1 flex flex-col">
      <ScreenHeader title={t('motion.preferences')} onBack={onBack} />
      <div className="min-h-0 flex-1 overflow-y-auto no-scrollbar px-5 pt-4 pb-20 space-y-4">
        <div className="rounded-2xl border border-[#E4E2DC] bg-white p-4">
          <p className="text-sm leading-relaxed text-[#57645C]">{t('profile.notificationPreferencesDesc')}</p>
        </div>
        <div className="rounded-2xl border border-[#E4E2DC] bg-white p-4 shadow-sm">
          <ToggleRow
            label={t('motion.reduceMotion')}
            description={t('motion.reduceMotionDescription')}
            enabled={reduceMotion}
            onToggle={onReduceMotionToggle}
            t={t}
          />
          <ToggleRow
            label={t('motion.shareTyping')}
            description={t('motion.shareTypingDescription')}
            enabled={showTypingActivity}
            onToggle={onTypingToggle}
            disabled={typingBusy}
            t={t}
          />
          {rows.map(([key, label, description]) => (
            <ToggleRow
              key={key}
              label={label}
              description={description}
              enabled={Boolean(prefs[key])}
              onToggle={() => onToggle(key)}
              t={t}
            />
          ))}
        </div>
        <NoticeBanner message={preferenceError} />
        <NoticeBanner message={t('profile.notificationPreferencesNotice')} />
        <SecondaryButton onClick={onBack}>{t('common.back')}</SecondaryButton>
      </div>
    </div>
  );
}

function InfoDetailScreen({ title, intro, bullets, note, primaryLabel, onPrimary, t, onBack }) {
  return (
    <div className="flex-1 flex flex-col">
      <ScreenHeader title={title} onBack={onBack} />
      <div className="min-h-0 flex-1 overflow-y-auto no-scrollbar px-5 pt-4 pb-20 space-y-4">
        <div className="rounded-2xl border border-[#E4E2DC] bg-white p-4 shadow-sm">
          <p className="text-sm leading-relaxed text-[#57645C]">{intro}</p>
          <div className="mt-4 space-y-2.5">
            {bullets.map((item) => (
              <div key={item} className="flex items-start gap-2.5 text-sm leading-relaxed text-[#1F2924]">
                <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0 text-[#9BAE96]" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
        {note && <PrivacyNote text={note} />}
        {primaryLabel && <PrimaryButton onClick={onPrimary}>{primaryLabel}</PrimaryButton>}
        <SecondaryButton onClick={onBack}>{t('common.back')}</SecondaryButton>
      </div>
    </div>
  );
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

  return (
    <div className="flex-1 flex flex-col">
      <ScreenHeader title={t('profile.deleteAccount')} onBack={onBack} />
      <div className="min-h-0 flex-1 overflow-y-auto no-scrollbar px-5 pt-4 pb-20 space-y-4">
        <div className="rounded-2xl border border-[#E4E2DC] bg-white p-4 shadow-sm space-y-3">
          <p className="text-sm leading-relaxed text-[#1F2924]">{t('profile.deleteAccountIntro')}</p>
          {['deleteAccountBullet1', 'deleteAccountBullet2', 'deleteAccountBullet3'].map((key) => (
            <p key={key} className="text-sm leading-relaxed text-[#57645C]">{t(`profile.${key}`)}</p>
          ))}
        </div>
        {blocked && (
          <div role="alert" className="rounded-2xl border border-[#F5D5D8] bg-[#F5D5D8]/45 p-4 text-sm text-[#9B4650] space-y-1">
            <p className="font-semibold">{t('profile.deleteAccountBlocked')}</p>
            <p>{t('profile.deleteAccountPendingRequests')}: {blockers.pendingRequests}</p>
            <p>{t('profile.deleteAccountActivePlacements')}: {blockers.activePlacements}</p>
          </div>
        )}
        {error && <p role="alert" className="text-sm text-[#9B4650]">{error}</p>}
        <label className="flex min-h-11 items-start gap-3 text-sm text-[#1F2924]">
          <input type="checkbox" checked={confirmed} disabled={blocked || busy}
            onChange={(event) => setConfirmed(event.target.checked)} className="mt-0.5 h-5 w-5 flex-shrink-0 accent-[#9B4650]" />
          <span>{t('profile.deleteAccountConfirm')}</span>
        </label>
        <button type="button" onClick={submit} disabled={!confirmed || blocked || busy || !blockers}
          className="w-full min-h-12 rounded-xl bg-[#9B4650] px-4 py-3 text-sm font-semibold text-white disabled:opacity-40">
          {busy ? t('auth.working') : t('profile.deleteAccountAction')}
        </button>
        <SecondaryButton onClick={onBack}>{t('common.back')}</SecondaryButton>
      </div>
    </div>
  );
}

function formatPaymentAmount(session) {
  const amount = (session.amountCents || 0) / 100;
  return `${amount.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${session.currency || 'RON'}`;
}

function formatPaymentDate(value) {
  if (!value) return '';
  return new Date(value).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function getPaymentStatusLabel(status, t) {
  const labels = {
    CREATED: t('profile.paymentStatusCreated'),
    PENDING: t('profile.paymentStatusPending'),
    PAID: t('profile.paymentStatusPaid'),
    FAILED: t('profile.paymentStatusFailed'),
    CANCELED: t('profile.paymentStatusCanceled'),
  };

  return labels[status] || status || t('common.unknown');
}

function SupportPetPalScreen({ t, onBack, onCreateDonation, paymentSessions = [] }) {
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
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col">
      <ScreenHeader title={t('profile.supportPetPal')} onBack={onBack} />
      <div className="min-h-0 flex-1 overflow-y-auto no-scrollbar px-5 pt-4 pb-20 space-y-4">
        <div className="rounded-2xl border border-[#E4E2DC] bg-white p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[#E3ECE4] flex items-center justify-center">
              <Heart size={20} className="text-[#2C402B]" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#1F2924] font-heading">{t('profile.donationTitle')}</h2>
              <p className="mt-1 text-sm leading-relaxed text-[#57645C]">{t('profile.donationIntro')}</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {amounts.map((amount) => (
              <button
                key={amount}
                type="button"
                onClick={() => setSelectedAmount(amount)}
                className={`rounded-xl border px-3 py-3 text-sm font-semibold transition-colors ${
                  selectedAmount === amount
                    ? 'border-[#2C402B] bg-[#E3ECE4] text-[#2C402B]'
                    : 'border-[#E4E2DC] bg-[#F8F7F4] text-[#57645C]'
                }`}
              >
                {amount / 100} RON
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-[#E4E2DC] bg-white p-4 shadow-sm space-y-3">
          <div className="flex items-start gap-2.5 text-sm leading-relaxed text-[#1F2924]">
            <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0 text-[#9BAE96]" />
            <span>{t('profile.donationRule1')}</span>
          </div>
          <div className="flex items-start gap-2.5 text-sm leading-relaxed text-[#1F2924]">
            <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0 text-[#9BAE96]" />
            <span>{t('profile.donationRule2')}</span>
          </div>
          <div className="flex items-start gap-2.5 text-sm leading-relaxed text-[#1F2924]">
            <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0 text-[#9BAE96]" />
            <span>{t('profile.donationRule3')}</span>
          </div>
        </div>

        <div className="rounded-2xl border border-[#E4E2DC] bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-[#1F2924]">{t('profile.paymentHistory')}</h3>
          {paymentSessions.length > 0 ? (
            <div className="mt-3 space-y-2">
              {paymentSessions.map((session) => (
                <div key={session.id} className="flex items-center justify-between gap-3 rounded-xl border border-[#E4E2DC] bg-[#F8F7F4] px-3 py-2">
                  <div>
                    <p className="text-sm font-semibold text-[#1F2924]">{formatPaymentAmount(session)}</p>
                    <p className="text-xs text-[#57645C]">{session.provider} · {formatPaymentDate(session.createdAt)}</p>
                  </div>
                  <Badge variant={session.status === 'PAID' ? 'success' : session.status === 'FAILED' ? 'danger' : 'default'}>
                    {getPaymentStatusLabel(session.status, t)}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm leading-relaxed text-[#57645C]">{t('profile.noPaymentHistory')}</p>
          )}
        </div>

        <PrivacyNote text={t('profile.paymentPrivacyNote')} />
        <PrimaryButton onClick={submitDonation} disabled={loading}>
          {loading ? t('common.loading') : t('profile.createDonation')}
        </PrimaryButton>
        <SecondaryButton onClick={onBack}>{t('common.back')}</SecondaryButton>
      </div>
    </div>
  );
}

export default function ProfileTab({ environment = 'match' }) {
  const {
    t,
    lang,
    toggleLang,
    user,
    updateUserProfile,
    myAnimals,
    saveAnimalProfile,
    deleteAnimalProfile,
    authConfigured,
    signOut,
    dataSource,
    paymentSessions,
    createDonationSession,
    paymentReturnNotice,
    clearPaymentReturnNotice,
    activeScreen, screenParams, goBack, setActiveTab,
    reduceMotion, setReduceMotion, setShowTypingActivity,
  } = useApp();
  const isFosterEnvironment = environment === 'foster';
  const [activeSection, setActiveSection] = useState(null);
  const [notice, setNotice] = useState('');
  const [profileDraft, setProfileDraft] = useState(null);
  const [animalDraft, setAnimalDraft] = useState(null);
  const [deleteDraft, setDeleteDraft] = useState(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingAnimal, setSavingAnimal] = useState(false);
  const [completedDetails, setCompletedDetails] = useState(null);
  const [typingBusy, setTypingBusy] = useState(false);
  const [preferenceError, setPreferenceError] = useState('');
  const [notificationPrefs, setNotificationPrefs] = useState({
    push: true,
    matches: true,
    foster: true,
    safety: true,
  });
  const [activeHelpTopic, setActiveHelpTopic] = useState(null);
  const showNotice = (message) => setNotice(message);
  useBackHandler(Boolean(activeSection || activeHelpTopic), () => { setActiveSection(null); setActiveHelpTopic(null); });

  useEffect(() => {
    if (!activeScreen) return;
    if (activeScreen === 'editAnimal' || activeScreen === 'createAnimal') {
      const animal = myAnimals.find(item => item.id === screenParams?.animalId);
      setActiveSection('animals');
      setAnimalDraft({ id: animal?.id || null, name: animal?.name || '', species: animal?.species || 'DOG',
        breed: animal?.breed || '', sex: animal?.sex || 'UNKNOWN', ageMonths: String(animal?.ageMonths ?? ''),
        sizeLabel: animal?.sizeLabel || 'MEDIUM', photoUrls: animal?.photoUrls || [], photoFile: null,
        photoPreviewUrl: '', activeMatchModes: animal?.activeMatchModes || ['PLAY', 'SOCIAL'] });
    }
    goBack();
  }, [activeScreen, screenParams, myAnimals, goBack]);

  useEffect(() => {
    if (!paymentReturnNotice) return;
    setNotice(paymentReturnNotice);
    clearPaymentReturnNotice();
  }, [paymentReturnNotice, clearPaymentReturnNotice]);

  const toggleNotificationPref = (key) => {
    setNotificationPrefs((current) => ({ ...current, [key]: !current[key] }));
  };
  const toggleTypingActivity = async () => {
    if (typingBusy) return;
    setPreferenceError('');
    setTypingBusy(true);
    try {
      await setShowTypingActivity(user.showTypingActivity === false);
    } catch (error) {
      setPreferenceError(friendlyError(error, t, t('motion.preferenceError')));
    } finally {
      setTypingBusy(false);
    }
  };
  const openHelpTopic = (topic) => {
    setNotice('');
    setActiveHelpTopic(topic);
  };
  const closeHelpTopic = () => setActiveHelpTopic(null);
  const exportProfileData = async () => {
    let serverData = null;
    if (dataSource === 'supabase') {
      try {
        serverData = await exportSupabaseData();
      } catch (error) {
        showNotice(friendlyError(error, t));
        return;
      }
    }
    const exportPayload = serverData ? {
      ...serverData,
      language: lang,
      notificationPreferences: notificationPrefs,
    } : {
      exportedAt: new Date().toISOString(),
      language: lang,
      account: {
        id: user.id,
        displayName: user.displayName,
        city: user.city,
        coarseArea: user.coarseArea,
        roles: user.roles,
        ownerVerificationStatus: user.ownerVerificationStatus,
        rescuerAccessStatus: user.rescuerAccessStatus,
      },
      animals: myAnimals,
      notificationPreferences: notificationPrefs,
      privacy: {
        exactLocationPublic: false,
      },
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
    showNotice(t('profile.dataExportReady'));
  };
  const openProfileEditor = () => {
    setNotice('');
    setProfileDraft({
      displayName: user.displayName || '',
      city: user.city || '',
      coarseArea: user.coarseArea || '',
    });
  };
  const createDonation = async ({ amountCents, currency }) => {
    try {
      const session = await createDonationSession({ amountCents, currency });
      showNotice(t('profile.donationSessionCreated'));
      return session;
    } catch (error) {
      showNotice(friendlyError(error, t, t('profile.donationSessionFailed')));
      throw error;
    }
  };
  const openAnimalEditor = (animal) => {
    setNotice('');
    setAnimalDraft({
      id: animal.id,
      name: animal.name || '',
      species: animal.species || 'DOG',
      breed: animal.breed || '',
      sex: animal.sex || 'UNKNOWN',
      ageMonths: String(animal.ageMonths ?? ''),
      sizeLabel: animal.sizeLabel || 'MEDIUM',
      activeMatchModes: animal.activeMatchModes || [],
      photoUrls: animal.photoUrls || [],
      photoFile: null,
      photoPreviewUrl: '',
    });
  };
  const openNewAnimalEditor = () => {
    setNotice('');
    setAnimalDraft({
      id: null,
      name: '',
      species: 'DOG',
      breed: '',
      sex: 'UNKNOWN',
      ageMonths: '',
      sizeLabel: 'MEDIUM',
      activeMatchModes: ['PLAY', 'SOCIAL'],
      photoUrls: [],
      photoFile: null,
      photoPreviewUrl: '',
    });
  };
  const saveProfileDraft = async () => {
    if (!profileDraft || savingProfile) return;
    setSavingProfile(true);
    try {
      const saved = await updateUserProfile(profileDraft);
      setCompletedDetails(saved.displayName?.trim() && saved.city?.trim() && !(user.displayName?.trim() && user.city?.trim()) ? 'owner' : null);
      setProfileDraft(null);
      showNotice(t('profile.profileSaved'));
    } catch (error) {
      showNotice(friendlyError(error, t, t('profile.profileSaveFailed')));
    } finally {
      setSavingProfile(false);
    }
  };
  const saveAnimalDraft = async () => {
    if (!animalDraft || savingAnimal) return;
    setSavingAnimal(true);
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
      activeMatchModes: animalDraft.activeMatchModes || ['PLAY', 'SOCIAL'],
      profileCompleteness: existingAnimal?.profileCompleteness || 0,
      verificationStatus: existingAnimal?.verificationStatus || 'UNVERIFIED',
      healthDocumentStatus: existingAnimal?.healthDocumentStatus || 'UNVERIFIED',
      adminMateApprovalStatus: existingAnimal?.adminMateApprovalStatus || 'UNVERIFIED',
    };

    try {
      const saved = await saveAnimalProfile(nextAnimal);
      setCompletedDetails(animalBasicChecks(saved, t).every(([, answered]) => answered)
        && (!existingAnimal || !animalBasicChecks(existingAnimal, t).every(([, answered]) => answered)) ? saved.id : null);
      setAnimalDraft(null);
      showNotice(t('profile.animalSaved'));
    } catch (error) {
      showNotice(friendlyError(error, t, t('profile.animalSaveFailed')));
    } finally {
      setSavingAnimal(false);
    }
  };
  const showMatchSettingsNotice = animal => openAnimalEditor(animal);
  const requestDeleteAnimal = (animal) => {
    setNotice('');
    setDeleteDraft(animal);
  };
  const confirmDeleteAnimal = async () => {
    if (!deleteDraft) return;

    try {
      await deleteAnimalProfile(deleteDraft.id);
      setDeleteDraft(null);
      showNotice(t('profile.animalDeleted').replace('{animalName}', deleteDraft.name));
    } catch (error) {
      showNotice(friendlyError(error, t, t('profile.animalDeleteFailed')));
    }
  };
  const helpTopics = {
    matching: {
      title: t('profile.howMatchingWorks'),
      intro: t('profile.matchingHelpIntro'),
      bullets: [
        t('profile.matchingHelpBullet1'),
        t('profile.matchingHelpBullet2'),
        t('profile.matchingHelpBullet3'),
        t('profile.matchingHelpBullet4'),
      ],
      note: t('profile.matchingHelpNote'),
    },
    foster: {
      title: t('profile.howFosterWorks'),
      intro: t('profile.fosterHelpIntro'),
      bullets: [
        t('profile.fosterHelpBullet1'),
        t('profile.fosterHelpBullet2'),
        t('profile.fosterHelpBullet3'),
        t('profile.fosterHelpBullet4'),
      ],
      note: t('profile.fosterHelpNote'),
    },
    safety: {
      title: t('profile.safetyRules'),
      intro: t('profile.safetyRulesIntro'),
      bullets: [
        t('profile.safetyRulesBullet1'),
        t('profile.safetyRulesBullet2'),
        t('profile.safetyRulesBullet3'),
        t('profile.safetyRulesBullet4'),
      ],
      note: t('profile.safetyRulesNote'),
    },
    terms: {
      title: t('profile.terms'),
      intro: t('profile.termsIntro'),
      bullets: [
        t('profile.termsBullet1'),
        t('profile.termsBullet2'),
        t('profile.termsBullet3'),
        t('profile.termsBullet4'),
      ],
      note: t('profile.termsNote'),
    },
    privacy: {
      title: t('profile.privacyPolicy'),
      intro: t('profile.privacyPolicyIntro'),
      bullets: [
        t('profile.privacyPolicyBullet1'),
        t('profile.privacyPolicyBullet2'),
        t('profile.privacyPolicyBullet3'),
        t('profile.privacyPolicyBullet4'),
      ],
      note: t('profile.privacyPolicyNote'),
    },
    welfare: {
      title: t('profile.animalWelfare'),
      intro: t('profile.animalWelfareIntro'),
      bullets: [
        t('profile.animalWelfareBullet1'),
        t('profile.animalWelfareBullet2'),
        t('profile.animalWelfareBullet3'),
        t('profile.animalWelfareBullet4'),
      ],
      note: t('profile.animalWelfareNote'),
    },
  };
  const termsSafetyContent = {
    title: t('profile.termsAndSafety'),
    intro: t('profile.termsSafetyIntro'),
    bullets: [
      t('profile.termsSafetyBullet1'),
      t('profile.termsSafetyBullet2'),
      t('profile.termsSafetyBullet3'),
      t('profile.termsSafetyBullet4'),
    ],
    note: t('profile.termsSafetyNote'),
  };
  const renderEditModals = () => (
    <>
      <ProfileEditModal
        draft={profileDraft}
        t={t}
        onChange={(patch) => setProfileDraft((current) => ({ ...current, ...patch }))}
        onClose={() => setProfileDraft(null)}
        onSave={saveProfileDraft}
        busy={savingProfile}
        error={notice}
      />
      <AnimalEditModal
        draft={animalDraft}
        t={t}
        onChange={(patch) => setAnimalDraft((current) => ({ ...current, ...patch }))}
        onClose={() => setAnimalDraft(null)}
        onSave={saveAnimalDraft}
        busy={savingAnimal}
        error={notice}
      />
      <DeleteAnimalModal
        animal={deleteDraft}
        t={t}
        onClose={() => setDeleteDraft(null)}
        onDelete={confirmDeleteAnimal}
      />
    </>
  );

  if (activeSection === 'animals') {
    return (
      <div className="flex-1 flex flex-col">
        <ScreenHeader
          title={t('profile.myAnimals')}
          onBack={() => setActiveSection(null)}
          right={
            <button
              type="button"
              onClick={openNewAnimalEditor}
              aria-label={t('profile.addAnimal')}
              className="p-2 rounded-lg hover:bg-[#F0EDE8] transition-colors"
            >
              <Plus size={20} className="text-[#2C402B]" />
            </button>
          }
        />
        <div className="min-h-0 flex-1 overflow-y-auto no-scrollbar px-5 pt-4 pb-20 space-y-3">
          <NoticeBanner message={notice} />
          {myAnimals.length === 0 ? (
            <EmptyState
              icon={Dog}
              title={t('profile.noAnimals')}
              description={t('profile.noAnimalsDesc')}
              action={t('profile.addAnimal')}
              onAction={openNewAnimalEditor}
            />
          ) : (
            myAnimals.map(a => (
              <AnimalCard
                key={a.id}
                animal={a}
                t={t}
                justCompleted={completedDetails === a.id}
                onEditAnimal={openAnimalEditor}
                onMatchSettings={showMatchSettingsNotice}
                onDeleteAnimal={requestDeleteAnimal}
                showMatchDetails={!isFosterEnvironment}
              />
            ))
          )}
          <SecondaryButton icon={Plus} onClick={openNewAnimalEditor}>{t('profile.addAnimal')}</SecondaryButton>
        </div>
        {renderEditModals()}
      </div>
    );
  }

  if (activeSection === 'safety') {
    return (
      <div className="flex-1 flex flex-col">
        <ScreenHeader title={t('profile.privacy')} onBack={() => setActiveSection(null)} />
        <div className="flex-1 overflow-y-auto no-scrollbar px-5 pt-4 pb-20 space-y-3">
          <NoticeBanner message={notice} />
          <PrivacyNote text={t('profile.locationNote')} />
          <SectionItem icon={EyeOff} label={t('profile.blockedUsers')} badge="0" onClick={() => showNotice(t('profile.blockedUsersEmpty'))} />
          <SectionItem icon={AlertTriangle} label={t('profile.reportHistory')} badge="0" onClick={() => showNotice(t('profile.reportHistoryEmpty'))} />
          <div className="bg-white rounded-2xl p-4 border border-[#E4E2DC] space-y-3">
            <h3 className="text-sm font-semibold text-[#1F2924]">{t('profile.locationVisibility')}</h3>
            <div className="flex items-center gap-2 text-sm text-[#57645C]">
              <Lock size={14} className="text-[#3A7080]" />
              <span>{t('profile.locationVisibilityDesc')}</span>
            </div>
          </div>
        </div>
        {renderEditModals()}
      </div>
    );
  }

  if (activeSection === 'deleteAccount') {
    return <DeleteAccountScreen t={t} onBack={() => setActiveSection(null)} onDeleted={signOut} />;
  }

  if (activeSection === 'dataExport') {
    return (
      <InfoDetailScreen
        title={t('profile.dataExport')}
        intro={t('profile.dataExportIntro')}
        bullets={[
          t('profile.dataExportBullet1'),
          t('profile.dataExportBullet2'),
          t('profile.dataExportBullet3'),
        ]}
        note={t('profile.dataExportNote')}
        primaryLabel={t('profile.downloadDataExport')}
        onPrimary={exportProfileData}
        t={t}
        onBack={() => setActiveSection(null)}
      />
    );
  }

  if (activeSection === 'termsSafety') {
    return (
      <InfoDetailScreen
        title={termsSafetyContent.title}
        intro={termsSafetyContent.intro}
        bullets={termsSafetyContent.bullets}
        note={termsSafetyContent.note}
        t={t}
        onBack={() => setActiveSection(null)}
      />
    );
  }

  if (activeSection === 'supportPetPal') {
    return (
      <SupportPetPalScreen
        t={t}
        onBack={() => setActiveSection(null)}
        onCreateDonation={createDonation}
        paymentSessions={paymentSessions}
      />
    );
  }

  if (activeSection === 'help') {
    if (activeHelpTopic && helpTopics[activeHelpTopic]) {
      const topic = helpTopics[activeHelpTopic];
      return (
        <InfoDetailScreen
          title={topic.title}
          intro={topic.intro}
          bullets={topic.bullets}
          note={topic.note}
          t={t}
          onBack={closeHelpTopic}
        />
      );
    }

    return (
      <div className="flex-1 flex flex-col">
        <ScreenHeader title={t('profile.help')} onBack={() => setActiveSection(null)} />
        <div className="min-h-0 flex-1 overflow-y-auto no-scrollbar px-5 pt-4 pb-20">
          <NoticeBanner message={notice} />
          <div className="space-y-0">
            {isFosterEnvironment ? (
              <SectionItem icon={Home} label={t('profile.howFosterWorks')} onClick={() => openHelpTopic('foster')} />
            ) : (
              <SectionItem icon={Heart} label={t('profile.howMatchingWorks')} onClick={() => openHelpTopic('matching')} />
            )}
            <SectionItem icon={Shield} label={t('profile.safetyRules')} onClick={() => openHelpTopic('safety')} />
            <SectionItem icon={FileText} label={t('profile.terms')} onClick={() => openHelpTopic('terms')} />
            <SectionItem icon={Lock} label={t('profile.privacyPolicy')} onClick={() => openHelpTopic('privacy')} />
            <SectionItem icon={Dog} label={t('profile.animalWelfare')} onClick={() => openHelpTopic('welfare')} />
          </div>
        </div>
        {renderEditModals()}
      </div>
    );
  }

  if (activeSection === 'matchPreferences') {
    const defaultAnimal = myAnimals[0]?.name || t('common.unknown');
    return (
      <PreferenceDetailScreen
        title={t('profile.matchPreferences')}
        description={t('profile.matchPreferencesDesc')}
        rows={[
          [t('profile.defaultAnimal'), defaultAnimal],
          [t('profile.defaultMode'), t('matches.play')],
          [t('profile.species'), `${t('matches.dogs')}, ${t('matches.cats')}`],
          [t('profile.preferredArea'), `${user.city}${user.coarseArea ? ` / ${user.coarseArea}` : ''}`],
          [t('profile.mixedBreeds'), t('common.yes')],
        ]}
        notice={t('profile.matchPreferencesNotice')}
        t={t}
        onBack={() => setActiveSection(null)}
      />
    );
  }

  if (activeSection === 'fosterPreferences') {
    return (
      <PreferenceDetailScreen
        title={t('profile.fosterPreferences')}
        description={t('profile.fosterPreferencesDesc')}
        rows={[
          [t('profile.canFoster'), `${t('matches.dogs')}, ${t('matches.cats')}`],
          [t('profile.preferredSize'), `${t('common.small')} / ${t('common.medium')}`],
          [t('profile.availableDuration'), t('foster.oneTwoWeeks')],
          [t('foster.canTransport'), t('common.yes')],
          [t('foster.canHandleMedical'), t('common.no')],
          [t('foster.otherPets'), t('profile.demoOtherPets')],
          [t('foster.childrenInHome'), t('common.no')],
        ]}
        notice={t('profile.fosterPreferencesNotice')}
        t={t}
        onBack={() => setActiveSection(null)}
      />
    );
  }

  if (activeSection === 'notificationPreferences') {
    return (
      <NotificationPreferenceScreen
        prefs={notificationPrefs}
        onToggle={toggleNotificationPref}
        t={t}
        environment={environment}
        reduceMotion={reduceMotion}
        onReduceMotionToggle={() => { setPreferenceError(''); setReduceMotion(!reduceMotion); }}
        showTypingActivity={user.showTypingActivity !== false}
        onTypingToggle={toggleTypingActivity}
        typingBusy={typingBusy}
        preferenceError={preferenceError}
        onBack={() => setActiveSection(null)}
      />
    );
  }

  return (
    <div data-testid="profile-tab" className="min-h-0 flex-1 flex flex-col">
      <div className="px-5 pt-4 pb-3 bg-[#F8F7F4]">
        <h1 className="text-2xl font-bold text-[#1F2924] tracking-tight font-heading">{t('profile.title')}</h1>
        <p className="mt-1 text-sm leading-relaxed text-[#57645C]">
          {isFosterEnvironment ? t('profile.fosterSpaceSubtitle') : t('profile.matchSpaceSubtitle')}
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto no-scrollbar px-5 pt-2 pb-24 space-y-5">
        <NoticeBanner message={notice} />

        <div className="bg-white rounded-2xl p-5 border border-[#E4E2DC] shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-[#E3ECE4] flex items-center justify-center">
              <User size={28} className="text-[#2C402B]" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-bold text-[#1F2924] font-heading">{user.displayName}</h2>
              <div className="flex items-center gap-1.5 text-sm text-[#57645C]">
                <MapPin size={13} className="text-[#9BAE96]" />
                <span>{user.city}{user.coarseArea ? ` / ${user.coarseArea}` : ''}</span>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {user.roles.map(r => (
                  <Badge key={r} variant="sage">{getRoleLabel(r, t)}</Badge>
                ))}
              </div>
            </div>
          </div>
          <OwnerChecklist user={user} t={t} justCompleted={completedDetails === 'owner'} onEdit={openProfileEditor} />
          <button
            type="button"
            onClick={openProfileEditor}
            className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#F8F7F4] border border-[#E4E2DC] text-sm font-medium text-[#57645C] hover:bg-[#EFEDE8] transition-colors"
          >
            <Edit3 size={14} />{t('profile.editProfile')}
          </button>
        </div>

        {!isFosterEnvironment && (
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <h3 className="text-xs font-semibold text-[#57645C] uppercase tracking-wider">{t('profile.myAnimals')}</h3>
              <button type="button" className="text-xs font-medium text-[#2C402B]" onClick={() => setActiveSection('animals')}>{t('profile.viewAll')}</button>
            </div>
            {myAnimals.length === 0 ? (
              <EmptyState
                icon={Dog}
                title={t('profile.noAnimals')}
                description={t('profile.noAnimalsDesc')}
                action={t('profile.addAnimal')}
                onAction={openNewAnimalEditor}
              />
            ) : (
              <div className="space-y-2">
                {myAnimals.slice(0, 2).map(a => (
                  <AnimalCard
                    key={a.id}
                    animal={a}
                    t={t}
                    justCompleted={completedDetails === a.id}
                    onEditAnimal={openAnimalEditor}
                    onMatchSettings={showMatchSettingsNotice}
                    onDeleteAnimal={requestDeleteAnimal}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        <PlatformAdminEntry />

        <div>
          <h3 className="text-xs font-semibold text-[#57645C] uppercase tracking-wider mb-2">{t('motion.preferences')}</h3>
          <div className="bg-white rounded-2xl border border-[#E4E2DC] overflow-hidden">
            {isFosterEnvironment ? (
              <SectionItem icon={Home} label={t('care.home')} onClick={() => setActiveTab('foster-home')} />
            ) : (
              <SectionItem icon={Heart} label={t('profile.matchPreferences')} onClick={() => setActiveSection('matchPreferences')} />
            )}
            <SectionItem icon={Bell} label={t('motion.preferences')} onClick={() => setActiveSection('notificationPreferences')} />
          </div>
        </div>

        <div>
          <h3 className="text-xs font-semibold text-[#57645C] uppercase tracking-wider mb-2">{t('profile.privacy')}</h3>
          <div className="bg-white rounded-2xl border border-[#E4E2DC] overflow-hidden">
            <SectionItem icon={Shield} label={t('profile.privacy')} onClick={() => setActiveSection('safety')} />
            <SectionItem icon={EyeOff} label={t('profile.blockedUsers')} badge="0" onClick={() => showNotice(t('profile.blockedUsersEmpty'))} />
          </div>
          <PrivacyNote text={t('profile.locationNote')} />
        </div>

        <div>
          <h3 className="text-xs font-semibold text-[#57645C] uppercase tracking-wider mb-2">{t('profile.app')}</h3>
          <div className="bg-white rounded-2xl border border-[#E4E2DC] overflow-hidden">
            <button
              type="button"
              className="w-full flex items-center gap-3.5 py-3.5 px-4 border-b border-[#E4E2DC]/50 cursor-pointer hover:bg-[#FAFAF8] transition-colors"
              onClick={toggleLang}
              data-testid="language-toggle"
            >
              <div className="w-9 h-9 rounded-xl bg-[#E3ECE4] flex items-center justify-center">
                <Languages size={17} className="text-[#2C402B]" />
              </div>
              <span className="text-sm font-medium text-[#1F2924] flex-1">{t('profile.language')}</span>
              <Badge variant="sage">{lang === 'en' ? t('profile.languageEnglish') : t('profile.languageRomanian')}</Badge>
            </button>
            <SectionItem icon={Settings} label={t('profile.notifications')} onClick={() => setActiveSection('notificationPreferences')} />
            <SectionItem icon={FileText} label={t('profile.dataExport')} onClick={() => setActiveSection('dataExport')} />
            {authConfigured && (
              <SectionItem icon={LogOut} label={t('profile.signOut')} onClick={signOut} />
            )}
          </div>
        </div>

        <div>
          <h3 className="text-xs font-semibold text-[#57645C] uppercase tracking-wider mb-2">{t('profile.help')}</h3>
          <div className="bg-white rounded-2xl border border-[#E4E2DC] overflow-hidden">
            <SectionItem icon={Heart} label={t('profile.supportPetPal')} onClick={() => setActiveSection('supportPetPal')} />
            <SectionItem icon={HelpCircle} label={t('profile.help')} onClick={() => setActiveSection('help')} />
            <SectionItem icon={FileText} label={t('profile.termsAndSafety')} onClick={() => setActiveSection('termsSafety')} />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-[#E4E2DC] overflow-hidden">
          <SectionItem icon={Trash2} label={t('profile.deleteAccount')} danger onClick={() => (
            dataSource === 'supabase' ? setActiveSection('deleteAccount') : showNotice(t('profile.deleteAccountNotice'))
          )} />
        </div>

        <div className="text-center py-4">
          <p className="text-xs text-[#57645C]/60" aria-label={t('profile.appVersion')}>PetPal v1.0.0</p>
        </div>
      </div>
      {renderEditModals()}
    </div>
  );
}
