import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { translations } from '../i18n/translations';
import { demoAnimals, demoMatchCandidates, demoFosterCases, demoFosterHomeProfiles, demoFosterInvites, demoConversations, demoFosterApplications, demoUser } from '../data/mockData';
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
  likeSupabaseMatchCandidate,
  sendSupabaseFosterInvite,
  rateSupabaseFosterHome,
  createSupabasePaymentSession,
  loadSavedAnimals,
  setAnimalSaved,
  reportSupabaseConversation,
  blockSupabaseConversation,
  requestSupabaseRescuerAccess,
  registerSupabasePushToken,
} from '../services/supabaseApi';
import { allowLocalDemo, demoSupabaseCredentials, isSupabaseConfigured, supabase } from '../services/supabaseClient';
import { initializePushNotifications } from '../services/pushNotifications';
import { useMessaging } from '../services/useMessaging';
import { clearChatStorage } from '../services/messageStorage';

const AppContext = createContext();

export function AppProvider({ children }) {
  const [lang, setLang] = useState('en');
  const [activeTab, setActiveTab] = useState('matches');
  const [user, setUser] = useState(demoUser);
  const [myAnimals, setMyAnimals] = useState([]);
  const [selectedAnimalId, setSelectedAnimalId] = useState(null);
  const [matchMode, setMatchMode] = useState('PLAY');
  const [candidates, setCandidates] = useState([]);
  const [matchSuccess, setMatchSuccess] = useState(null);
  const [savedAnimals, setSavedAnimals] = useState([]);
  const [fosterCases, setFosterCases] = useState([]);
  const [fosterHomeProfiles, setFosterHomeProfiles] = useState([]);
  const [fosterInvites, setFosterInvites] = useState([]);
  const [fosterApplications, setFosterApplications] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [paymentSessions, setPaymentSessions] = useState([]);
  const [dataSource, setDataSource] = useState(isSupabaseConfigured ? 'supabase' : 'unconfigured');
  const [backendStatus, setBackendStatus] = useState({ loading: false, message: null });
  const [authSession, setAuthSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(isSupabaseConfigured);
  const [authError, setAuthError] = useState('');
  const [authNotice, setAuthNotice] = useState('');
  const [paymentReturnNotice, setPaymentReturnNotice] = useState('');
  const [localDemoSession, setLocalDemoSession] = useState(false);
  const [pushStatus, setPushStatus] = useState({ status: 'idle', message: null });
  const [rescuerAccessState, setRescuerAccessState] = useState('not_requested');
  const [activeScreen, setActiveScreen] = useState(null);
  const [screenParams, setScreenParams] = useState(null);
  const [skippedMatches, setSkippedMatches] = useState({});
  const [requestedConversation, setRequestedConversation] = useState(null);
  const authVersion = useRef(0);
  const sessionAccount = useRef(null);
  const messaging = useMessaging({ accountId: authSession?.user?.id || (localDemoSession ? 'demo' : null),
    live: Boolean(authSession && dataSource === 'supabase'), conversations, setConversations });
  const { sendMessage } = messaging;
  const requestOpenConversation = useCallback((id, source = 'MATCH') => {
    setRequestedConversation({ id, source });
    setActiveTab('messages');
  }, []);

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
  const localDemoAvailable = allowLocalDemo;
  const demoSupabaseLoginAvailable = localDemoAvailable && Boolean(demoSupabaseCredentials.email && demoSupabaseCredentials.password);

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
    const version = authVersion.current;
    const data = await loadSupabaseAppData();
    if (version !== authVersion.current) return data;

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

    setFosterCases(data.fosterCases || []);

    if (data.session) {
      setLocalDemoSession(false);
      setMyAnimals(data.myAnimals || []);
      setCandidates(data.matchCandidates || []);
      setFosterHomeProfiles(data.fosterHomeProfiles || []);
      setFosterInvites(data.fosterInvites || []);
      setPaymentSessions(data.paymentSessions || []);
      setSelectedAnimalId((current) => {
        if (current && (data.myAnimals || []).some((animal) => animal.id === current)) return current;
        return data.myAnimals?.[0]?.id || null;
      });
    }

    setFosterApplications(data.session ? (data.fosterApplications || []) : []);
    setConversations(current => data.session ? (data.conversations || []).map(row => ({ ...row,
      messages: row.blocked ? [] : current.find(c => c.id === row.id)?.messages || [],
    })) : []);
    if (data.session) {
      const saved = await loadSavedAnimals();
      if (version === authVersion.current) setSavedAnimals(saved);
    }
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
        const session = await getSupabaseSession();
        if (cancelled) return;
        setAuthSession(session);
        await applySupabaseData();
      } catch (error) {
        if (cancelled) return;
        setDataSource('supabase');
        setBackendStatus({
          loading: false,
          message: 'readiness.loadError',
        });
      } finally {
        if (!cancelled) setAuthLoading(false);
      }
    }

    hydrateFromSupabase();

    const { data: authListener } = isSupabaseConfigured
      ? supabase.auth.onAuthStateChange((_event, session) => {
          if (_event === 'SIGNED_OUT' && sessionAccount.current) {
            try { clearChatStorage(sessionAccount.current); }
            catch { setAuthError('readiness.storageFailed'); }
          }
          if (sessionAccount.current !== (session?.user?.id || null)) authVersion.current += 1;
          sessionAccount.current = session?.user?.id || null;
          setAuthSession(session);
          if (session) setLocalDemoSession(false);
          if (!session) {
            authVersion.current += 1;
            setMyAnimals([]);
            setSelectedAnimalId(null);
            setCandidates([]);
            setSavedAnimals([]);
            setSkippedMatches({});
            setRequestedConversation(null);
            setFosterApplications([]);
            setConversations([]);
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
          onOpenConversation: id => requestOpenConversation(id),
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
  }, [authSession?.user?.id, dataSource, requestOpenConversation]);

  const handleLike = async (candidate) => {
    if (!selectedAnimal) throw new Error('readiness.likeError');

    if (dataSource === 'supabase') {
      try {
        const result = await likeSupabaseMatchCandidate(selectedAnimal.id, candidate.animal.id, candidate.mode);
        if (result?.matched) {
          setMatchSuccess({
            myAnimal: selectedAnimal,
            theirAnimal: candidate.animal,
            mode: candidate.mode,
            conversationId: result.conversation_id,
          });
          messaging.refreshInbox('MATCH').catch(() => {});
        }
      } catch (error) { throw error; }
      handlePass(candidate);
      return;
    }

    if (candidate.hasLikedBack) {
      setMatchSuccess({
        myAnimal: selectedAnimal,
        theirAnimal: candidate.animal,
        mode: candidate.mode,
        conversationId: `conv-match-${candidate.animal.id}`,
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
    handlePass(candidate);
  };

  const handlePass = candidate => {
    const key = `${selectedAnimalId}:${matchMode}`;
    setSkippedMatches(current => ({ ...current, [key]: [...new Set([...(current[key] || []), candidate.animal.id])] }));
  };

  const handleSave = async candidate => {
    const saved = !savedAnimals.includes(candidate.animal.id);
    if (dataSource === 'supabase') await setAnimalSaved(candidate.animal.id, saved);
    setSavedAnimals(current => saved ? [...new Set([...current, candidate.animal.id])] : current.filter(id => id !== candidate.animal.id));
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

  const sendFosterInvite = async ({ fosterCaseId, fosterHomeProfileId, message = '' }) => {
    if (dataSource === 'supabase') {
      try {
        const inviteId = await sendSupabaseFosterInvite({ fosterCaseId, fosterHomeProfileId, message });
        const invite = {
          id: inviteId,
          fosterCaseId,
          fosterHomeProfileId,
          sentByUserId: user.id,
          status: 'SENT',
          message,
          createdAt: new Date().toISOString(),
        };
        setFosterInvites((current) => [invite, ...current.filter((item) => item.id !== inviteId)]);
        return invite;
      } catch (error) {
        setBackendStatus({
          loading: false,
          message: error.message || 'Foster invite could not be sent.',
        });
        throw error;
      }
    }

    const invite = {
      id: `invite-${Date.now()}`,
      fosterCaseId,
      fosterHomeProfileId,
      sentByUserId: user.id,
      status: 'SENT',
      message,
      createdAt: new Date().toISOString(),
    };

    setFosterInvites((current) => [invite, ...current]);
    return invite;
  };

  const rateFosterHome = async ({ fosterHomeProfileId, fosterCaseId = null, rating, comment = '' }) => {
    if (dataSource === 'supabase') {
      await rateSupabaseFosterHome({ fosterHomeProfileId, fosterCaseId, rating, comment });
      await refreshSupabaseData();
      return;
    }

    setFosterHomeProfiles((current) => current.map((profile) => {
      if (profile.id !== fosterHomeProfileId) return profile;
      const nextReviewCount = (profile.reviewCount || 0) + 1;
      const currentTotal = (profile.ratingAverage || rating) * (profile.reviewCount || 0);
      return {
        ...profile,
        ratingAverage: Number(((currentTotal + rating) / nextReviewCount).toFixed(1)),
        reviewCount: nextReviewCount,
      };
    }));
  };

  const createDonationSession = async ({ amountCents, currency = 'RON' }) => {
    if (dataSource === 'supabase') {
      const session = await createSupabasePaymentSession({
        provider: 'STRIPE',
        purpose: 'DONATION',
        amountCents,
        currency,
        metadata: {
          app: 'petpal-mobile',
          source: 'profile-support',
        },
      });
      setPaymentSessions((current) => [session, ...current.filter((item) => item.id !== session.id)].slice(0, 10));
      return session;
    }

    const localSession = {
      id: `local-payment-${Date.now()}`,
      provider: 'STRIPE',
      purpose: 'DONATION',
      amountCents,
      currency,
      status: 'CREATED',
      checkoutUrl: `petpal://payments/local-demo/${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setPaymentSessions((current) => [localSession, ...current].slice(0, 10));
    return localSession;
  };

  const openFosterInviteConversation = (invite) => {
    const fosterCase = fosterCases.find((item) => item.id === invite.fosterCaseId);
    const fosterHome = fosterHomeProfiles.find((item) => item.id === invite.fosterHomeProfileId);
    const existing = conversations.find((conversation) =>
      conversation.source === 'FOSTER' &&
      (conversation.fosterInviteId === invite.id || conversation.id === `conv-foster-invite-${invite.id}`)
    );

    if (existing) {
      setActiveTab('messages');
      return existing;
    }

    if (invite.status !== 'ACCEPTED') {
      setBackendStatus({
        loading: false,
        message: t('foster.inviteChatLocked'),
      });
      setActiveTab('foster');
      return null;
    }

    const newConv = {
      id: `conv-foster-invite-${invite.id}`,
      source: 'FOSTER',
      fosterCaseId: invite.fosterCaseId,
      fosterInviteId: invite.id,
      title: fosterCase?.animalName || t('messages.foster'),
      subtitle: t('foster.inviteAccepted'),
      contextLabel: t('foster.inviteChatContext'),
      privacyLabel: t('matches.locationPrivate'),
      animalName: fosterCase?.animalName || t('messages.foster'),
      fosterStatus: 'ACCEPTED',
      organizationName: fosterHome?.displayName || t('foster.fosterHome'),
      organizationVerified: fosterHome?.verifiedStatus === 'VERIFIED',
      city: fosterHome?.city || fosterCase?.city || user.city,
      coarseArea: fosterHome?.coarseArea || fosterCase?.coarseArea || user.coarseArea,
      lastMessage: t('foster.inviteAcceptedMessage'),
      lastMessageAt: new Date().toISOString(),
      unread: 0,
      messages: [
        {
          messageId: `m-${Date.now()}`,
          senderDisplayName: fosterHome?.displayName || t('foster.fosterHome'),
          body: t('foster.inviteAcceptedMessage'),
          createdAt: new Date().toISOString(),
          isMine: false,
        },
      ],
    };

    setConversations((current) => [newConv, ...current]);
    setActiveTab('messages');
    return newConv;
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

  const refreshSupabaseData = useCallback(async () => {
    if (!isSupabaseConfigured) return null;

    setBackendStatus({ loading: true, message: null });
    try {
      const data = await applySupabaseData();
      setBackendStatus({ loading: false, message: null });
      return data;
    } catch (error) {
      setBackendStatus({ loading: false, message: 'readiness.loadError' });
      throw error;
    }
  }, [applySupabaseData]);

  const handlePaymentReturn = useCallback((url) => {
    if (!url) return false;

    let parsedUrl;
    try {
      parsedUrl = new URL(url);
    } catch {
      return false;
    }

    if (parsedUrl.protocol !== 'petpal:' || parsedUrl.hostname !== 'payments') {
      return false;
    }

    const paymentStatus = parsedUrl.pathname.replace('/', '');
    if (paymentStatus === 'success') {
      setPaymentReturnNotice(t('profile.paymentReturnSuccess'));
      refreshSupabaseData().catch(() => undefined);
    } else if (paymentStatus === 'cancel') {
      setPaymentReturnNotice(t('profile.paymentReturnCanceled'));
    } else {
      setPaymentReturnNotice(t('profile.paymentReturnUnknown'));
    }

    setActiveTab('profile');
    setActiveScreen(null);
    setScreenParams(null);
    return true;
  }, [t, refreshSupabaseData]);

  const clearPaymentReturnNotice = () => setPaymentReturnNotice('');

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

    if (!localDemoAvailable) {
      setAuthError(t('auth.localDemoDisabled'));
      return;
    }

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
      clearChatStorage(authSession?.user?.id || (localDemoSession ? 'demo' : null));
      await signOutOfSupabase();
      setAuthSession(null);
      setLocalDemoSession(false);
      setFosterApplications([]);
      setConversations([]);
      setMyAnimals([]);
      setSavedAnimals([]);
      setSkippedMatches({});
      setPaymentSessions([]);
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

    if (!localDemoAvailable) {
      setAuthError(t('auth.localDemoDisabled'));
      return;
    }

    setLocalDemoSession(true);
    setUser(demoUser);
    setMyAnimals(demoAnimals);
    setSelectedAnimalId(demoAnimals[0]?.id || null);
    setDataSource('mock');
    setCandidates(demoMatchCandidates);
    setFosterCases(demoFosterCases);
    setFosterHomeProfiles(demoFosterHomeProfiles);
    setFosterApplications(demoFosterApplications);
    setFosterInvites(demoFosterInvites);
    setConversations(demoConversations);
    setPaymentSessions([]);
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
      candidates, setCandidates,
      skippedMatches, messaging, requestedConversation, setRequestedConversation, requestOpenConversation,
      refreshSupabaseData,
      matchSuccess, setMatchSuccess,
      savedAnimals, handleLike, handlePass, handleSave,
      fosterCases, fosterHomeProfiles, fosterInvites, sendFosterInvite, openFosterInviteConversation, rateFosterHome,
      fosterApplications, submitFosterApplication, openFosterConversation,
      conversations, sendMessage, reportConversation, blockConversation,
      paymentSessions, createDonationSession,
      dataSource, backendStatus,
      pushStatus,
      authConfigured: isSupabaseConfigured,
      authRequired,
      authSession,
      authLoading,
      authError,
      authNotice,
      paymentReturnNotice,
      handlePaymentReturn,
      clearPaymentReturnNotice,
      signIn,
      signUp,
      signInDemo,
      continueLocalDemo,
      signOut,
      localDemoAvailable,
      demoSupabaseLoginAvailable,
      rescuerAccessState, setRescuerAccessState, requestRescuerAccess,
      activeScreen, screenParams, navigate, goBack,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
