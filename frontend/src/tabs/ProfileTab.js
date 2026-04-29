import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { formatAge } from '../data/mockData';
import {
  Badge, PrimaryButton, SecondaryButton, ScreenHeader, EmptyState, PrivacyNote,
  VerificationBadge
} from '../components/SharedComponents';
import {
  User, Dog, Cat, Shield, ShieldCheck, MapPin, Lock, CheckCircle2, XCircle,
  Clock, ChevronRight, Edit3, Plus, Settings, Bell, Globe, HelpCircle,
  FileText, Trash2, Eye, EyeOff, Heart, Home, Star, AlertTriangle, Languages
} from 'lucide-react';

function AnimalCard({ animal, t }) {
  const completenessColor = animal.profileCompleteness >= 90 ? 'text-[#2C402B]' : animal.profileCompleteness >= 70 ? 'text-[#9BAE96]' : 'text-[#C07E67]';
  const modeLabels = {
    PLAY: t('matches.play'),
    SOCIAL: t('matches.social'),
    VERIFIED_MATE: t('matches.verifiedMate'),
  };

  return (
    <div data-testid={`animal-card-${animal.id}`} className="bg-white rounded-2xl border border-[#E4E2DC] overflow-hidden shadow-sm">
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
                {animal.breed} · {animal.sex === 'MALE' ? t('common.male') : t('common.female')} · {formatAge(animal.ageMonths)}
              </p>
            </div>
            <VerificationBadge status={animal.verificationStatus} label="" />
          </div>
          <div className="flex items-center gap-1.5">
            <span className={`text-xs font-semibold ${completenessColor}`}>{t('profile.profileComplete')}: {animal.profileCompleteness}%</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {animal.activeMatchModes.map(m => (
              <Badge key={m} variant={m === 'VERIFIED_MATE' ? 'sage' : 'default'}>
                {modeLabels[m] || m}
              </Badge>
            ))}
          </div>
          <div className="flex gap-2 pt-1">
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F8F7F4] border border-[#E4E2DC] text-xs font-medium text-[#57645C] hover:bg-[#EFEDE8] transition-colors">
              <Edit3 size={12} />{t('profile.editAnimal')}
            </button>
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F8F7F4] border border-[#E4E2DC] text-xs font-medium text-[#57645C] hover:bg-[#EFEDE8] transition-colors">
              <Settings size={12} />{t('profile.matchSettings')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionItem({ icon: Icon, label, badge, danger, onClick }) {
  return (
    <button
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

function VerificationSection({ user, animals, t }) {
  const mainAnimal = animals[0];
  const checks = [
    {
      label: t('profile.ownerVerification'),
      status: user.ownerVerificationStatus,
    },
    {
      label: t('profile.animalProfile'),
      status: mainAnimal ? (mainAnimal.profileCompleteness >= 90 ? 'VERIFIED' : 'PENDING') : 'UNVERIFIED',
      detail: mainAnimal ? `${mainAnimal.profileCompleteness}%` : null,
    },
    {
      label: t('profile.healthDocuments'),
      status: mainAnimal?.healthDocumentStatus || 'UNVERIFIED',
    },
    {
      label: t('profile.verifiedMateEligibility'),
      status: mainAnimal?.adminMateApprovalStatus || 'UNVERIFIED',
    },
    {
      label: t('profile.rescuerAccess'),
      status: user.rescuerAccessStatus,
    },
  ];

  return (
    <div data-testid="verification-section" className="space-y-2">
      {checks.map(c => (
        <div key={c.label} className="flex items-center justify-between py-2.5 px-3 bg-white rounded-xl border border-[#E4E2DC]">
          <div className="flex items-center gap-2.5">
            {c.status === 'VERIFIED' ? (
              <CheckCircle2 size={18} className="text-[#9BAE96]" />
            ) : c.status === 'PENDING' ? (
              <Clock size={18} className="text-[#C07E67]" />
            ) : (
              <XCircle size={18} className="text-[#CD7A7E]" />
            )}
            <span className="text-sm text-[#1F2924]">{c.label}</span>
          </div>
          <div className="flex items-center gap-1.5">
            {c.detail && <span className="text-xs text-[#57645C]">{c.detail}</span>}
            <Badge variant={c.status === 'VERIFIED' ? 'success' : c.status === 'PENDING' ? 'warning' : 'default'}>
              {c.status === 'VERIFIED' ? t('common.yes') : c.status === 'PENDING' ? t('common.pending') : t('common.notVerified')}
            </Badge>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ProfileTab() {
  const { t, lang, toggleLang, user, myAnimals } = useApp();
  const [activeSection, setActiveSection] = useState(null);

  if (activeSection === 'verification') {
    return (
      <div className="flex-1 flex flex-col">
        <ScreenHeader title={t('profile.verification')} onBack={() => setActiveSection(null)} />
        <div className="flex-1 overflow-y-auto no-scrollbar px-5 pt-4 pb-20">
          <VerificationSection user={user} animals={myAnimals} t={t} />
        </div>
      </div>
    );
  }

  if (activeSection === 'animals') {
    return (
      <div className="flex-1 flex flex-col">
        <ScreenHeader
          title={t('profile.myAnimals')}
          onBack={() => setActiveSection(null)}
          right={
            <button className="p-2 rounded-lg hover:bg-[#F0EDE8] transition-colors">
              <Plus size={20} className="text-[#2C402B]" />
            </button>
          }
        />
        <div className="flex-1 overflow-y-auto no-scrollbar px-5 pt-4 pb-20 space-y-3">
          {myAnimals.length === 0 ? (
            <EmptyState
              icon={Dog}
              title={t('profile.noAnimals')}
              description={t('profile.noAnimalsDesc')}
              action={t('profile.addAnimal')}
            />
          ) : (
            myAnimals.map(a => <AnimalCard key={a.id} animal={a} t={t} />)
          )}
          <SecondaryButton icon={Plus} onClick={() => {}}>{t('profile.addAnimal')}</SecondaryButton>
        </div>
      </div>
    );
  }

  if (activeSection === 'safety') {
    return (
      <div className="flex-1 flex flex-col">
        <ScreenHeader title={t('profile.privacy')} onBack={() => setActiveSection(null)} />
        <div className="flex-1 overflow-y-auto no-scrollbar px-5 pt-4 pb-20 space-y-3">
          <PrivacyNote text={t('profile.locationNote')} />
          <SectionItem icon={EyeOff} label={t('profile.blockedUsers')} badge="0" onClick={() => {}} />
          <SectionItem icon={AlertTriangle} label="Report history" badge="0" onClick={() => {}} />
          <div className="bg-white rounded-2xl p-4 border border-[#E4E2DC] space-y-3">
            <h3 className="text-sm font-semibold text-[#1F2924]">Location visibility</h3>
            <div className="flex items-center gap-2 text-sm text-[#57645C]">
              <Lock size={14} className="text-[#3A7080]" />
              <span>City and area only. Exact location is never shared.</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (activeSection === 'help') {
    return (
      <div className="flex-1 flex flex-col">
        <ScreenHeader title={t('profile.help')} onBack={() => setActiveSection(null)} />
        <div className="flex-1 overflow-y-auto no-scrollbar px-5 pt-4 pb-20">
          <div className="space-y-0">
            <SectionItem icon={Heart} label={t('profile.howMatchingWorks')} onClick={() => {}} />
            <SectionItem icon={Home} label={t('profile.howFosterWorks')} onClick={() => {}} />
            <SectionItem icon={Shield} label={t('profile.safetyRules')} onClick={() => {}} />
            <SectionItem icon={FileText} label={t('profile.terms')} onClick={() => {}} />
            <SectionItem icon={Lock} label={t('profile.privacyPolicy')} onClick={() => {}} />
            <SectionItem icon={Dog} label={t('profile.animalWelfare')} onClick={() => {}} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="profile-tab" className="flex-1 flex flex-col">
      <div className="px-5 pt-4 pb-3 bg-[#F8F7F4]">
        <h1 className="text-2xl font-bold text-[#1F2924] tracking-tight font-heading">{t('profile.title')}</h1>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar px-5 pt-2 pb-20 space-y-5">
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
                  <Badge key={r} variant="sage">{r.replace('_', ' ')}</Badge>
                ))}
                <VerificationBadge status={user.ownerVerificationStatus} label="Owner" />
              </div>
            </div>
          </div>
          <button className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#F8F7F4] border border-[#E4E2DC] text-sm font-medium text-[#57645C] hover:bg-[#EFEDE8] transition-colors">
            <Edit3 size={14} />{t('profile.editProfile')}
          </button>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2.5">
            <h3 className="text-xs font-semibold text-[#57645C] uppercase tracking-wider">{t('profile.myAnimals')}</h3>
            <button className="text-xs font-medium text-[#9BAE96]" onClick={() => setActiveSection('animals')}>View all</button>
          </div>
          {myAnimals.length === 0 ? (
            <EmptyState
              icon={Dog}
              title={t('profile.noAnimals')}
              description={t('profile.noAnimalsDesc')}
              action={t('profile.addAnimal')}
            />
          ) : (
            <div className="space-y-2">
              {myAnimals.slice(0, 2).map(a => <AnimalCard key={a.id} animal={a} t={t} />)}
            </div>
          )}
        </div>

        <div>
          <h3 className="text-xs font-semibold text-[#57645C] uppercase tracking-wider mb-2">{t('profile.verification')}</h3>
          <button
            data-testid="verification-overview"
            onClick={() => setActiveSection('verification')}
            className="w-full bg-white rounded-2xl p-4 border border-[#E4E2DC] shadow-sm hover:bg-[#FAFAF8] transition-colors"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-[#1F2924]">{t('profile.verification')}</span>
              <ChevronRight size={16} className="text-[#57645C]" />
            </div>
            <div className="flex gap-2">
              <VerificationBadge status={user.ownerVerificationStatus} label="Owner" />
              <VerificationBadge status={myAnimals[0]?.healthDocumentStatus || 'UNVERIFIED'} label="Health" />
              <VerificationBadge status={myAnimals[0]?.adminMateApprovalStatus || 'UNVERIFIED'} label="Mate" />
            </div>
          </button>
        </div>

        <div>
          <h3 className="text-xs font-semibold text-[#57645C] uppercase tracking-wider mb-2">Preferences</h3>
          <div className="bg-white rounded-2xl border border-[#E4E2DC] overflow-hidden">
            <SectionItem icon={Heart} label={t('profile.matchPreferences')} onClick={() => {}} />
            <SectionItem icon={Home} label={t('profile.fosterPreferences')} onClick={() => {}} />
            <SectionItem icon={Bell} label={t('profile.notifications')} onClick={() => {}} />
          </div>
        </div>

        <div>
          <h3 className="text-xs font-semibold text-[#57645C] uppercase tracking-wider mb-2">{t('profile.privacy')}</h3>
          <div className="bg-white rounded-2xl border border-[#E4E2DC] overflow-hidden">
            <SectionItem icon={Shield} label={t('profile.privacy')} onClick={() => setActiveSection('safety')} />
            <SectionItem icon={EyeOff} label={t('profile.blockedUsers')} badge="0" onClick={() => {}} />
          </div>
          <PrivacyNote text={t('profile.locationNote')} />
        </div>

        <div>
          <h3 className="text-xs font-semibold text-[#57645C] uppercase tracking-wider mb-2">App</h3>
          <div className="bg-white rounded-2xl border border-[#E4E2DC] overflow-hidden">
            <div
              className="w-full flex items-center gap-3.5 py-3.5 px-4 border-b border-[#E4E2DC]/50 cursor-pointer hover:bg-[#FAFAF8] transition-colors"
              onClick={toggleLang}
            >
              <div className="w-9 h-9 rounded-xl bg-[#E3ECE4] flex items-center justify-center">
                <Languages size={17} className="text-[#2C402B]" />
              </div>
              <span className="text-sm font-medium text-[#1F2924] flex-1">{t('profile.language')}</span>
              <Badge variant="sage">{lang === 'en' ? 'English' : 'Romana'}</Badge>
            </div>
            <SectionItem icon={Settings} label={t('profile.notifications')} onClick={() => {}} />
            <SectionItem icon={FileText} label={t('profile.dataExport')} onClick={() => {}} />
          </div>
        </div>

        <div>
          <h3 className="text-xs font-semibold text-[#57645C] uppercase tracking-wider mb-2">{t('profile.help')}</h3>
          <div className="bg-white rounded-2xl border border-[#E4E2DC] overflow-hidden">
            <SectionItem icon={HelpCircle} label={t('profile.help')} onClick={() => setActiveSection('help')} />
            <SectionItem icon={FileText} label={t('profile.termsAndSafety')} onClick={() => {}} />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-[#E4E2DC] overflow-hidden">
          <SectionItem icon={Trash2} label={t('profile.deleteAccount')} danger onClick={() => {}} />
        </div>

        <div className="text-center py-4">
          <p className="text-xs text-[#57645C]/60">PetPal v1.0.0</p>
        </div>
      </div>
    </div>
  );
}
