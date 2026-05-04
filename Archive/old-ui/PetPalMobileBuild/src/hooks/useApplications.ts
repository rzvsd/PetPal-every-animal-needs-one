import { useCallback, useState } from 'react';
import { fetchMyApplications, MyApplicationSummary, submitApplication, signInDemoAdopter, signInDemoRescue, reviewApplication } from '../api/petpalApi';
import { ApplicationDraft, ApplicationStatus } from '../types/petpal';
import { getErrorMessage } from '../utils/petpalFormat';
import { isSupabaseConfigured } from '../lib/supabase';

export function useApplications(dataSource: 'demo' | 'supabase') {
  const [applications, setApplications] = useState<MyApplicationSummary[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState('Application drafts stay private until you submit.');

  const refreshApplications = useCallback(async () => {
    if (!isSupabaseConfigured || dataSource !== 'supabase') return;
    try {
      await signInDemoAdopter();
      const nextApplications = await fetchMyApplications();
      setApplications(nextApplications);
    } catch (error) {
      setSubmitMessage(`Local application sync unavailable: ${getErrorMessage(error)}`);
    }
  }, [dataSource]);

  const submit = useCallback(async (application: ApplicationDraft) => {
    if (!isSupabaseConfigured || dataSource !== 'supabase') {
      setSubmitMessage('Demo application validated locally. Configure Supabase to submit for real.');
      return false;
    }

    setIsSubmitting(true);
    try {
      await signInDemoAdopter();
      const applicationId = await submitApplication(application);
      const nextApplications = await fetchMyApplications();
      setApplications(nextApplications);
      setSubmitMessage(`Submitted application ${applicationId.slice(0, 8)} through Supabase.`);
      return true;
    } catch (error) {
      setSubmitMessage(`Submit failed: ${getErrorMessage(error)}`);
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [dataSource]);

  const acceptApplication = useCallback(async (applicationId: string) => {
    if (!isSupabaseConfigured || dataSource !== 'supabase') {
      return false;
    }

    try {
      await signInDemoRescue();
      await reviewApplication(applicationId, 'ACCEPTED', 'Accepted from the mobile UX smoke flow.');
      await signInDemoAdopter(); // switch back to adopter
      const nextApplications = await fetchMyApplications();
      setApplications(nextApplications);
      return true;
    } catch (error) {
      setSubmitMessage(`Accept failed: ${getErrorMessage(error)}`);
      return false;
    }
  }, [dataSource]);

  return {
    applications,
    isSubmitting,
    submitMessage,
    refreshApplications,
    submit,
    acceptApplication,
  };
}
