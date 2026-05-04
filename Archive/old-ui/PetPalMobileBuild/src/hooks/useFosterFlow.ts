import { useState } from 'react';

import { createDemoFosterCase, demoFosterCases } from '../data/demoFosterCases';
import {
  createFosterApplication,
  emptyFosterApplicationDraft,
  isFosterApplicationReady,
} from '../domain/fosterFactory';
import { FosterSection } from '../screens/foster/FosterScreen';
import { FosterApplication, FosterApplicationDraft, FosterCase } from '../types/petpal';

export function useFosterFlow({
  onApplicationAccepted,
}: {
  onApplicationAccepted: (application: FosterApplication, fosterCase: FosterCase) => void;
}) {
  const [section, setSection] = useState<FosterSection>('find');
  const [fosterCases, setFosterCases] = useState(demoFosterCases);
  const [applications, setApplications] = useState<FosterApplication[]>([]);
  const [applicationDraft, setApplicationDraft] =
    useState<FosterApplicationDraft>(emptyFosterApplicationDraft);
  const [applicationStep, setApplicationStep] = useState(0);

  function submitApplication(fosterCaseId: string) {
    if (!isFosterApplicationReady(applicationDraft)) return null;

    const application = createFosterApplication(fosterCaseId, applicationDraft);
    setApplications((current) => [application, ...current]);
    setSection('applications');
    setApplicationStep(0);
    setApplicationDraft(emptyFosterApplicationDraft);

    return application;
  }

  function acceptApplication(application: FosterApplication) {
    const fosterCase = fosterCases.find((item) => item.id === application.fosterCaseId);

    setApplications((current) =>
      current.map((item) => (item.id === application.id ? { ...item, status: 'ACCEPTED' } : item)),
    );

    if (fosterCase) {
      onApplicationAccepted({ ...application, status: 'ACCEPTED' }, fosterCase);
    }
  }

  function rejectApplication(application: FosterApplication) {
    setApplications((current) =>
      current.map((item) => (item.id === application.id ? { ...item, status: 'REJECTED' } : item)),
    );
  }

  function addCase() {
    setFosterCases((current) => [createDemoFosterCase(), ...current]);
  }

  function markFosterFound(fosterCase: FosterCase) {
    setFosterCases((current) =>
      current.map((item) => (item.id === fosterCase.id ? { ...item, status: 'FOSTER_FOUND' } : item)),
    );
  }

  function archiveCase(fosterCase: FosterCase) {
    setFosterCases((current) =>
      current.map((item) => (item.id === fosterCase.id ? { ...item, status: 'ARCHIVED' } : item)),
    );
  }

  return {
    acceptApplication,
    addCase,
    applicationDraft,
    applications,
    applicationStep,
    archiveCase,
    fosterCases,
    markFosterFound,
    rejectApplication,
    section,
    setApplicationDraft,
    setApplicationStep,
    setSection,
    submitApplication,
  };
}
