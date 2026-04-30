import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import MatchesTab from './tabs/MatchesTab';
import FosterTab from './tabs/FosterTab';
import MessagesTab from './tabs/MessagesTab';
import ProfileTab from './tabs/ProfileTab';
import AuthScreen from './screens/AuthScreen';
import { Heart, Home, MessageCircle, User } from 'lucide-react';
import './App.css';

function BottomTabs() {
  const { activeTab, setActiveTab, t, conversations } = useApp();

  const tabs = [
    { key: 'matches', icon: Heart, label: t('tabs.matches') },
    { key: 'foster', icon: Home, label: t('tabs.foster') },
    { key: 'messages', icon: MessageCircle, label: t('tabs.messages') },
    { key: 'profile', icon: User, label: t('tabs.profile') },
  ];

  const unreadCount = conversations.reduce((acc, c) => acc + (c.unread || 0), 0);

  return (
    <nav data-testid="bottom-tabs" aria-label="PetPal" className="absolute bottom-0 left-0 right-0 h-[68px] bg-white/95 backdrop-blur-xl border-t border-[#E4E2DC] flex justify-around items-center z-50 px-2">
      {tabs.map(tab => {
        const isActive = activeTab === tab.key;
        const Icon = tab.icon;
        const showBadge = tab.key === 'messages' && unreadCount > 0;

        return (
          <button
            type="button"
            key={tab.key}
            data-testid={`tab-${tab.key}`}
            onClick={() => setActiveTab(tab.key)}
            aria-label={tab.label}
            aria-current={isActive ? 'page' : undefined}
            className={`flex flex-col items-center justify-center w-16 h-full relative transition-all duration-200 ${
              isActive ? 'text-[#2C402B]' : 'text-[#57645C]'
            }`}
          >
            <div className="relative">
              <Icon
                size={22}
                strokeWidth={isActive ? 2.5 : 1.8}
                className={`transition-all duration-200 ${isActive ? 'text-[#2C402B]' : 'text-[#57645C]'}`}
                fill={isActive ? (tab.key === 'matches' ? '#9BAE96' : 'none') : 'none'}
              />
              {showBadge && (
                <span className="absolute -top-1 -right-1.5 w-4 h-4 bg-[#8B4C2F] text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </div>
            <span className={`text-[10px] mt-1 font-semibold tracking-wide ${isActive ? 'text-[#2C402B]' : 'text-[#57645C]'}`}>
              {tab.label}
            </span>
            {isActive && (
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[3px] bg-[#9BAE96] rounded-b-full" />
            )}
          </button>
        );
      })}
    </nav>
  );
}

function AppContent() {
  const { activeTab, authLoading, authRequired, t } = useApp();

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
          ) : (
            <>
              {activeTab === 'matches' && <MatchesTab />}
              {activeTab === 'foster' && <FosterTab />}
              {activeTab === 'messages' && <MessagesTab />}
              {activeTab === 'profile' && <ProfileTab />}
              <BottomTabs />
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
