export type Species = 'DOG' | 'CAT';
export type ListingMode = 'ADOPT' | 'FOSTER';
export type ApplicationStatus = 'SUBMITTED' | 'IN_REVIEW' | 'ACCEPTED' | 'REJECTED';
export type MatchMode = 'PLAY' | 'SOCIAL' | 'VERIFIED_MATE';
export type VerificationStatus = 'UNVERIFIED' | 'PENDING' | 'VERIFIED' | 'REJECTED';
export type UserRole = 'OWNER' | 'FOSTER_VOLUNTEER' | 'RESCUER' | 'SHELTER_MEMBER';
export type EntryChoice = 'animal' | 'foster' | 'rescuer' | null;
export type RescuerAccessState = 'not_requested' | 'request_sent' | 'demo_preview' | 'verified';
export type MatchAction = 'LIKE' | 'PASS' | 'SAVE';
export type MatchStatus = 'PENDING' | 'MUTUAL' | 'BLOCKED' | 'ARCHIVED';
export type FosterCaseStatus =
  | 'DRAFT'
  | 'PENDING_REVIEW'
  | 'ACTIVE'
  | 'PAUSED'
  | 'FOSTER_FOUND'
  | 'ADOPTED'
  | 'ARCHIVED';
export type FosterApplicationStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'IN_REVIEW'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'WITHDRAWN'
  | 'COMPLETED';

export type AnimalProfile = {
  id: string;
  ownerId: string;
  name: string;
  species: Species;
  breed: string | null;
  isMixedBreed: boolean;
  ageMonths: number | null;
  sex: 'MALE' | 'FEMALE' | 'UNKNOWN';
  sizeLabel: 'SMALL' | 'MEDIUM' | 'LARGE' | 'UNKNOWN';
  weightKg: number | null;
  sterilizedStatus: 'YES' | 'NO' | 'UNKNOWN';
  vaccineStatus: 'UNKNOWN' | 'PARTIAL' | 'UP_TO_DATE';
  healthDocumentStatus: VerificationStatus;
  adminMateApprovalStatus: VerificationStatus;
  temperamentTags: string[];
  energyLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN';
  goodWithDogs: boolean | null;
  goodWithCats: boolean | null;
  goodWithChildren: boolean | null;
  city: string;
  coarseArea: string | null;
  photoUrls: string[];
  activeMatchModes: MatchMode[];
  profileCompleteness: number;
  verificationStatus: VerificationStatus;
};

export type AnimalProfileDraft = {
  name: string;
  breed: string;
  city: string;
  coarseArea: string;
};

export type MatchCandidate = {
  animal: AnimalProfile;
  mode: MatchMode;
  hasLikedBack: boolean;
  compatibilityScore: number;
  compatibilityReasons: string[];
  ownerVerificationStatus: VerificationStatus;
  healthDocumentStatus: VerificationStatus;
  distanceLabel: string;
  exactLocationHidden: true;
};

export type MatchInteraction = {
  id: string;
  fromAnimalId: string;
  toAnimalId: string;
  mode: MatchMode;
  action: MatchAction;
  createdAt: string;
};

export type AnimalMatch = {
  id: string;
  animalAId: string;
  animalBId: string;
  ownerAId: string;
  ownerBId: string;
  mode: MatchMode;
  status: MatchStatus;
  createdAt: string;
};

export type FosterCase = {
  id: string;
  animalId: string;
  organizationId: string | null;
  rescuerId: string;
  title: string;
  animalName: string;
  species: Species;
  ageMonths: number | null;
  sizeLabel: 'SMALL' | 'MEDIUM' | 'LARGE' | 'UNKNOWN';
  description: string;
  status: FosterCaseStatus;
  urgency: 'LOW' | 'MEDIUM' | 'HIGH';
  duration: 'FEW_DAYS' | 'ONE_TWO_WEEKS' | 'ONE_MONTH' | 'UNTIL_ADOPTION' | 'UNKNOWN';
  foodCovered: boolean;
  vetCovered: boolean;
  transportAvailable: boolean;
  goodWithChildren: boolean | null;
  goodWithOtherAnimals: boolean | null;
  medicalNeeds: string | null;
  homeFit: string;
  city: string;
  coarseArea: string | null;
  exactLocationPrivate: string | null;
  rescuerName: string;
  rescuerVerified: boolean;
  createdAt: string;
};

