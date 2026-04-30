import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { translations } from '../i18n/translations';
import { demoAnimals, demoMatchCandidates, demoFosterCases, demoConversations, demoFosterApplications, demoUser } from '../data/mockData';
import {
  getSupabaseSession,
  loadSupabaseAppData,
  signInWithSupabase,
  signUpWithSupabase,
  signInWithDemoSupabase,
  signOutOfSupabase,
  updateSupabaseProfile,
  upsertSupabaseAnimalProfile,
  deleteSupabaseAnimalProfile,
  uploadSupabaseAnimalPhoto,
  submitSupabaseFosterApplication,
  sendSupabaseConversationMessage,
  reportSupabaseConversation,
  blockSupabaseConversation,
  requestSupabaseRescuerAccess,
  registerSupabasePushToken,
} from '../services/supabaseApi';
import { demoSupabaseCredentials, isSupabaseConfigured, supabase } from '../services/supabaseClient';
import { initializePushNotifications } from '../services/pushNotifications';

const AppContext = createContext();

export function AppProvider({ children }) {
  const [lang, setLang] = useState('en');
  const [activeTab, setActiveTab] = useState('matches');
  const [user, setUser] = useState(demoUser);
  const [myAnimals, setMyAnimals] = useState(demoAnimals);
  const [selectedAnimalId, setSelectedAnimalId] = useState(demoAnimals[0]?.id || null);
  const [matchMode, setMatchMode] = useState('PLAY');
  const [candidates, setCandidates] = useState(demoMatchCandidates);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [matchSuccess, setMatchSuccess] = useState(null);
  const [savedAnimals, setSavedAnimals] = useState([]);
  const [fosterCases, setFosterCases] = useState(demoFosterCases);
  const [fosterApplications, setFosterApplications] = useState(demoFosterApplications);
  const [conversations, setConversations] = useState(demoConversations);
  const [dataSource, setDataSource] = useState('mock');
  const [backendStatus, setBackendStatus] = useState({ loading: false, message: null });
  const [authSession, setAuthSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(isSupabaseConfigured);
  const [authError, setAuthError] = useState('');
  const [authNotice, setAuthNotice] = useState('');
  const [localDemoSession, setLocalDemoSession] = useState(false);
  const [pushStatus, setPushStatus] = useState({ status: 'idle', message: null });
  const [rescuerAccessState, setRescuerAccessState] = useState('not_requested');
  const [activeScreen, setActiveScreen] = useState(null);
  const [screenParams, setScreenParams] = useState(null);

  const t = useCallback((path) => {
    const keys = path.split('.');
    let result = translations[lang];
    for (const key of keys) {
      result = result?.[key];
    }
    return result || path;
  }, [lang]);

  const toggleLang = () => setLang(l => l === 'en' ? 'ro' : 'en');

  const selectedAnimal = myAnimals.find(a => a.id === selectedAnimalId);
  const demoSupabaseLoginAvailable = Boolean(demoSupabaseCredentials.email && demoSupabaseCredentials.password);

  const mapUserRolesToSupabase = (roles = []) => {
    const roleMap = {
      OWNER: 'ADOPTER',
      FOSTER_VOLUNTEER: 'FOSTER',
      RESCUER: 'RESCUER',
      SHELTER_MEMBER: 'SHELTER_MEMBER',
    };

    const mapped = roles.map((role) => roleMap[role]).filter(Boolean);
    return mapped.length > 0 ? mapped : ['ADOPTER'];
  };

  const applySupabaseData = useCallback(async () => {
    const data = await loadSupabaseAppData();

    if (!data.configured) {
      setBackendStatus({ loading: false, message: null });
      setAuthSession(null);
      return data;
    }

    setAuthSession(data.session || null);

    if (data.profile) {
      setUser(data.profile);
      setRescuerAccessState(data.profile.rescuerAccessState || 'not_requested');
    } else if (data.session?.user) {
      setUser((current) => ({
        ...current,
        id: data.session.user.id,
        displayName: data.session.user.user_metadata?.display_name || current.displayName,
        city: data.session.user.user_metadata?.city || current.city,
        coarseArea: data.session.user.user_metadata?.coarse_area || current.coarseArea,
        email: data.session.user.email || current.email,
      }));
    }

    if (data.fosterCases?.length > 0) {
      setFosterCases(data.fosterCases);
    }

    if (data.session) {
      setLocalDemoSession(false);
      setMyAnimals(data.myAnimals || []);
      setSelectedAnimalId((current) => {
        if (current && (data.myAnimals || []).some((animal) => animal.id === current)) return current;
        return data.myAnimals?.[0]?.id || null;
      });
    }

    setFosterApplications(data.session ? (data.fosterApplications || []) : []);
    setConversations((current) => [
      ...current.filter((conversation) => conversation.source === 'MATCH'),
      ...(data.session ? (data.conversations || []) : []),
    ]);
    setDataSource('supabase');
    setBackendStatus({ loading: false, message: null });
    return data;
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function hydrateFromSupabase() {
      if (!isSupabaseConfigured) {
        setAuthLoading(false);
        setBackendStatus({ loading: false, message: null });
        return;
      }

      setAuthLoading(true);
      setBackendStatus({ loading: true, message: null });

      try {
        await getSupabaseSession();
        if (cancelled) return;
        await applySupabaseData();
      } catch (error) {
        if (cancelled) return;
        setAuthSession(null);
        setDataSource('mock');
        setBackendStatus({
          loading: false,
          message: error.message || 'Supabase data could not be loaded. Mock data is still active.',
        });
      } finally {
        if (!cancelled) setAuthLoading(false);
      }
    }

    hydrateFromSupabase();

    const { data: authListener } = isSupabaseConfigured
      ? supabase.auth.onAuthStateChange((_event, session) => {
          setAuthSession(session);
          if (session) setLocalDemoSession(false);
          if (!session) {
            setFosterApplications([]);
            setConversations((current) => current.filter((conversation) => conversation.source === 'MATCH'));
          }
        })
      : { data: null };

    return () => {
      cancelled = true;
      authListener?.subscription?.unsubscribe();
    };
  }, [applySupabaseData]);

  useEffect(() => {
    let cancelled = false;
    let cleanup = null;

    async function registerDevicePushToken() {
      if (!authSession?.user?.id || dataSource !== 'supabase') {
        setPushStatus({ status: 'idle', message: null });
        return;
      }

      try {
        const result = await initializePushNotifications({
          onToken: async (tokenPayload) => {
            await registerSupabasePushToken(tokenPayload);
            if (!cancelled) {
              setPushStatus({ status: 'registered', message: null });
            }
          },
          onError: (error) => {
            if (!cancelled) {
              setPushStatus({
                status: 'error',
                message: error.message || 'Push notifications could not be registered.',
              });
            }
          },
        });

        cleanup = result.cleanup;
        if (!cancelled && result.status !== 'registered') {
          setPushStatus({ status: result.status, message: result.reason || null });
        }
      } catch (error) {
        if (!cancelled) {
          setPushStatus({
            status: 'error',
            message: error.message || 'Push notifications could not be initialized.',
          });
        }
      }
    }

    registerDevicePushToken();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [authSession?.user?.id, dataSource]);

  const handleLike = (candidate) => {
    if (candidate.hasLikedBack) {
      setMatchSuccess({
        myAnimal: selectedAnimal,
        theirAnimal: candidate.animal,
        mode: candidate.mode,
      });
      const newConv = {
        id: `conv-match-${candidate.animal.id}`,
        source: 'MATCH',
        title: `${selectedAnimal.name} + ${candidate.animal.name}`,
        subtitle: candidate.mode === 'VERIFIED_MATE' ? t('matches.verifiedMate') : candidate.mode === 'PLAY' ? t('matches.play') : t('matches.social'),
        contextLabel: t('messages.matchChatContext'),
        privacyLabel: t('matches.locationPrivate'),
        animalName: selectedAnimal.name,
        relatedAnimalName: candidate.animal.name,
        mode: candidate.mode,
        ownerVerified: candidate.ownerVerificationStatus === 'VERIFIED',
        city: candidate.animal.city,
        coarseArea: candidate.animal.coarseArea,
        lastMessage: t('messages.sayHello'),
        lastMessageAt: new Date().toISOString(),
        unread: 0,
        messages: [],
      };
      setConversations(prev => {
        if (prev.find(c => c.id === newConv.id)) return prev;
        return [newConv, ...prev];
      });
    }
    setCurrentCardIndex(i => i + 1);
  };

  const handlePass = () => setCurrentCardIndex(i => i + 1);

  const handleSave = (candidate) => {
    setSavedAnimals(prev => [...prev, candidate.animal.id]);
  };

  const submitFosterApplication = async (caseId, formData) => {
    if (dataSource === 'supabase') {
      const applicationId = await submitSupabaseFosterApplication(caseId, formData);
      const fcase = fosterCases.find(c => c.id === caseId);
      const newApp = {
        id: applicationId,
        fosterCaseId: caseId,
        animalName: fcase?.animalName || 'Animal',
        rescuerName: fcase?.rescuerName || 'Rescuer',
        applicantId: user.id,
        status: 'SUBMITTED',
        ...formData,
        createdAt: new Date().toISOString(),
      };
      setFosterApplications(prev => [newApp, ...prev]);
      return newApp;
    }

    const fcase = fosterCases.find(c => c.id === caseId);
    const newApp = {
      id: `app-${Date.now()}`,
      fosterCaseId: caseId,
      animalName: fcase?.animalName || 'Animal',
      rescuerName: fcase?.rescuerName || 'Rescuer',
      applicantId: 'user-demo',
      status: 'SUBMITTED',
      ...formData,
      createdAt: new Date().toISOString(),
    };
    setFosterApplications(prev => [...prev, newApp]);
    return newApp;
  };

  const openFosterConversation = (application) => {
    const fcase = fosterCases.find(c => c.id === application.fosterCaseId);
    const existing = conversations.find(c =>
      c.source === 'FOSTER' &&
      (c.fosterApplicationId === application.id || c.fosterCaseId === application.fosterCaseId)
    );

    if (existing) {
      setActiveTab('messages');
      return existing;
    }

    if (dataSource === 'supabase') {
      setBackendStatus({
        loading: false,
        message: 'Conversation is not available yet. Supabase opens foster chat after accepted applications.',
      });
      setActiveTab('messages');
      return null;
    }

    const newConv = {
      id: `conv-foster-${application.id}`,
      source: 'FOSTER',
      fosterCaseId: application.fosterCaseId,
      fosterApplicationId: application.id,
      title: application.animalName,
      subtitle: t('messages.applicationAccepted'),
      contextLabel: t('messages.fosterChatContext'),
      privacyLabel: t('matches.locationPrivate'),
      animalName: application.animalName,
      fosterStatus: 'ACCEPTED',
      organizationName: application.rescuerName,
      organizationVerified: fcase?.rescuerVerified ?? true,
      city: fcase?.city || user.city,
      coarseArea: fcase?.coarseArea || user.coarseArea,
      lastMessage: t('messages.fosterAcceptedMessage'),
      lastMessageAt: new Date().toISOString(),
      unread: 0,
      messages: [
        {
          messageId: `m-${Date.now()}`,
          senderDisplayName: application.rescuerName,
          body: t('messages.fosterAcceptedMessage'),
          createdAt: new Date().toISOString(),
          isMine: false,
        },
      ],
    };

    setConversations(prev => [newConv, ...prev]);
    setActiveTab('messages');
    return newConv;
  };

  const sendMessage = (convId, body) => {
    if (dataSource === 'supabase') {
      sendSupabaseConversationMessage(convId, body).catch((error) => {
        setBackendStatus({
          loading: false,
          message: error.message || 'Message could not be sent to Supabase.',
        });
      });
    }

    setConversations(prev => prev.map(c => {
      if (c.id !== convId) return c;
      const msg = {
        messageId: `m-${Date.now()}`,
        senderDisplayName: 'You',
        body,
        createdAt: new Date().toISOString(),
        isMine: true,
      };
      return { ...c, messages: [...c.messages, msg], lastMessage: body, lastMessageAt: msg.createdAt };
    }));
  };

  const reportConversation = async (convId, details = '') => {
    if (dataSource === 'supabase') {
      await reportSupabaseConversation(convId, details);
    }

    setConversations((current) => current.map((conversation) => (
      conversation.id === convId
        ? { ...conversation, reported: true }
        : conversation
    )));
  };

  const blockConversation = async (convId) => {
    if (dataSource === 'supabase') {
      await blockSupabaseConversation(convId);
    }

    setConversations((current) => current.map((conversation) => (
      conversation.id === convId
        ? { ...conversation, blocked: true }
        : conversation
    )));
  };

  const requestRescuerAccess = async () => {
    if (dataSource === 'supabase') {
      await requestSupabaseRescuerAccess();
      await refreshSupabaseData();
      setRescuerAccessState('request_sent');
      return;
    }

    setRescuerAccessState('request_sent');
  };

  const navigate = (screen, params = null) => {
    setActiveScreen(screen);
    setScreenParams(params);
  };

  const goBack = () => {
    setActiveScreen(null);
    setScreenParams(null);
  };

  const refreshSupabaseData = async () => {
    if (!isSupabaseConfigured) return null;

    setBackendStatus({ loading: true, message: null });
    const data = await applySupabaseData();
    setBackendStatus({ loading: false, message: null });
    return data;
  };

  const signIn = async ({ email, password }) => {
    setAuthError('');
    setAuthNotice('');
    setAuthLoading(true);

    try {
      await signInWithSupabase(email, password);
      await refreshSupabaseData();
      setActiveTab('matches');
    } catch (error) {
      setAuthError(error.message || t('auth.signInError'));
    } finally {
      setAuthLoading(false);
    }
  };

  const signUp = async ({ email, password, displayName, city, coarseArea }) => {
    setAuthError('');
    setAuthNotice('');
    setAuthLoading(true);

    try {
      const session = await signUpWithSupabase({
        email,
        password,
        displayName,
        city,
        coarseArea,
      });

      if (session) {
        await refreshSupabaseData();
        setActiveTab('matches');
      } else {
        setAuthNotice(t('auth.accountCreatedNoSession'));
      }
    } catch (error) {
      setAuthError(error.message || t('auth.signUpError'));
    } finally {
      setAuthLoading(false);
    }
  };

  const signInDemo = async () => {
    setAuthError('');
    setAuthNotice('');
    setAuthLoading(true);

    try {
      await signInWithDemoSupabase();
      await refreshSupabaseData();
      setLocalDemoSession(false);
      setActiveTab('matches');
    } catch (error) {
      setAuthError(error.message || t('auth.demoSignInError'));
    } finally {
      setAuthLoading(false);
    }
  };

  const signOut = async () => {
    setAuthError('');
    setAuthNotice('');
    setAuthLoading(true);

    try {
      await signOutOfSupabase();
      setAuthSession(null);
      setLocalDemoSession(false);
      setFosterApplications([]);
      setConversations((current) => current.filter((conversation) => conversation.source === 'MATCH'));
      setBackendStatus({ loading: false, message: null });
    } catch (error) {
      setAuthError(error.message || t('auth.signOutError'));
    } finally {
      setAuthLoading(false);
    }
  };

  const continueLocalDemo = () => {
    setAuthError('');
    setAuthNotice('');
    setLocalDemoSession(true);
    setDataSource('mock');
    setBackendStatus({ loading: false, message: null });
    setActiveTab('matches');
  };

  const updateUserProfile = async (patch) => {
    if (dataSource === 'supabase') {
      const nextUser = { ...user, ...patch };
      await updateSupabaseProfile({
        displayName: nextUser.displayName,
        city: nextUser.city,
        coarseArea: nextUser.coarseArea,
        roles: mapUserRolesToSupabase(nextUser.roles),
      });
      setUser(nextUser);
      return nextUser;
    }

    setUser((current) => ({ ...current, ...patch }));
    return { ...user, ...patch };
  };

  const saveAnimalProfile = async (animalDraft) => {
    if (dataSource === 'supabase') {
      const { photoFile, photoPreviewUrl, ...persistableDraft } = animalDraft;
      let savedAnimal = await upsertSupabaseAnimalProfile(persistableDraft);

      if (photoFile) {
        const publicUrl = await uploadSupabaseAnimalPhoto({
          ownerId: authSession?.user?.id || user.id,
          animalId: savedAnimal.id,
          file: photoFile,
        });

        savedAnimal = await upsertSupabaseAnimalProfile({
          ...savedAnimal,
          photoUrls: [
            publicUrl,
            ...(savedAnimal.photoUrls || []).filter((url) => url !== publicUrl),
          ],
        });
      }

      setMyAnimals((current) => {
        const exists = current.some((animal) => animal.id === savedAnimal.id);
        return exists
          ? current.map((animal) => (animal.id === savedAnimal.id ? savedAnimal : animal))
          : [...current, savedAnimal];
      });
      setSelectedAnimalId(savedAnimal.id);
      return savedAnimal;
    }

    const localId = animalDraft.id || `animal-${Date.now()}`;
    const photoUrl = animalDraft.photoFile
      ? URL.createObjectURL(animalDraft.photoFile)
      : animalDraft.photoPreviewUrl || animalDraft.photoUrls?.[0] || null;
    const savedAnimal = {
      ...animalDraft,
      id: localId,
      ownerId: user.id,
      ageMonths: Number.parseInt(animalDraft.ageMonths, 10) || 0,
      profileCompleteness: animalDraft.profileCompleteness || 70,
      verificationStatus: animalDraft.verificationStatus || 'UNVERIFIED',
      healthDocumentStatus: animalDraft.healthDocumentStatus || 'UNVERIFIED',
      adminMateApprovalStatus: animalDraft.adminMateApprovalStatus || 'UNVERIFIED',
      photoFile: undefined,
      photoPreviewUrl: undefined,
      photoUrls: photoUrl
        ? [photoUrl, ...(animalDraft.photoUrls || []).filter((url) => url !== photoUrl)]
        : animalDraft.photoUrls || [],
    };

    setMyAnimals((current) => {
      const exists = current.some((animal) => animal.id === localId);
      return exists
        ? current.map((animal) => (animal.id === localId ? savedAnimal : animal))
        : [...current, savedAnimal];
    });
    setSelectedAnimalId(localId);
    return savedAnimal;
  };

  const deleteAnimalProfile = async (animalId) => {
    if (dataSource === 'supabase') {
      await deleteSupabaseAnimalProfile(animalId);
    }

    setMyAnimals((current) => {
      const remainingAnimals = current.filter((animal) => animal.id !== animalId);
      return remainingAnimals;
    });
    setSelectedAnimalId((currentSelectedId) => {
      if (currentSelectedId !== animalId) return currentSelectedId;
      const remainingAnimals = myAnimals.filter((animal) => animal.id !== animalId);
      return remainingAnimals[0]?.id || null;
    });
  };

  const authRequired = !authSession && !localDemoSession;

  return (
    <AppContext.Provider value={{
      lang, t, toggleLang,
      activeTab, setActiveTab,
      user, setUser, updateUserProfile,
      myAnimals, setMyAnimals, saveAnimalProfile, deleteAnimalProfile, selectedAnimalId, setSelectedAnimalId, selectedAnimal,
      matchMode, setMatchMode,
      candidates, setCandidates, currentCardIndex, setCurrentCardIndex,
      matchSuccess, setMatchSuccess,
      savedAnimals, handleLike, handlePass, handleSave,
      fosterCases, fosterApplications, submitFosterApplication, openFosterConversation,
      conversations, sendMessage, reportConversation, blockConversation,
      dataSource, backendStatus,
      pushStatus,
      authConfigured: isSupabaseConfigured,
      authRequired,
      authSession,
      authLoading,
      authError,
      authNotice,
      signIn,
      signUp,
      signInDemo,
      continueLocalDemo,
      signOut,
      demoSupabaseLoginAvailable,
      rescuerAccessState, setRescuerAccessState, requestRescuerAccess,
      activeScreen, screenParams, navigate, goBack,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
