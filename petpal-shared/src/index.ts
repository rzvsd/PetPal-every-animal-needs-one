import { z } from "zod";

export enum Mode {
  ADOPT = "ADOPT",
  FOSTER = "FOSTER",
  PLAY = "PLAY",
  SERVICES = "SERVICES",
  COMMUNITY = "COMMUNITY",
  MATE = "MATE",
}

export const ACTIVE_PUBLIC_MODES = [Mode.ADOPT, Mode.FOSTER] as const;

export enum ListingStatus {
  DRAFT = "DRAFT",
  PENDING_REVIEW = "PENDING_REVIEW",
  ACTIVE = "ACTIVE",
  PAUSED = "PAUSED",
  REJECTED = "REJECTED",
  ARCHIVED = "ARCHIVED",
}

export enum VerificationStatus {
  UNVERIFIED = "UNVERIFIED",
  PENDING = "PENDING",
  VERIFIED = "VERIFIED",
  REJECTED = "REJECTED",
}

export enum UserRole {
  ADOPTER = "ADOPTER",
  FOSTER = "FOSTER",
  RESCUER = "RESCUER",
  SHELTER_MEMBER = "SHELTER_MEMBER",
}

export enum OrganizationType {
  SHELTER = "SHELTER",
  RESCUE_GROUP = "RESCUE_GROUP",
  INDEPENDENT_RESCUER = "INDEPENDENT_RESCUER",
}

export enum Species {
  DOG = "DOG",
  CAT = "CAT",
}

export enum AnimalSex {
  FEMALE = "FEMALE",
  MALE = "MALE",
  UNKNOWN = "UNKNOWN",
}

export enum ApplicationStatus {
  SUBMITTED = "SUBMITTED",
  IN_REVIEW = "IN_REVIEW",
  ACCEPTED = "ACCEPTED",
  REJECTED = "REJECTED",
  WITHDRAWN = "WITHDRAWN",
}

export const publicAnimalSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1).max(80),
  species: z.enum(Species),
  approximateAgeMonths: z.number().int().min(0).max(360).nullable(),
  sizeLabel: z.string().min(1).max(40).nullable(),
  sex: z.enum(AnimalSex),
  city: z.string().min(1).max(80),
  shortDescription: z.string().min(1).max(500),
  photoUrls: z.array(z.url()).max(8),
});

export const animalDraftSchema = z.object({
  organizationId: z.uuid(),
  name: z.string().min(1).max(80),
  species: z.enum(Species),
  breedOrMix: z.string().max(120).nullable(),
  approximateAgeMonths: z.number().int().min(0).max(360).nullable(),
  sizeLabel: z.string().min(1).max(40).nullable(),
  sex: z.enum(AnimalSex),
  temperament: z.string().min(10).max(800),
  publicHealthSummary: z.string().max(800).nullable(),
  privateNotes: z.string().max(2000).nullable(),
});

export const listingDraftSchema = z.object({
  animalId: z.uuid(),
  mode: z.enum(ACTIVE_PUBLIC_MODES),
  title: z.string().min(8).max(120),
  description: z.string().min(40).max(2500),
  city: z.string().min(1).max(80),
  coarseArea: z.string().min(1).max(120).nullable(),
  exactLocationPrivate: z.string().max(400).nullable(),
  privateHandoverNotes: z.string().max(1200).nullable(),
});

export const animalListingSubmissionSchema = z.object({
  animal: animalDraftSchema,
  listing: listingDraftSchema.omit({ animalId: true }),
  submitForReview: z.boolean(),
});

export const applicationSchema = z.object({
  listingId: z.uuid(),
  applicantAgeConfirmed: z.literal(true),
  housingType: z.string().min(2).max(120),
  animalExperience: z.string().min(20).max(1200),
  otherPets: z.string().max(800).nullable(),
  childrenInHome: z.string().max(800).nullable(),
  landlordApproval: z.string().max(800).nullable(),
  motivation: z.string().min(20).max(1200),
});

export const discoveryFilterSchema = z.object({
  mode: z.enum(ACTIVE_PUBLIC_MODES).nullable(),
  species: z.enum(Species).nullable(),
  city: z.string().min(1).max(80).nullable(),
  sizeLabel: z.string().min(1).max(40).nullable(),
  query: z.string().max(120).nullable(),
});

export const applicationReviewSchema = z.object({
  applicationId: z.uuid(),
  status: z.enum([
    ApplicationStatus.IN_REVIEW,
    ApplicationStatus.ACCEPTED,
    ApplicationStatus.REJECTED,
  ]),
  reviewNote: z.string().max(1200).nullable(),
});

export const discoveryListingSchema = z.object({
  listingId: z.uuid(),
  mode: z.enum(ACTIVE_PUBLIC_MODES),
  title: z.string(),
  description: z.string(),
  city: z.string(),
  coarseArea: z.string().nullable(),
  animalId: z.uuid(),
  animalName: z.string(),
  species: z.enum(Species),
  breedOrMix: z.string().nullable(),
  approximateAgeMonths: z.number().int().nullable(),
  sizeLabel: z.string().nullable(),
  sex: z.enum(AnimalSex),
  temperament: z.string().nullable(),
  publicHealthSummary: z.string().nullable(),
  organizationName: z.string(),
  primaryPhotoUrl: z.url().nullable(),
});

export const profileOnboardingSchema = z.object({
  displayName: z.string().min(2).max(80),
  ageConfirmed: z.literal(true),
  city: z.string().min(1).max(80),
  coarseArea: z.string().min(1).max(120).nullable(),
  roles: z.array(z.enum(UserRole)).min(1).max(4),
});

export const organizationVerificationSchema = z.object({
  organizationType: z.enum(OrganizationType),
  organizationName: z.string().min(2).max(140),
  representativeName: z.string().min(2).max(120),
  contactEmail: z.email().max(180),
  contactPhone: z.string().min(6).max(40).nullable(),
  city: z.string().min(1).max(80),
  websiteUrl: z.url().nullable(),
  socialUrl: z.url().nullable(),
  registrationNumber: z.string().max(120).nullable(),
  activitySummary: z.string().min(40).max(2000),
});

export type PublicAnimal = z.infer<typeof publicAnimalSchema>;
export type AnimalDraft = z.infer<typeof animalDraftSchema>;
export type ListingDraft = z.infer<typeof listingDraftSchema>;
export type AnimalListingSubmission = z.infer<typeof animalListingSubmissionSchema>;
export type ApplicationDraft = z.infer<typeof applicationSchema>;
export type DiscoveryFilter = z.infer<typeof discoveryFilterSchema>;
export type ApplicationReview = z.infer<typeof applicationReviewSchema>;
export type DiscoveryListing = z.infer<typeof discoveryListingSchema>;
export type ProfileOnboarding = z.infer<typeof profileOnboardingSchema>;
export type OrganizationVerification = z.infer<typeof organizationVerificationSchema>;

export function isPublicMode(mode: Mode): mode is (typeof ACTIVE_PUBLIC_MODES)[number] {
  return ACTIVE_PUBLIC_MODES.includes(mode as (typeof ACTIVE_PUBLIC_MODES)[number]);
}

export function canOpenConversation(status: ApplicationStatus): boolean {
  return status === ApplicationStatus.ACCEPTED;
}
