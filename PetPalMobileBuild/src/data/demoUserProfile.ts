import { FosterPreferences, MatchPreferences, UserProfile } from '../types/petpal';

export const demoUserProfile: UserProfile = {
  id: 'user-demo',
  displayName: 'Alex',
  city: 'Bucharest',
  coarseArea: 'Sector 3',
  roles: ['OWNER', 'FOSTER_VOLUNTEER'],
  ownerVerificationStatus: 'PENDING',
  rescuerAccessStatus: 'UNVERIFIED',
};

export const demoMatchPreferences: MatchPreferences = {
  defaultAnimalId: 'animal-max',
  defaultMode: 'PLAY',
  species: ['DOG'],
  breeds: ['Labrador', 'Golden Retriever'],
  allowMixedBreeds: true,
  verifiedOnly: true,
  city: 'Bucharest',
  coarseArea: 'Ilfov',
};

export const demoFosterPreferences: FosterPreferences = {
  species: ['DOG', 'CAT'],
  sizeLabels: ['SMALL', 'MEDIUM'],
  duration: 'ONE_TWO_WEEKS',
  canTransport: true,
  canHandleMedicalNeeds: false,
  otherPets: 'One calm adult cat',
  childrenInHome: 'No children in the home',
};
