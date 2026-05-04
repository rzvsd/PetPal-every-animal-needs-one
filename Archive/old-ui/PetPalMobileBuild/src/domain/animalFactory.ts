import { AnimalProfile, AnimalProfileDraft } from '../types/petpal';

export const defaultAnimalDraft: AnimalProfileDraft = {
  name: 'Bella',
  breed: 'Mixed breed',
  city: 'Bucharest',
  coarseArea: 'Sector 2',
};

export function animalDraftFromProfile(animal: AnimalProfile | null): AnimalProfileDraft {
  if (!animal) return defaultAnimalDraft;

  return {
    name: animal.name,
    breed: animal.breed ?? 'Mixed breed',
    city: animal.city,
    coarseArea: animal.coarseArea ?? '',
  };
}

export function createAnimalFromDraft(draft: AnimalProfileDraft): AnimalProfile {
  return {
    id: `animal-${Date.now()}`,
    ownerId: 'user-demo',
    name: draft.name.trim() || 'My animal',
    species: 'DOG',
    breed: draft.breed.trim() || null,
    isMixedBreed: true,
    ageMonths: 24,
    sex: 'UNKNOWN',
    sizeLabel: 'MEDIUM',
    weightKg: null,
    sterilizedStatus: 'UNKNOWN',
    vaccineStatus: 'PARTIAL',
    healthDocumentStatus: 'PENDING',
    adminMateApprovalStatus: 'UNVERIFIED',
    temperamentTags: ['gentle', 'curious'],
    energyLevel: 'MEDIUM',
    goodWithDogs: true,
    goodWithCats: null,
    goodWithChildren: null,
    city: draft.city.trim() || 'Bucharest',
    coarseArea: draft.coarseArea.trim() || null,
    photoUrls: [],
    activeMatchModes: ['PLAY', 'SOCIAL'],
    profileCompleteness: 68,
    verificationStatus: 'PENDING',
  };
}

export function updateAnimalFromDraft(animal: AnimalProfile, draft: AnimalProfileDraft): AnimalProfile {
  return {
    ...animal,
    name: draft.name.trim() || animal.name,
    breed: draft.breed.trim() || null,
    city: draft.city.trim() || animal.city,
    coarseArea: draft.coarseArea.trim() || null,
  };
}
