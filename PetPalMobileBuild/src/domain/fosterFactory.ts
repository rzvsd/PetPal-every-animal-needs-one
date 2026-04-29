import { FosterApplication, FosterApplicationDraft } from '../types/petpal';

export const emptyFosterApplicationDraft: FosterApplicationDraft = {
  housingType: '',
  experience: '',
  availability: '',
  otherPets: '',
  childrenInHome: '',
  canTransport: null,
  canHandleMedicalNeeds: null,
  motivation: '',
};

export function createFosterApplication(
  fosterCaseId: string,
  draft: FosterApplicationDraft,
): FosterApplication {
  return {
    id: `application-${Date.now()}`,
    fosterCaseId,
    applicantId: 'user-demo',
    status: 'SUBMITTED',
    housingType: draft.housingType.trim(),
    experience: draft.experience.trim(),
    availability: draft.availability.trim(),
    otherPets: draft.otherPets.trim() || null,
    childrenInHome: draft.childrenInHome.trim() || null,
    canTransport: draft.canTransport,
    canHandleMedicalNeeds: draft.canHandleMedicalNeeds,
    motivation: draft.motivation.trim(),
    createdAt: new Date().toISOString(),
  };
}

export function isFosterApplicationReady(draft: FosterApplicationDraft) {
  return (
    draft.housingType.trim().length >= 10 &&
    draft.experience.trim().length >= 20 &&
    draft.availability.trim().length >= 10 &&
    draft.otherPets.trim().length >= 2 &&
    draft.childrenInHome.trim().length >= 2 &&
    draft.canTransport !== null &&
    draft.canHandleMedicalNeeds !== null &&
    draft.motivation.trim().length >= 20
  );
}
