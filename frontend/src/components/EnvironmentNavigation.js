import React from 'react';
import { ArrowLeft, Compass, ClipboardList, Heart, Home, MessageCircle, User } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { AnimalSelector } from './SharedComponents';
import {
  FOSTER_ENVIRONMENT,
  getEnvironmentConversations,
  getEnvironmentHomeTab,
} from '../navigation/environments';

export function EnvironmentHeader({ environment, onBack }) {
  const { t, activeTab, myAnimals, selectedAnimalId, setSelectedAnimalId } = useApp();
  const isFoster = environment === FOSTER_ENVIRONMENT;
  const Icon = isFoster ? Home : Heart;

  if (!isFoster && activeTab === 'matches') return <header className="match-header">
    <button type="button" data-testid="back-to-environments" onClick={onBack} aria-label={t('environment.backToSpaces')} className="shrink-0 min-h-11 min-w-8"><ArrowLeft size={20} /></button>
    <h1 className="font-heading text-lg font-bold leading-tight">{t('environment.matchTitle')}</h1>
    <div className="ml-auto min-w-0 max-w-[48%]"><AnimalSelector animals={myAnimals} selectedId={selectedAnimalId} onSelect={setSelectedAnimalId} compact /></div>
  </header>;

  return (
    <header className={`flex min-h-14 items-center gap-3 border-b border-[#E4E2DC]/70 bg-white/90 px-4 backdrop-blur-xl ${isFoster ? 'foster-header' : ''}`}>
      <button
        type="button"
        data-testid="back-to-environments"
        onClick={onBack}
        aria-label={t('environment.backToSpaces')}
        title={t('environment.backToSpaces')}
        className="flex h-11 w-11 items-center justify-center rounded-xl text-[#2C402B] transition-colors hover:bg-[#F0EDE8]"
      >
        <ArrowLeft size={20} />
      </button>
      <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${isFoster ? 'bg-[#F5DDD0]' : 'bg-[#E3ECE4]'}`}>
        <Icon size={17} className={isFoster ? 'text-[#8B4C2F]' : 'text-[#2C402B]'} />
      </div>
      <div className="min-w-0">
        <p className="truncate text-xs font-semibold uppercase tracking-wider text-[#57645C]">{t('environment.currentSpace')}</p>
        <p className="truncate font-heading text-sm font-bold text-[#1F2924]">
          {isFoster ? t('environment.fosterTitle') : t('environment.matchTitle')}
        </p>
      </div>
    </header>
  );
}

export function EnvironmentBottomTabs({ environment }) {
  const { activeTab, setActiveTab, t, conversations, messaging, dataSource } = useApp();
  const homeTab = getEnvironmentHomeTab(environment);
  const isFoster = environment === FOSTER_ENVIRONMENT;
  const tabs = [
    {
      key: homeTab,
      icon: isFoster ? Compass : Heart,
      label: isFoster ? t('care.explore') : t('readiness.discover'),
    },
    ...(isFoster ? [{ key: 'foster-home', icon: Home, label: t('care.home') },
      { key: 'foster-requests', icon: ClipboardList, label: t('care.requests') }] : []),
    { key: 'messages', icon: MessageCircle, label: t('tabs.messages') },
    { key: 'profile', icon: User, label: t('tabs.profile') },
  ];
  const unreadCount = dataSource === 'supabase' ? messaging.unreadTotals[isFoster ? 'FOSTER' : 'MATCH'] : getEnvironmentConversations(conversations, environment)
    .reduce((total, conversation) => total + (conversation.unread || 0), 0);

  return (
    <nav data-testid="bottom-tabs" aria-label="PetPal" className={`petpal-bottom-tabs h-[68px] bg-white/95 backdrop-blur-xl border-t border-[#E4E2DC] flex justify-around items-center z-50 px-8 ${isFoster ? 'foster-bottom-nav' : ''}`}>
      {tabs.map((tab) => {
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
            className={`relative flex h-full w-20 flex-col items-center justify-center transition-all duration-200 ${
              isActive ? 'text-[#2C402B]' : 'text-[#57645C]'
            }`}
          >
            <div className="relative">
              <Icon
                size={22}
                strokeWidth={isActive ? 2.5 : 1.8}
                fill={isActive && tab.key === 'matches' ? '#9BAE96' : 'none'}
              />
              {showBadge && (
                <span className="absolute -right-1.5 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#8B4C2F] text-[10px] font-bold text-white">
                  {unreadCount}
                </span>
              )}
            </div>
            <span className="mt-1 text-[10px] font-semibold tracking-wide">{tab.label}</span>
            {isActive && (
              <div className="absolute left-1/2 top-0 h-[3px] w-8 -translate-x-1/2 rounded-b-full bg-[#9BAE96]" />
            )}
          </button>
        );
      })}
    </nav>
  );
}
