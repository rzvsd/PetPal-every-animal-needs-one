import { useState } from 'react';

import { AnimalProfile, MatchCandidate, MatchMode, Species } from '../types/petpal';

export function useMatchFlow({
  onMutualMatch,
  selectedAnimal,
}: {
  onMutualMatch: (candidate: MatchCandidate) => void;
  selectedAnimal: AnimalProfile | null;
}) {
  const [matchMode, setMatchMode] = useState<MatchMode>('PLAY');
  const [speciesFilter, setSpeciesFilterState] = useState<Species | 'ALL'>('ALL');
  const [verifiedOnly, setVerifiedOnlyState] = useState(false);
  const [candidateIndex, setCandidateIndex] = useState(0);
  const [likeNotice, setLikeNotice] = useState<string | null>(null);

  function resetDeckState() {
    setCandidateIndex(0);
    setLikeNotice(null);
  }

  function setMode(mode: MatchMode) {
    setMatchMode(mode);
    resetDeckState();
  }

  function setSpeciesFilter(species: Species | 'ALL') {
    setSpeciesFilterState(species);
    resetDeckState();
  }

  function setVerifiedOnly(value: boolean) {
    setVerifiedOnlyState(value);
    resetDeckState();
  }

  function actOnCandidate(candidate: MatchCandidate, action: 'like' | 'pass' | 'save') {
    if (!selectedAnimal) return;

    if (action === 'like' && candidate.hasLikedBack) {
      setLikeNotice(null);
      onMutualMatch(candidate);
      return;
    }

    if (action === 'like') {
      setLikeNotice(`Like sent for ${candidate.animal.name}. Conversation opens only after a mutual match.`);
    } else if (action === 'save') {
      setLikeNotice(`${candidate.animal.name} was saved.`);
    } else {
      setLikeNotice(null);
    }

    setCandidateIndex((current) => current + 1);
  }

  return {
    actOnCandidate,
    candidateIndex,
    likeNotice,
    matchMode,
    setMode,
    setSpeciesFilter,
    setVerifiedOnly,
    speciesFilter,
    verifiedOnly,
  };
}
