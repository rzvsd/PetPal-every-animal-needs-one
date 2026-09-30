import React from 'react';
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion';
import { ArrowLeft, ArrowLeftRight, Heart, Home, MessageCircle, PawPrint, Search, Sun, User } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { AnimalSelector } from './SharedComponents';
import { useReducedPetMotion } from './Motion';
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

  // A slim bar on the page's own background: which space you are in, and one
  // tap to switch. Pages carry their own big titles below it.
  return (
    <header className="petpal-space-bar">
      <button type="button" data-testid="back-to-environments" onClick={onBack} className="petpal-space-pill"
        aria-label={t('environment.switchSpace')} title={t('environment.switchSpace')}>
        <span className={`petpal-space-icon ${isFoster ? 'is-foster' : ''}`}><Icon size={15} /></span>
        <span>{isFoster ? t('environment.fosterTitle') : t('environment.matchTitle')}</span>
        <ArrowLeftRight size={14} className="petpal-space-switch" />
      </button>
    </header>
  );
}

export function EnvironmentBottomTabs({ environment }) {
  const { activeTab, setActiveTab, t, conversations, messaging, dataSource } = useApp();
  const reduced = useReducedPetMotion();
  const homeTab = getEnvironmentHomeTab(environment);
  const isFoster = environment === FOSTER_ENVIRONMENT;
  const tabs = [
    {
      key: homeTab,
      icon: isFoster ? Sun : Heart,
      label: isFoster ? t('fx.tabToday') : t('readiness.discover'),
    },
    ...(isFoster ? [{ key: 'foster-find', icon: Search, label: t('fx.tabFind') },
      { key: 'foster-mine', icon: PawPrint, label: t('fx.tabMine') }] : []),
    { key: 'messages', icon: MessageCircle, label: t('tabs.messages') },
    { key: 'profile', icon: User, label: t('tabs.profile') },
  ];
  const unreadCount = dataSource === 'supabase' ? messaging.unreadTotals[isFoster ? 'FOSTER' : 'MATCH'] : getEnvironmentConversations(conversations, environment)
    .reduce((total, conversation) => total + (conversation.unread || 0), 0);

  return (
    <LayoutGroup id={`navigation-${environment}`}>
    <nav data-testid="bottom-tabs" aria-label="PetPal" className={`petpal-bottom-tabs h-[68px] bg-white/95 backdrop-blur-xl border-t border-[#E4E2DC] flex justify-around items-center z-50 px-8 ${isFoster ? 'foster-bottom-nav' : ''}`}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key;
        const Icon = tab.icon;
        const showBadge = tab.key === 'messages' && unreadCount > 0;

        return (
          <motion.button
            type="button"
            key={tab.key}
            data-testid={`tab-${tab.key}`}
            onClick={() => { if (activeTab !== tab.key) setActiveTab(tab.key); }}
            whileTap={reduced ? undefined : { scale: 0.98 }}
            aria-label={tab.label}
            aria-current={isActive ? 'page' : undefined}
            className={`relative flex h-full w-20 flex-col items-center justify-center transition-all duration-200 ${
              isActive ? 'text-[#2C402B]' : 'text-[#57645C]'
            }`}
          >
            <motion.div className="relative z-10" initial={false}
              animate={isActive && !reduced ? { y: [0, -7, 0], rotate: [0, -10, 6, 0], scale: [1, 1.15, 1] } : { y: 0, rotate: 0, scale: 1 }}
              transition={{ duration: reduced ? 0 : 0.45 }}>
              <Icon
                size={22}
                strokeWidth={isActive ? 2.5 : 1.8}
                fill={isActive && tab.key === 'matches' ? '#9BAE96' : 'none'}
              />
              <AnimatePresence initial={false}>{showBadge && (
                <motion.span key={unreadCount} initial={{ opacity: 0, y: reduced ? 0 : 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  transition={{ duration: 0.18 }} className="absolute -right-1.5 -top-1 flex h-4 min-w-4 px-0.5 items-center justify-center rounded-full bg-[#8B4C2F] text-[10px] font-bold text-white">
                  {unreadCount}
                </motion.span>
              )}</AnimatePresence>
            </motion.div>
            <span className="mt-1 text-[10px] font-semibold tracking-wide">{tab.label}</span>
            {isActive && (
              <motion.span layoutId={reduced ? undefined : 'active-tab'} transition={{ type: 'spring', stiffness: 360, damping: 26 }} className="petpal-nav-indicator" />
            )}
          </motion.button>
        );
      })}
    </nav>
    </LayoutGroup>
  );
}
