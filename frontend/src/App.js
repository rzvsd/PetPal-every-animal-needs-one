import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { AppProvider, useApp } from './context/AppContext';
import MatchesTab from './tabs/MatchesTab';
import FosterTab from './tabs/FosterTab';
import MessagesTab from './tabs/MessagesTab';
import ProfileTab from './tabs/ProfileTab';
import AuthScreen from './screens/AuthScreen';
import Doors from './screens/Doors';
import { EnvironmentBottomTabs, EnvironmentHeader } from './components/EnvironmentNavigation';
import { AnimatePresence, motion } from 'framer-motion';
import { fadeThrough } from './ui/motion';
import { Art, Button, Empty } from './ui/kit';
import { PetMotionProvider } from './components/Motion';
import Launch from './screens/Launch';
import NewPassword from './screens/NewPassword';
import NotificationAsk from './components/NotificationAsk';
import { getEnvironmentHomeTab } from './navigation/environments';
import './App.css';
import { dismissTopLayer } from './navigation/backNavigation';
import { isProductionBuild, isSupabaseConfigured } from './services/supabaseClient';

function AppContent() {
  const { activeTab, setActiveTab, authLoading, authRequired, t, handlePaymentReturn, handleRecoveryLink, passwordRecovery, dataSource,
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
  }, [setActiveTab]);

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
      if (!handlePaymentReturn(event?.url)) handleRecoveryLink(event?.url);
    }).then((handle) => {
      listener = handle;
    });

    return () => {
      listener?.remove();
    };
  }, [handlePaymentReturn, handleRecoveryLink]);

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
        <div className={`petpal-screen ${environment === 'foster' ? 'foster-environment' : ''}`} data-world={environment || undefined}>
          <AnimatePresence>{!introDone && !requestedConversation && <Launch key="launch" onDone={() => setIntroDone(true)} />}</AnimatePresence>
          {!isProductionBuild && <div data-testid="data-source-banner" className="data-source-banner">{t(dataSource === 'mock' ? 'readiness.demo' : dataSource === 'supabase' ? 'readiness.liveTest' : 'readiness.configurationError')}</div>}
          {isProductionBuild && !isSupabaseConfigured ? <div role="alert" className="p-8">{t('readiness.configurationError')}</div> : authLoading ? (
            <div className="pp-state" role="status"><Art name="paw" size={72} play={false} /><p className="ui-small">{t('auth.loading')}</p></div>
          ) : passwordRecovery ? (
            <NewPassword />
          ) : authRequired ? (
            <AuthScreen />
          ) : backendStatus.message === 'readiness.loadError' ? (
            <div role="alert" className="pp-state"><Empty art="paw" title={t('readiness.loadError')}
              action={<Button busy={backendStatus.loading} onClick={() => refreshSupabaseData().catch(() => {})}>{t('readiness.retry')}</Button>} /></div>
          ) : !environment ? (
            <Doors onSelect={enterEnvironment} />
          ) : (
            <>
              <EnvironmentHeader environment={environment} onSwitch={enterEnvironment} />
              {/* Tabs fade through: the old view steps back, the new one settles.
                  Foster's three tabs are one view with its own transitions. */}
              <AnimatePresence mode="wait" initial={false}>
                <motion.main key={`${environment}:${activeTab.startsWith('foster') ? 'foster' : activeTab}`} className="pp-tab-view" {...fadeThrough}>
                  {activeTab === 'matches' && <MatchesTab />}
                  {activeTab.startsWith('foster') && <FosterTab />}
                  {activeTab === 'messages' && <MessagesTab />}
                  {activeTab === 'profile' && <ProfileTab key={environment} environment={environment} />}
                </motion.main>
              </AnimatePresence>
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
