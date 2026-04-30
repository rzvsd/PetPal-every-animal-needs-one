import React, { useState } from 'react';
import { motion, useMotionValue, useTransform, AnimatePresence } from 'framer-motion';
import { useApp } from '../context/AppContext';
import { formatAge } from '../data/mockData';
import {
  Badge, Chip, PrimaryButton, SecondaryButton, ScreenHeader, EmptyState,
  PrivacyNote, VerificationBadge, AnimalSelector, CompatibilityScore,
  FilterSheet, Modal
} from '../components/SharedComponents';
import {
  Heart, X, Bookmark, BookmarkCheck, Info, ShieldCheck, MapPin,
  Lock, CheckCircle2, XCircle, Filter, Play, Users, Dog, Cat
} from 'lucide-react';

function MatchCard({ candidate, onLike, onPass, onSave, onDetails, isSaved, t }) {
  const { animal, mode, compatibilityScore, ownerVerificationStatus, distanceLabel } = candidate;
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-15, 15]);
  const likeOpacity = useTransform(x, [0, 100], [0, 1]);
  const passOpacity = useTransform(x, [-100, 0], [1, 0]);

  const handleDragEnd = (_, info) => {
    if (info.offset.x > 100) onLike();
    else if (info.offset.x < -100) onPass();
  };

  const modeLabel = mode === 'PLAY' ? t('matches.play') : mode === 'SOCIAL' ? t('matches.social') : t('matches.verifiedMate');
  const modeColor = mode === 'VERIFIED_MATE' ? 'sage' : mode === 'PLAY' ? 'sky' : 'default';

  return (
    <motion.div
      data-testid="match-card"
      className="absolute inset-0 mx-5 cursor-grab active:cursor-grabbing"
      style={{ x, rotate }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.7}
      onDragEnd={handleDragEnd}
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ x: 300, opacity: 0, transition: { duration: 0.3 } }}
    >
      <div className="relative w-full h-full rounded-3xl overflow-hidden bg-white shadow-lg border border-[#E4E2DC]/60">
        <div className="relative h-[58%]">
          <img
            src={animal.photoUrls?.[0] || 'https://images.unsplash.com/photo-1642303009474-851f1dd5195f?w=600&h=800&fit=crop'}
            alt={animal.name}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

          <motion.div style={{ opacity: likeOpacity }} className="absolute top-8 left-6 bg-[#9BAE96] text-white px-5 py-2 rounded-xl text-lg font-bold rotate-[-15deg] border-2 border-white shadow-lg">
            {t('matches.like')}
          </motion.div>
          <motion.div style={{ opacity: passOpacity }} className="absolute top-8 right-6 bg-[#CD7A7E] text-white px-5 py-2 rounded-xl text-lg font-bold rotate-[15deg] border-2 border-white shadow-lg">
            {t('matches.notNow')}
          </motion.div>

          <div className="absolute bottom-0 left-0 right-0 p-5 pb-4">
            <div className="flex items-end justify-between">
              <div>
                <h2 className="text-2xl font-bold text-white tracking-tight font-heading">{animal.name}</h2>
                <p className="text-sm text-white/80 mt-0.5">
                  {animal.breed} · {animal.sex === 'MALE' ? 'Male' : 'Female'} · {formatAge(animal.ageMonths)}
                </p>
              </div>
              <CompatibilityScore score={compatibilityScore} />
            </div>
          </div>
        </div>

        <div className="p-5 space-y-3 h-[42%] overflow-y-auto no-scrollbar">
          <div className="flex flex-wrap gap-1.5">
            <Badge variant={modeColor}>{modeLabel}</Badge>
            {ownerVerificationStatus === 'VERIFIED' && <Badge variant="success"><ShieldCheck size={11} />Verified</Badge>}
            {animal.vaccineStatus === 'UP_TO_DATE' && <Badge variant="sage"><CheckCircle2 size={11} />Vaccines</Badge>}
          </div>

          <div className="flex items-center gap-1.5 text-xs text-[#57645C]">
            <MapPin size={13} className="text-[#9BAE96]" />
            <span>{distanceLabel}</span>
          </div>

          <p className="text-sm text-[#57645C] leading-relaxed">
            {animal.temperamentTags?.join(', ')}
          </p>

          <div className="flex items-center gap-2.5 pt-2">
            <button
              data-testid="match-pass-btn"
              onClick={onPass}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-[#F8F7F4] border border-[#E4E2DC] text-[#57645C] font-medium text-sm hover:bg-[#EFEDE8] active:scale-[0.97] transition-all"
            >
              <X size={18} />
              {t('matches.notNow')}
            </button>
            <button
              data-testid="match-details-btn"
              onClick={onDetails}
              className="flex items-center justify-center p-3 rounded-xl bg-[#F8F7F4] border border-[#E4E2DC] text-[#57645C] hover:bg-[#EFEDE8] active:scale-[0.97] transition-all"
            >
              <Info size={18} />
            </button>
            <button
              data-testid="match-like-btn"
              onClick={onLike}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-[#9BAE96] text-white font-medium text-sm hover:bg-[#8A9F85] active:scale-[0.97] transition-all shadow-sm"
            >
              <Heart size={18} />
              {t('matches.like')}
            </button>
            <button
              data-testid="match-save-btn"
              onClick={onSave}
              className={`flex items-center justify-center p-3 rounded-xl border transition-all active:scale-[0.97] ${
                isSaved ? 'bg-[#E3ECE4] border-[#9BAE96] text-[#2C402B]' : 'bg-[#F8F7F4] border-[#E4E2DC] text-[#57645C] hover:bg-[#EFEDE8]'
              }`}
            >
              {isSaved ? <BookmarkCheck size={18} /> : <Bookmark size={18} />}
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function MatchDetail({ candidate, onClose, onLike, onPass, t }) {
  const { animal, compatibilityScore, compatibilityReasons, mode, healthDocumentStatus, distanceLabel } = candidate;
  const modeLabel = mode === 'PLAY' ? t('matches.play') : mode === 'SOCIAL' ? t('matches.social') : t('matches.verifiedMate');

  return (
    <div data-testid="match-detail-screen" className="absolute inset-0 z-30 bg-[#F8F7F4] flex flex-col">
      <ScreenHeader title={animal.name} onBack={onClose} />
      <div className="flex-1 overflow-y-auto no-scrollbar">
        <div className="relative h-72">
          <img
            src={animal.photoUrls?.[0] || 'https://images.unsplash.com/photo-1642303009474-851f1dd5195f?w=600&h=800&fit=crop'}
            alt={animal.name}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#F8F7F4] via-transparent to-transparent" />
        </div>

        <div className="px-5 -mt-10 relative space-y-5 pb-32">
          <div>
            <h1 className="text-2xl font-bold text-[#1F2924] font-heading">{animal.name}</h1>
            <p className="text-sm text-[#57645C] mt-1">{animal.breed} · {animal.sex === 'MALE' ? 'Male' : 'Female'} · {formatAge(animal.ageMonths)}</p>
          </div>

          <div className="flex items-center gap-3">
            <Badge variant="sage">{modeLabel}</Badge>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-[#57645C]">{t('matches.compatibility')}:</span>
              <CompatibilityScore score={compatibilityScore} />
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-[#E4E2DC] space-y-2.5">
            <h3 className="text-sm font-semibold text-[#1F2924] uppercase tracking-wider">{t('matches.whyMatch')}</h3>
            {compatibilityReasons.map((r, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-[#57645C]">
                <CheckCircle2 size={14} className="text-[#9BAE96] flex-shrink-0" />
                <span>{r}</span>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-2xl p-4 border border-[#E4E2DC] space-y-2">
            <h3 className="text-sm font-semibold text-[#1F2924] uppercase tracking-wider">{t('matches.temperament')}</h3>
            <p className="text-sm text-[#57645C]">{animal.temperamentTags?.join(', ')}</p>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-[#E4E2DC] space-y-2">
            <h3 className="text-sm font-semibold text-[#1F2924] uppercase tracking-wider">{t('matches.health')}</h3>
            <div className="flex flex-wrap gap-2">
              <VerificationBadge status={animal.vaccineStatus === 'UP_TO_DATE' ? 'VERIFIED' : 'PENDING'} label={t('matches.vaccinesSet')} />
              <VerificationBadge status={healthDocumentStatus} label={t('matches.healthDocs')} />
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-[#E4E2DC] space-y-2">
            <h3 className="text-sm font-semibold text-[#1F2924] uppercase tracking-wider">{t('matches.location')}</h3>
            <div className="flex items-center gap-1.5 text-sm text-[#57645C]">
              <MapPin size={14} className="text-[#9BAE96]" />
              <span>{distanceLabel}</span>
            </div>
            <PrivacyNote text={t('matches.locationPrivate')} />
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-5 pb-6 bg-gradient-to-t from-[#F8F7F4] via-[#F8F7F4] to-transparent">
        <div className="flex gap-3">
          <SecondaryButton onClick={onPass} className="flex-1">{t('matches.notNow')}</SecondaryButton>
          <PrimaryButton onClick={onLike} className="flex-1" icon={Heart}>{t('matches.like')}</PrimaryButton>
        </div>
      </div>
    </div>
  );
}

function MatchSuccessModal({ match, onClose, onOpenMessages, t }) {
  return (
    <Modal open={!!match} onClose={onClose}>
      <div className="p-6 text-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 10 }}
          className="w-20 h-20 rounded-full bg-[#E3ECE4] flex items-center justify-center mx-auto mb-5"
        >
          <Heart size={36} className="text-[#2C402B] fill-[#9BAE96]" />
        </motion.div>
        <h2 className="text-2xl font-bold text-[#1F2924] font-heading mb-2">{t('matches.matchSuccess')}</h2>
        <p className="text-[#57645C] mb-1">
          <span className="font-semibold">{match?.myAnimal?.name}</span> & <span className="font-semibold">{match?.theirAnimal?.name}</span>
        </p>
        <p className="text-sm text-[#57645C] mb-6">{t('matches.matchSuccessDesc')}</p>
        <PrimaryButton onClick={onOpenMessages}>{t('matches.openMessages')}</PrimaryButton>
        <button onClick={onClose} className="w-full mt-3 py-3 text-sm font-medium text-[#57645C] hover:text-[#1F2924] transition-colors">
          Continue browsing
        </button>
      </div>
    </Modal>
  );
}

function VerifiedMateLockedState({ animal, t }) {
  const checks = [
    { key: 'owner', label: t('matches.ownerVerified'), ok: animal?.verificationStatus === 'VERIFIED' },
    { key: 'profile', label: t('matches.profileComplete'), ok: (animal?.profileCompleteness || 0) >= 90 },
    { key: 'age', label: t('matches.ageEligible'), ok: (animal?.ageMonths || 0) >= 12 },
    { key: 'sex', label: t('matches.sexKnown'), ok: animal?.sex !== 'UNKNOWN' },
    { key: 'sterilization', label: t('matches.sterilizationKnown'), ok: animal?.sterilizedStatus !== 'UNKNOWN' },
    { key: 'vaccines', label: t('matches.vaccinesSet'), ok: animal?.vaccineStatus === 'UP_TO_DATE' },
    { key: 'health', label: t('matches.healthDocs'), ok: animal?.healthDocumentStatus === 'VERIFIED' },
    { key: 'admin', label: t('matches.adminApproval'), ok: animal?.adminMateApprovalStatus === 'VERIFIED' },
  ];

  return (
    <div data-testid="verified-mate-locked" className="mx-5 my-6">
      <div className="bg-white rounded-3xl border border-[#E4E2DC] p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-12 h-12 rounded-2xl bg-[#E3ECE4] flex items-center justify-center">
            <Lock size={22} className="text-[#2C402B]" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-[#1F2924] font-heading">{t('matches.verifiedMate')}</h3>
            <p className="text-xs text-[#57645C]">{t('matches.verifiedMateLocked')}</p>
          </div>
        </div>
        <div className="space-y-2.5">
          {checks.map(c => (
            <div key={c.key} className="flex items-center gap-2.5">
              {c.ok ? (
                <CheckCircle2 size={18} className="text-[#9BAE96] flex-shrink-0" />
              ) : (
                <XCircle size={18} className="text-[#CD7A7E] flex-shrink-0" />
              )}
              <span className={`text-sm ${c.ok ? 'text-[#57645C]' : 'text-[#1F2924] font-medium'}`}>{c.label}</span>
            </div>
          ))}
        </div>
        <p className="mt-4 text-[11px] leading-relaxed text-[#8A948E]">
          Demo rule: age eligibility currently uses 12+ months until vet, species, breed, and legal rules are connected.
        </p>
      </div>
    </div>
  );
}

export default function MatchesTab() {
  const {
    t, myAnimals, selectedAnimalId, setSelectedAnimalId, selectedAnimal,
    matchMode, setMatchMode, candidates, currentCardIndex,
    setCurrentCardIndex, matchSuccess, setMatchSuccess, savedAnimals,
    handleLike, handlePass, handleSave, setActiveTab, navigate
  } = useApp();

  const [showFilters, setShowFilters] = useState(false);
  const [showDetail, setShowDetail] = useState(null);
  const [speciesFilter, setSpeciesFilter] = useState(null);
  const [matchFilters, setMatchFilters] = useState({
    verifiedOnly: false,
    breed: null,
    sex: null,
    size: null,
    area: null,
  });

  const updateSpeciesFilter = (species) => {
    setSpeciesFilter(current => current === species ? null : species);
    setCurrentCardIndex(0);
  };

  const toggleMatchFilter = (key, value = true) => {
    setMatchFilters(current => ({
      ...current,
      [key]: current[key] === value ? (key === 'verifiedOnly' ? false : null) : value,
    }));
    setCurrentCardIndex(0);
  };

  const modes = [
    { key: 'PLAY', label: t('matches.play'), icon: Play },
    { key: 'SOCIAL', label: t('matches.social'), icon: Users },
    { key: 'VERIFIED_MATE', label: t('matches.verifiedMate'), icon: ShieldCheck },
  ];

  const filteredCandidates = candidates.filter(c => {
    if (speciesFilter && c.animal.species !== speciesFilter) return false;
    if (matchFilters.verifiedOnly && c.ownerVerificationStatus !== 'VERIFIED') return false;
    if (matchFilters.breed && c.animal.breed !== matchFilters.breed) return false;
    if (matchFilters.sex && c.animal.sex !== matchFilters.sex) return false;
    if (matchFilters.size && c.animal.sizeLabel !== matchFilters.size) return false;
    if (matchFilters.area && c.animal.city !== matchFilters.area && c.animal.coarseArea !== matchFilters.area) return false;
    return true;
  });

  const currentCandidate = filteredCandidates[currentCardIndex];
  const isVerifiedMateLocked = matchMode === 'VERIFIED_MATE' &&
    (selectedAnimal?.adminMateApprovalStatus !== 'VERIFIED' || selectedAnimal?.healthDocumentStatus !== 'VERIFIED');

  if (myAnimals.length === 0) {
    return (
      <div className="flex-1 flex flex-col">
        <ScreenHeader title={t('matches.title')} />
        <EmptyState
          icon={Dog}
          title={t('matches.noAnimalTitle')}
          description={t('matches.noAnimalDesc')}
          action={t('matches.createProfile')}
          onAction={() => navigate('createAnimal')}
        />
      </div>
    );
  }

  if (showDetail) {
    return (
      <MatchDetail
        candidate={showDetail}
        onClose={() => setShowDetail(null)}
        onLike={() => { handleLike(showDetail); setShowDetail(null); }}
        onPass={() => { handlePass(); setShowDetail(null); }}
        t={t}
      />
    );
  }

  return (
    <div data-testid="matches-tab" className="flex-1 flex flex-col relative">
      <div className="px-5 pt-4 pb-2 bg-[#F8F7F4] space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-[#1F2924] tracking-tight font-heading">{t('matches.title')}</h1>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold text-[#57645C] uppercase tracking-wider">{t('matches.myAnimal')}</label>
          <AnimalSelector
            animals={myAnimals}
            selectedId={selectedAnimalId}
            onSelect={setSelectedAnimalId}
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-[#57645C] uppercase tracking-wider mb-2 block">{t('matches.whatLooking')}</label>
          <div className="flex gap-2">
            {modes.map(m => (
              <button
                key={m.key}
                data-testid={`mode-${m.key.toLowerCase()}`}
                onClick={() => setMatchMode(m.key)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                  matchMode === m.key
                    ? 'bg-[#2C402B] text-white shadow-sm'
                    : 'bg-white text-[#57645C] border border-[#E4E2DC] hover:border-[#9BAE96]'
                }`}
              >
                <m.icon size={15} />
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          <Chip label={t('matches.dogs')} active={speciesFilter === 'DOG'} onClick={() => updateSpeciesFilter('DOG')} icon={Dog} />
          <Chip label={t('matches.cats')} active={speciesFilter === 'CAT'} onClick={() => updateSpeciesFilter('CAT')} icon={Cat} />
          <Chip label={t('matches.verified')} active={matchFilters.verifiedOnly} onClick={() => toggleMatchFilter('verifiedOnly')} icon={ShieldCheck} />
          <Chip label={t('matches.filters')} active={showFilters} onClick={() => setShowFilters(true)} icon={Filter} />
        </div>
      </div>

      <div className="flex-1 relative mt-2 mb-2">
        {isVerifiedMateLocked ? (
          <VerifiedMateLockedState animal={selectedAnimal} t={t} />
        ) : !currentCandidate ? (
          <EmptyState
            icon={Heart}
            title={t('matches.noMoreCards')}
            description={t('matches.noMoreDesc')}
          />
        ) : (
          <AnimatePresence mode="wait">
            <MatchCard
              key={currentCandidate.animal.id}
              candidate={currentCandidate}
              onLike={() => handleLike(currentCandidate)}
              onPass={handlePass}
              onSave={() => handleSave(currentCandidate)}
              onDetails={() => setShowDetail(currentCandidate)}
              isSaved={savedAnimals.includes(currentCandidate.animal.id)}
              t={t}
            />
          </AnimatePresence>
        )}
      </div>

      <MatchSuccessModal
        match={matchSuccess}
        onClose={() => setMatchSuccess(null)}
        onOpenMessages={() => { setMatchSuccess(null); setActiveTab('messages'); }}
        t={t}
      />

      <FilterSheet open={showFilters} onClose={() => setShowFilters(false)} title={t('matches.filters')}>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-[#57645C] uppercase tracking-wider mb-2 block">{t('matches.breed')}</label>
            <div className="flex flex-wrap gap-2">
              {['Labrador', 'Golden Retriever', 'German Shepherd', 'Mixed'].map(b => (
                <Chip key={b} label={b} active={matchFilters.breed === b} onClick={() => toggleMatchFilter('breed', b)} />
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-[#57645C] uppercase tracking-wider mb-2 block">{t('matches.sex')}</label>
            <div className="flex gap-2">
              <Chip label="Male" active={matchFilters.sex === 'MALE'} onClick={() => toggleMatchFilter('sex', 'MALE')} />
              <Chip label="Female" active={matchFilters.sex === 'FEMALE'} onClick={() => toggleMatchFilter('sex', 'FEMALE')} />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-[#57645C] uppercase tracking-wider mb-2 block">{t('matches.size')}</label>
            <div className="flex gap-2">
              {[
                ['SMALL', 'Small'],
                ['MEDIUM', 'Medium'],
                ['LARGE', 'Large'],
              ].map(([value, label]) => (
                <Chip key={value} label={label} active={matchFilters.size === value} onClick={() => toggleMatchFilter('size', value)} />
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-[#57645C] uppercase tracking-wider mb-2 block">{t('matches.area')}</label>
            <div className="flex flex-wrap gap-2">
              {['Bucharest', 'Ilfov', 'Cluj-Napoca', 'Timisoara'].map(a => (
                <Chip key={a} label={a} active={matchFilters.area === a} onClick={() => toggleMatchFilter('area', a)} />
              ))}
            </div>
          </div>
          <PrimaryButton onClick={() => setShowFilters(false)}>Apply filters</PrimaryButton>
        </div>
      </FilterSheet>
    </div>
  );
}