export type FosterApplicationDraft = {
  housingType: string;
  experience: string;
  availability: string;
  otherPets: string;
  childrenInHome: string;
  canTransport: boolean | null;
  canHandleMedicalNeeds: boolean | null;
  motivation: string;
};

export type FosterApplication = {
  id: string;
  fosterCaseId: string;
  applicantId: string;
  status: FosterApplicationStatus;
  housingType: string;
  availability: string;
  experience: string;
  otherPets: string | null;
  childrenInHome: string | null;
  canTransport: boolean | null;
  canHandleMedicalNeeds: boolean | null;
  motivation: string;
  createdAt: string;
};

export type UserProfile = {
  id: string;
  displayName: string;
  city: string;
  coarseArea: string | null;
  roles: UserRole[];
  ownerVerificationStatus: VerificationStatus;
  rescuerAccessStatus: VerificationStatus;
};

export type MatchPreferences = {
  defaultAnimalId: string | null;
  defaultMode: MatchMode;
  species: Species[];
  breeds: string[];
  allowMixedBreeds: boolean;
  verifiedOnly: boolean;
  city: string | null;
  coarseArea: string | null;
};

export type FosterPreferences = {
  species: Species[];
  sizeLabels: Array<'SMALL' | 'MEDIUM' | 'LARGE'>;
  duration: FosterCase['duration'];
  canTransport: boolean | null;
  canHandleMedicalNeeds: boolean | null;
  otherPets: string | null;
  childrenInHome: string | null;
};

export type Conversation = {
  id: string;
  source: 'MATCH' | 'FOSTER';
  candidateId?: string;
  fosterCaseId?: string;
  fosterApplicationId?: string;
  title: string;
  subtitle: string;
  contextLabel: string;
  privacyLabel: string;
  animalName: string;
  relatedAnimalName?: string;
  mode?: MatchMode;
  fosterStatus?: 'ACCEPTED' | 'ACTIVE' | 'COMPLETED';
  organizationName?: string;
  organizationVerified?: boolean;
  ownerVerified?: boolean;
  city: string;
  coarseArea: string | null;
  lastMessage: string;
  lastMessageAt: string | null;
  messages: ChatMessage[];
  blocked?: boolean;
  reported?: boolean;
};

export type ChatMessage = {
  id?: string;
  sender?: string;
  body: string;
  createdAt: string;
  isMine: boolean;
  messageId: string;
  conversationId?: string;
  senderId?: string;
  senderDisplayName: string;
};

export type DiscoveryListing = {
  listingId: string;
  mode: ListingMode;
  title: string;
  description: string;
  city: string;
  coarseArea: string | null;
  animalId: string;
  animalName: string;
  species: Species;
  breedOrMix: string | null;
  approximateAgeMonths: number | null;
  sizeLabel: string | null;
  sex: 'FEMALE' | 'MALE' | 'UNKNOWN';
  temperament: string | null;
  publicHealthSummary: string | null;
  organizationName: string;
  primaryPhotoUrl: string | null;
};

export type ApplicationDraft = {
  listingId: string;
  applicantAgeConfirmed: true;
  housingType: string;
  animalExperience: string;
  otherPets: string | null;
  childrenInHome: string | null;
  landlordApproval: string | null;
  motivation: string;
};

export type ConversationSummary = {
  conversationId: string;
  applicationId: string;
  applicationStatus: ApplicationStatus;
  title: string;
  animalName: string;
  organizationName: string;
  otherParticipants: string | null;
  lastMessageBody: string | null;
  lastMessageAt: string | null;
};
