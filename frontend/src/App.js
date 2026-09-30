import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { AppProvider, useApp } from './context/AppContext';
import MatchesTab from './tabs/MatchesTab';
import FosterTab from './tabs/FosterTab';
import MessagesTab from './tabs/MessagesTab';
import ProfileTab from './tabs/ProfileTab';
import AuthScreen from './screens/AuthScreen';
import EnvironmentChooser from './screens/EnvironmentChooser';
import { EnvironmentBottomTabs, EnvironmentHeader } from './components/EnvironmentNavigation';
import { AnimatePresence } from 'framer-motion';
import { PetMotionProvider } from './components/Motion';
import IntroReel from './components/IntroReel';
import NotificationAsk from './components/NotificationAsk';
import { getEnvironmentHomeTab } from './navigation/environments';
import './App.css';
import { dismissTopLayer } from './navigation/backNavigation';
import { isProductionBuild, isSupabaseConfigured } from './services/supabaseClient';

const SPACE_KEY = 'petpal:space';

function AppContent() {
  const { activeTab, setActiveTab, authLoading, authRequired, t, handlePaymentReturn, dataSource,
    backendStatus, refreshSupabaseData, requestedConversation } = useApp();
  const [environment, setEnvironment] = useState(null);
  const [introDone, setIntroDone] = useState(false);
  const backStateRef = useRef({ activeTab, authLoading, authRequired, environment });

  useEffect(() => {
    backStateRef.current = { activeTab, authLoading, authRequired, environment };
  }, [activeTab, authLoading, authRequired, environment]);

  useEffect(() => {
    if (authRequired) {
      setEnvironment(null);
    }
  }, [authRequired]);

  const enterEnvironment = useCallback((nextEnvironment) => {
    setEnvironment(nextEnvironment);
    setActiveTab(getEnvironmentHomeTab(nextEnvironment));
    try { localStorage.setItem(SPACE_KEY, nextEnvironment); } catch { /* The chooser simply shows next time. */ }
  }, [setActiveTab]);

  const leaveEnvironment = () => {
    if (dismissTopLayer()) return;
    try { localStorage.removeItem(SPACE_KEY); } catch { /* Nothing remembered. */ }
    setEnvironment(null);
  };

  // Reopen the space the person used last instead of asking every time.
  useEffect(() => {
    if (authLoading || authRequired || environment || requestedConversation) return;
    let saved = null;
    try { saved = localStorage.getItem(SPACE_KEY); } catch { saved = null; }
    if (saved === 'match' || saved === 'foster') enterEnvironment(saved);
  }, [authLoading, authRequired, environment, requestedConversation, enterEnvironment]);

  const handleAppBack = useCallback(() => {
    if (dismissTopLayer()) return;
    const current = backStateRef.current;
    if (current.authLoading || current.authRequired || !current.environment) return;

    const homeTab = getEnvironmentHomeTab(current.environment);
    if (current.activeTab !== homeTab) {
      setActiveTab(homeTab);
      return;
    }

    // Back from a home tab leaves the app, like any Android app, instead of
    // dropping the person on the space chooser.
    if (Capacitor.isNativePlatform()) CapacitorApp.minimizeApp().catch(() => {});
  }, [setActiveTab]);

  useEffect(() => {
    if (requestedConversation && !authRequired) {
      // The inbox covers both spaces, so stay in the current one if there is one.
      setEnvironment(current => current || (requestedConversation.source === 'FOSTER' ? 'foster' : 'match'));
      setActiveTab('messages');
    }
  }, [requestedConversation, authRequired, setActiveTab]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.history?.pushState) return undefined;

    const pushBackGuard = () => {
      window.history.pushState({ petpalBackGuard: true }, '', window.location.href);
    };

    pushBackGuard();

    const handleBack = () => {
      pushBackGuard();
      handleAppBack();
    };

    window.addEventListener('popstate', handleBack);

    return () => {
      window.removeEventListener('popstate', handleBack);
    };
  }, [handleAppBack]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return undefined;

    let listener;

    CapacitorApp.addListener('backButton', () => {
      handleAppBack();
    }).then((handle) => {
      listener = handle;
    });

    return () => {
      listener?.remove();
    };
  }, [handleAppBack]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return undefined;

    let listener;

    CapacitorApp.addListener('appUrlOpen', (event) => {
      handlePaymentReturn(event?.url);
    }).then((handle) => {
      listener = handle;
    });

    return () => {
      listener?.remove();
    };
  }, [handlePaymentReturn]);

  useEffect(() => {
    const resize = () => document.documentElement.style.setProperty(
      '--app-height', `${window.visualViewport?.height || window.innerHeight}px`,
    );
    resize();
    window.visualViewport?.addEventListener('resize', resize);
    window.addEventListener('resize', resize);
    return () => {
      window.visualViewport?.removeEventListener('resize', resize);
      window.removeEventListener('resize', resize);
    };
  }, []);
  return (
    <div className="petpal-container">
      <div className="petpal-frame">
        <div className={`petpal-screen ${environment === 'foster' ? 'foster-environment' : ''}`}>
          <AnimatePresence>{!introDone && !requestedConversation && <IntroReel key="intro" onDone={() => setIntroDone(true)} />}</AnimatePresence>
          {!isProductionBuild && <div data-testid="data-source-banner" className="data-source-banner">{t(dataSource === 'mock' ? 'readiness.demo' : dataSource === 'supabase' ? 'readiness.liveTest' : 'readiness.configurationError')}</div>}
          {isProductionBuild && !isSupabaseConfigured ? <div role="alert" className="p-8">{t('readiness.configurationError')}</div> : authLoading ? (
            <div className="flex flex-1 items-center justify-center bg-[var(--pp-bg)] px-8 text-center">
              <div className="space-y-3">
                <div className="mx-auto h-12 w-12 animate-pulse rounded-2xl bg-[#E3ECE4]" />
                <p className="text-sm font-medium text-[#57645C]">{t('auth.loading')}</p>
              </div>
            </div>
          ) : authRequired ? (
            <AuthScreen />
          ) : backendStatus.message === 'readiness.loadError' ? (
            <div role="alert" className="p-6 space-y-4"><p>{t('readiness.loadError')}</p>
              <button type="button" className="match-action-primary" onClick={() => refreshSupabaseData().catch(() => {})}>{t('readiness.retry')}</button></div>
          ) : !environment ? (
            <EnvironmentChooser onSelect={enterEnvironment} />
          ) : (
            <>
              <EnvironmentHeader environment={environment} onBack={leaveEnvironment} />
              {activeTab === 'matches' && <MatchesTab />}
              {['foster', 'foster-find', 'foster-mine'].includes(activeTab) && <FosterTab />}
              {activeTab === 'messages' && <MessagesTab />}
              {activeTab === 'profile' && <ProfileTab key={environment} environment={environment} />}
              <EnvironmentBottomTabs environment={environment} />
              <NotificationAsk />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <AppProvider>
      <PetMotionProvider><AppContent /></PetMotionProvider>
    </AppProvider>
  );
}

export default App;
