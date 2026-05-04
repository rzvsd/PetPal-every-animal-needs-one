import { MatchMode } from '../types/petpal';

export function modeLabel(mode: MatchMode) {
  if (mode === 'PLAY') return 'Play';
  if (mode === 'SOCIAL') return 'Social';
  return 'Verified Mate';
}
