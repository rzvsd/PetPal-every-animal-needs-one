export type Species = 'DOG' | 'CAT';
export type ListingMode = 'ADOPT' | 'FOSTER';
export type ApplicationStatus = 'SUBMITTED' | 'IN_REVIEW' | 'ACCEPTED' | 'REJECTED';

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

export type ChatMessage = {
  messageId: string;
  conversationId: string;
  senderId: string;
  senderDisplayName: string;
  body: string;
  createdAt: string;
  isMine: boolean;
};
