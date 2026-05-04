import { ApplicationStatus, ListingMode } from '../types/petpal';

export const statusLabels: Record<ApplicationStatus, string> = {
  SUBMITTED: 'Submitted',
  IN_REVIEW: 'In review',
  ACCEPTED: 'Accepted',
  REJECTED: 'Rejected',
};

export const modeLabels: Record<ListingMode, string> = {
  ADOPT: 'Adopt',
  FOSTER: 'Foster',
};

export function formatAge(months: number | null): string {
  if (months === null) {
    return 'Age TBD';
  }

  if (months < 12) {
    return `${months} months`;
  }

  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  return remainingMonths === 0 ? `${years} years` : `${years}y ${remainingMonths}m`;
}

export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}
