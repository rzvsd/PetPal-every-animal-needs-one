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
import {
  getEnvironmentConversationSource,
  getEnvironmentHomeTab,
} from './navigation/environments';
import './App.css';

function AppContent() {
  const { activeTab, setActiveTab, authLoading, authRequired, t, handlePaymentReturn } = useApp();
  const [environment, setEnvironment] = useState(null);
  const backStateRef = useRef({ activeTab, authLoading, authRequired, environment });

  useEffect(() => {
    backStateRef.current = { activeTab, authLoading, authRequired, environment };
  }, [activeTab, authLoading, authRequired, environment]);

  useEffect(() => {
    if (authRequired) {
      setEnvironment(null);
    }
  }, [authRequired]);

  const enterEnvironment = (nextEnvironment) => {
    setEnvironment(nextEnvironment);
    setActiveTab(getEnvironmentHomeTab(nextEnvironment));
  };

  const leaveEnvironment = () => {
    setEnvironment(null);
  };

  const handleAppBack = useCallback(() => {
    const current = backStateRef.current;
    if (current.authLoading || current.authRequired || !current.environment) return;

    const homeTab = getEnvironmentHomeTab(current.environment);
    if (current.activeTab !== homeTab) {
      setActiveTab(homeTab);
      return;
    }

    setEnvironment(null);
  }, [setActiveTab]);

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
    if (!Capacitor.isNativePlatform()) return undefined;

    let activeScroller = null;
    let lastY = 0;
    let lastX = 0;

    const findScroller = (target) => {
      if (!(target instanceof Element)) return document.querySelector('.petpal-screen');
      return target.closest('.overflow-y-auto') || document.querySelector('.petpal-screen');
    };

    const handleTouchStart = (event) => {
      const touch = event.touches?.[0];
      if (!touch) return;
      activeScroller = findScroller(event.target);
      lastY = touch.clientY;
      lastX = touch.clientX;
    };

    const handleTouchMove = (event) => {
      const touch = event.touches?.[0];
      if (!touch || !activeScroller) return;

      const deltaY = lastY - touch.clientY;
      const deltaX = lastX - touch.clientX;

      if (Math.abs(deltaY) < 3 || Math.abs(deltaY) < Math.abs(deltaX)) {
        lastY = touch.clientY;
        lastX = touch.clientX;
        return;
      }

      if (activeScroller.scrollHeight <= activeScroller.clientHeight) {
        activeScroller = document.querySelector('.petpal-screen');
      }

      if (!activeScroller || activeScroller.scrollHeight <= activeScroller.clientHeight) {
        return;
      }

      const before = activeScroller.scrollTop;
      activeScroller.scrollTop += deltaY;
      lastY = touch.clientY;
      lastX = touch.clientX;

      if (activeScroller.scrollTop !== before) {
        event.preventDefault();
      }
    };

    const handleTouchEnd = () => {
      activeScroller = null;
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });
    document.addEventListener('touchcancel', handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
      document.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, []);

  return (
    <div className="petpal-container">
      <div className="petpal-frame">
        <div className="petpal-screen">
          {authLoading ? (
            <div className="flex flex-1 items-center justify-center bg-[#F8F7F4] px-8 text-center">
              <div className="space-y-3">
                <div className="mx-auto h-12 w-12 animate-pulse rounded-2xl bg-[#E3ECE4]" />
                <p className="text-sm font-medium text-[#57645C]">{t('auth.loading')}</p>
              </div>
            </div>
          ) : authRequired ? (
            <AuthScreen />
          ) : !environment ? (
            <EnvironmentChooser onSelect={enterEnvironment} />
          ) : (
            <>
              <EnvironmentHeader environment={environment} onBack={leaveEnvironment} />
              {activeTab === 'matches' && <MatchesTab />}
              {activeTab === 'foster' && <FosterTab />}
              {activeTab === 'messages' && (
                <MessagesTab
                  key={environment}
                  source={getEnvironmentConversationSource(environment)}
                />
              )}
              {activeTab === 'profile' && <ProfileTab key={environment} environment={environment} />}
              <EnvironmentBottomTabs environment={environment} />
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
      <AppContent />
    </AppProvider>
  );
}

export default App;
