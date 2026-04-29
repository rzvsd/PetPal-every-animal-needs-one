import { useMemo, useState } from 'react';

import { demoFosterPreferences, demoMatchPreferences, demoUserProfile } from '../data/demoUserProfile';
import { EntryChoice, RescuerAccessState, UserProfile } from '../types/petpal';

export function useDemoUser() {
  const [entryChoice, setEntryChoice] = useState<EntryChoice>(null);
  const [rescuerAccessState, setRescuerAccessState] =
    useState<RescuerAccessState>('not_requested');

  const canManageFoster = rescuerAccessState === 'verified' || rescuerAccessState === 'demo_preview';
  const isDemoRescuerPreview = rescuerAccessState === 'demo_preview';

  const userProfile = useMemo<UserProfile>(() => {
    const isRescuer = rescuerAccessState === 'verified';
    return {
      ...demoUserProfile,
      roles: isRescuer ? ['OWNER', 'FOSTER_VOLUNTEER', 'RESCUER'] : demoUserProfile.roles,
      rescuerAccessStatus: isRescuer ? 'VERIFIED' : rescuerAccessState === 'not_requested' ? 'UNVERIFIED' : 'PENDING',
    };
  }, [rescuerAccessState]);

  function chooseEntry(choice: Exclude<EntryChoice, null>) {
    setEntryChoice(choice);
    if (choice === 'rescuer') {
      setRescuerAccessState('request_sent');
    }
  }

  function requestRescuerAccess() {
    setRescuerAccessState('request_sent');
  }

  function openRescuerDemoPreview() {
    setRescuerAccessState('demo_preview');
  }

  return {
    canManageFoster,
    chooseEntry,
    entryChoice,
    fosterPreferences: demoFosterPreferences,
    isDemoRescuerPreview,
    matchPreferences: demoMatchPreferences,
    openRescuerDemoPreview,
    requestRescuerAccess,
    rescuerAccessState,
    userProfile,
  };
}
