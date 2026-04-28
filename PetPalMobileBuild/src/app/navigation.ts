export type ActiveTab = 'discover' | 'applications' | 'inbox' | 'shelter' | 'profile';

export const tabs: { id: ActiveTab; label: string }[] = [
  { id: 'discover', label: 'Discover' },
  { id: 'applications', label: 'Applications' },
  { id: 'inbox', label: 'Inbox' },
  { id: 'shelter', label: 'Shelter' },
  { id: 'profile', label: 'Profile' },
];
