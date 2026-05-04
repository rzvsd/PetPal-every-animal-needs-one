import { AnimalProfile } from '../types/petpal';

export type EligibilityItem = {
  label: string;
  done: boolean;
};

export function getVerifiedMateEligibility(animal: AnimalProfile): EligibilityItem[] {
  const ageEligible = (animal.ageMonths ?? 0) >= 18;

  return [
    { label: 'Owner verified', done: animal.verificationStatus === 'VERIFIED' },
    { label: 'Animal profile complete', done: animal.profileCompleteness >= 85 },
    { label: 'Age eligible', done: ageEligible },
    { label: 'Sex known', done: animal.sex !== 'UNKNOWN' },
    { label: 'Sterilization status known', done: animal.sterilizedStatus !== 'UNKNOWN' },
    { label: 'Vaccines set', done: animal.vaccineStatus !== 'UNKNOWN' },
    { label: 'Health documents uploaded', done: animal.healthDocumentStatus === 'VERIFIED' },
    { label: 'Admin approval if required', done: animal.adminMateApprovalStatus === 'VERIFIED' },
  ];
}
