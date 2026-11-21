import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { translations } from '../i18n/translations';
import { demoAnimals, demoMatchCandidates, demoFosterCases, demoConversations, demoFosterApplications, demoUser } from '../data/mockData';
import {
  getSupabaseSession,
  loadSupabaseAppData,
  signInWithSupabase,
  signUpWithSupabase,
  requestSupabasePasswordReset,
  openSupabaseRecoveryLink,
  isPasswordResetLink,
  updateSupabasePassword,
  signInWithDemoSupabase,
  signOutOfSupabase,
  updateSupabaseProfile,
  updateSupabaseTypingPreference,
  updateSupabaseNotificationPreferences,
  defaultNotificationPreferences,
  upsertSupabaseAnimalProfile,
  deleteSupabaseAnimalProfile,
  uploadSupabaseAnimalPhoto,
  submitSupabaseFosterApplication,
  likeSupabaseMatchCandidate,
  createSupabasePaymentSession,
  loadSavedAnimals,
  setAnimalSaved,
  reportSupabaseConversation,
  blockSupabaseConversation,
  passSupabaseCandidate,
  reportSupabaseMatchProfile,
  blockSupabaseProfile,
  requestSupabaseRescuerAccess,
  registerSupabasePushToken,
} from '../services/supabaseApi';
import { allowLocalDemo, demoSupabaseCredentials, isSupabaseConfigured, supabase } from '../services/supabaseClient';
import { initializePushNotifications } from '../services/pushNotifications';
import { useMessaging } from '../services/useMessaging';
import { clearChatStorage } from '../services/messageStorage';
import { prepareImageForUpload } from '../services/imageUpload';
import { friendlyError } from '../services/errors';

const AppContext = createContext();

