export type MainTab = 'matches' | 'foster' | 'messages' | 'profile';

export const tabs: { id: MainTab; label: string; shortLabel: string; mark: string }[] = [
  { id: 'matches', label: 'Matches', shortLabel: 'Matches', mark: 'M' },
  { id: 'foster', label: 'Foster', shortLabel: 'Foster', mark: 'F' },
  { id: 'messages', label: 'Messages', shortLabel: 'Messages', mark: 'Msg' },
  { id: 'profile', label: 'Profile', shortLabel: 'Profile', mark: 'Me' },
];