export function AppProvider({ children }) {
  // Romanian first; English when the phone itself is in English. The
  // person's own choice is remembered.
  const [lang, setLangState] = useState(() => {
    try { const saved = localStorage.getItem('petpal:lang'); if (saved === 'en' || saved === 'ro') return saved; } catch { /* Use the device. */ }
    return (navigator.language || '').toLowerCase().startsWith('en') ? 'en' : 'ro';
  });
  const setLang = useCallback(next => setLangState(current => {
    const value = typeof next === 'function' ? next(current) : next;
    try { localStorage.setItem('petpal:lang', value); } catch { /* Kept for this session only. */ }
    return value;
  }), []);
  const [activeTab, setActiveTab] = useState('matches');
  const [user, setUser] = useState(demoUser);
  const [myAnimals, setMyAnimals] = useState([]);
  const [selectedAnimalId, setSelectedAnimalId] = useState(null);
  const [matchMode, setMatchMode] = useState('PLAY');
  const [candidates, setCandidates] = useState([]);
  const [matchSuccess, setMatchSuccess] = useState(null);
  const [savedAnimals, setSavedAnimals] = useState([]);
  const [fosterCases, setFosterCases] = useState([]);
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
  // True between opening a password reset link and saving the new password.
  // A reset link signs the person in, but they still owe a new password. Keep
  // that pending state across a WebView reload, because the one-time link
  // cannot be exchanged a second time to bring the form back.
  const [passwordRecovery, setPasswordRecoveryState] = useState(() => {
    try { return window.sessionStorage.getItem('petpal.passwordRecoveryPending') === 'true'; } catch { return false; }
  });
  const setPasswordRecovery = useCallback((pending) => {
    setPasswordRecoveryState(pending);
    try {
      if (pending) window.sessionStorage.setItem('petpal.passwordRecoveryPending', 'true');
      else window.sessionStorage.removeItem('petpal.passwordRecoveryPending');
    } catch { /* storage unavailable */ }
  }, []);
  const [pushStatus, setPushStatus] = useState({ status: 'idle', message: null });
  // The system permission prompt waits for a moment where it clearly helps.
  const [pushAllowed, setPushAllowed] = useState(false);
  const [notifyAsk, setNotifyAsk] = useState(null);
  const askForNotifications = useCallback(reason => {
    let asked = false;
    try { asked = localStorage.getItem('petpal:notify-asked') === '1'; } catch { asked = false; }
    if (!asked) setNotifyAsk(current => current || reason);
  }, []);
  const answerNotifyAsk = useCallback(allow => {
    try { localStorage.setItem('petpal:notify-asked', '1'); } catch { /* Asking again next time is fine. */ }
    setNotifyAsk(null);
    if (allow) setPushAllowed(true);
  }, []);
  const [rescuerAccessState, setRescuerAccessState] = useState('not_requested');
  const [activeScreen, setActiveScreen] = useState(null);
  const [screenParams, setScreenParams] = useState(null);
  const [skippedMatches, setSkippedMatches] = useState({});
  const [requestedConversation, setRequestedConversation] = useState(null);
  // Reduced motion is a property of the person holding the phone, so it is
  // stored once per device, not per account. Older builds stored a map by account.
  const [reduceMotion, setReduceMotionState] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('petpal:reduce-motion') || 'false');
      return saved && typeof saved === 'object' ? Object.values(saved).some(Boolean) : Boolean(saved);
    } catch { return false; }
  });
  const setReduceMotion = enabled => {
    setReduceMotionState(Boolean(enabled));
    try { localStorage.setItem('petpal:reduce-motion', JSON.stringify(Boolean(enabled))); } catch { /* Current session still honors the preference. */ }
  };
  const authVersion = useRef(0);
  const sessionAccount = useRef(null);
  const messaging = useMessaging({ accountId: authSession?.user?.id || (localDemoSession ? 'demo' : null),
    live: Boolean(authSession && dataSource === 'supabase'), conversations, setConversations,
    showTypingActivity: user.showTypingActivity !== false });
  const setShowTypingActivity = async enabled => {
    const version = authVersion.current;
    const saved = dataSource === 'supabase' ? await updateSupabaseTypingPreference(enabled) : Boolean(enabled);
    if (version === authVersion.current) setUser(current => ({ ...current, showTypingActivity: saved }));
    return saved;
  };
  const setNotificationPreferences = async preferences => {
    const version = authVersion.current;
    const saved = dataSource === 'supabase' ? await updateSupabaseNotificationPreferences(preferences)
      : { ...defaultNotificationPreferences, ...(user.notificationPreferences || {}), ...preferences };
    if (version === authVersion.current) setUser(current => ({ ...current, notificationPreferences: saved }));
    return saved;
  };
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
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);
  // Pushes are written on the server, so it needs to know the chosen language.
  const signedInId = authSession?.user?.id;
  useEffect(() => {
    if (!signedInId || dataSource !== 'supabase' || !supabase) return;
    supabase.rpc('set_my_language', { language_input: lang }).then(({ error }) => { if (error) console.warn('Language not saved', error.message); });
  }, [lang, signedInId, dataSource]);

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
        // An unreachable backend otherwise keeps the loading screen up for a long time.
        await Promise.race([
          (async () => {
            const session = await getSupabaseSession();
            if (cancelled) return;
            // Record whose data this load is for. Otherwise the INITIAL_SESSION
            // event below sees a "new" account and the load is thrown away,
            // leaving the demo user on screen after a cold start.
            sessionAccount.current = session?.user?.id || null;
            setAuthSession(session);
            await applySupabaseData();
          })(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Startup timed out')), 10000)),
        ]);
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
          // The web build reads the reset link itself and reports it this way.
          if (_event === 'PASSWORD_RECOVERY') setPasswordRecovery(true);
          if (_event === 'SIGNED_OUT' || (_event === 'INITIAL_SESSION' && !session)) setPasswordRecovery(false);
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
  }, [applySupabaseData, setPasswordRecovery]);

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
          askPermission: pushAllowed,
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
  }, [authSession?.user?.id, dataSource, requestOpenConversation, pushAllowed]);

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
          askForNotifications('match');
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
        subtitle: candidate.mode === 'SOCIAL' ? t('matches.social') : t('matches.play'),
        contextLabel: t('messages.matchChatContext'),
        privacyLabel: t('matches.locationPrivate'),
        animalName: selectedAnimal.name,
        relatedAnimalName: candidate.animal.name,
        mode: candidate.mode,
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

  const skipCandidate = candidate => {
    const key = `${selectedAnimalId}:${matchMode}`;
    setSkippedMatches(current => ({ ...current, [key]: [...new Set([...(current[key] || []), candidate.animal.id])] }));
  };

  const handlePass = async candidate => {
    skipCandidate(candidate);
    if (dataSource === 'supabase') {
      await passSupabaseCandidate({ myAnimalId: selectedAnimalId, targetAnimalId: candidate.animal.id, mode: matchMode });
    }
  };

  const reportMatchProfile = async candidate => {
    if (dataSource === 'supabase') {
      await reportSupabaseMatchProfile({ ownerId: candidate.animal.ownerId, animalId: candidate.animal.id });
    }
    // A reported animal is also passed so it stays hidden after a restart.
    await handlePass(candidate);
  };

  const blockMatchProfile = async candidate => {
    if (dataSource === 'supabase') await blockSupabaseProfile(candidate.animal.ownerId);
    skipCandidate(candidate);
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

  // The phone opens the https reset App Link from the email. Its one-time code
  // is exchanged for a session (only possible on the phone that asked for the
  // link) and the app asks for the new password before anything else. The
  // same link can arrive twice, as the launch URL and as an appUrlOpen event,
  // or again after the WebView reloads, so each link is handled only once.
  const handledRecoveryLinks = useRef(new Set());
  const handleRecoveryLink = useCallback(async (url) => {
    if (!isPasswordResetLink(url)) return false;
    let alreadyHandled = handledRecoveryLinks.current.has(url);
    try { alreadyHandled = alreadyHandled || window.sessionStorage.getItem('petpal.handledResetLink') === url; } catch { /* storage unavailable */ }
    if (alreadyHandled) return true;
    handledRecoveryLinks.current.add(url);
    try { window.sessionStorage.setItem('petpal.handledResetLink', url); } catch { /* storage unavailable */ }
    setAuthError('');
    setAuthLoading(true);
    try {
      if (await openSupabaseRecoveryLink(url)) setPasswordRecovery(true);
      else setAuthError(t('auth.resetLinkInvalid'));
    } catch (error) {
      const offline = /failed to fetch|network ?error|load failed/i.test(error?.message || '');
      if (!offline) console.error(error);
      setAuthError(offline ? t('errors.network') : t('auth.resetLinkInvalid'));
    } finally {
      setAuthLoading(false);
    }
    return true;
  }, [t, setPasswordRecovery]);

  const requestPasswordReset = async (email) => {
    setAuthError('');
    setAuthNotice('');
    setAuthLoading(true);
    try {
      await requestSupabasePasswordReset(email, Capacitor.isNativePlatform());
      setAuthNotice(t('auth.resetEmailSent'));
    } catch (error) {
      setAuthError(friendlyError(error, t, t('auth.resetFailed')));
    } finally {
      setAuthLoading(false);
    }
  };

  const saveNewPassword = async (password) => {
    setAuthError('');
    setAuthLoading(true);
    try {
      await updateSupabasePassword(password);
      setPasswordRecovery(false);
      setAuthNotice(t('auth.passwordUpdated'));
      await refreshSupabaseData();
      setActiveTab('matches');
    } catch (error) {
      setAuthError(friendlyError(error, t, t('auth.passwordUpdateFailed')));
    } finally {
      setAuthLoading(false);
    }
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
      setAuthError(friendlyError(error, t, t('auth.signInError')));
    } finally {
      setAuthLoading(false);
    }
  };

  const signUp = async ({ email, password, displayName, city, coarseArea, ageConfirmed, termsAccepted }) => {
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
        ageConfirmed,
        termsAccepted,
      });

      if (session) {
        await refreshSupabaseData();
        setActiveTab('matches');
      } else {
        setAuthNotice(t('auth.accountCreatedNoSession'));
      }
    } catch (error) {
      setAuthError(friendlyError(error, t, t('auth.signUpError')));
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
      setAuthError(friendlyError(error, t, t('auth.demoSignInError')));
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
      setAuthError(friendlyError(error, t, t('auth.signOutError')));
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
    setFosterApplications(demoFosterApplications);
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
          file: await prepareImageForUpload(photoFile),
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
      ageMonths: animalDraft.ageMonths === '' || animalDraft.ageMonths == null ? null : Number(animalDraft.ageMonths),
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
      lang, t, toggleLang, setLang,
      activeTab, setActiveTab,
      user, setUser, updateUserProfile,
      reduceMotion, setReduceMotion, setShowTypingActivity, setNotificationPreferences,
      myAnimals, setMyAnimals, saveAnimalProfile, deleteAnimalProfile, selectedAnimalId, setSelectedAnimalId, selectedAnimal,
      matchMode, setMatchMode,
      candidates, setCandidates,
      skippedMatches, messaging, requestedConversation, setRequestedConversation, requestOpenConversation,
      refreshSupabaseData,
      matchSuccess, setMatchSuccess,
      savedAnimals, handleLike, handlePass, handleSave, reportMatchProfile, blockMatchProfile,
      fosterCases,
      fosterApplications, submitFosterApplication, openFosterConversation,
      conversations, sendMessage, reportConversation, blockConversation,
      paymentSessions, createDonationSession,
      dataSource, backendStatus,
      pushStatus, notifyAsk, askForNotifications, answerNotifyAsk,
      authConfigured: isSupabaseConfigured,
      authRequired,
      authSession,
      authLoading,
      authError,
      authNotice,
      paymentReturnNotice,
      handlePaymentReturn,
      clearPaymentReturnNotice,
      handleRecoveryLink, requestPasswordReset, saveNewPassword, passwordRecovery,
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
