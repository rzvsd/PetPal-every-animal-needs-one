import React, { useState } from 'react';
import { LayoutGroup, motion } from 'framer-motion';
import { Check, ChevronDown, Heart, MessageCircle, PawPrint, Search, Sun, User } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useReducedPetMotion } from './Motion';
import DialogLayer from './DialogLayer';
import { Art, Avatar, Count, Row } from '../ui/kit';
import { spring } from '../ui/motion';
import {
  FOSTER_ENVIRONMENT,
  MATCH_ENABLED,
  MATCH_ENVIRONMENT,
  getEnvironmentHomeTab,
} from '../navigation/environments';

const SPACES = [
  [MATCH_ENVIRONMENT, 'heart', 'environment.matchTitle', 'environment.matchDescription', 'MATCH'],
  [FOSTER_ENVIRONMENT, 'house', 'environment.fosterTitle', 'environment.fosterDescription', 'FOSTER'],
].filter(([key]) => MATCH_ENABLED || key !== MATCH_ENVIRONMENT);

function useUnread() {
  const { messaging, dataSource, conversations } = useApp();
  if (dataSource === 'supabase') return messaging.unreadTotals;
  return conversations.reduce((totals, conversation) => ({ ...totals,
    [conversation.source]: (totals[conversation.source] || 0) + (conversation.unread || 0) }), { MATCH: 0, FOSTER: 0 });
}

// Picking an animal for Match: the same sheet pattern as switching spaces.
function AnimalSwitch() {
  const { t, myAnimals, selectedAnimalId, setSelectedAnimalId } = useApp();
  const [open, setOpen] = useState(false);
  const selected = myAnimals.find(animal => animal.id === selectedAnimalId);
  if (!myAnimals.length) return null;
  return <>
    <button type="button" data-testid="animal-selector" className="pp-bar-animal" onClick={() => setOpen(true)}
      aria-haspopup="dialog" aria-label={`${t('common.selectAnimal')}: ${selected?.name || ''}`}>
      <Avatar src={selected?.photoUrls?.[0]} name={selected?.name} species={selected?.species} size={34} className="is-round" />
      <span>{selected?.name || t('common.selectAnimal')}</span><ChevronDown size={16} aria-hidden="true" />
    </button>
    <DialogLayer open={open} onClose={() => setOpen(false)} sheet draggable label={t('common.selectAnimal')}>
      <div className="pp-sheet"><h2 className="ui-title-m pp-sheet-title">{t('common.selectAnimal')}</h2>
        <div className="ui-list ui-list-inset pp-sheet-list">{myAnimals.map(animal => <Row key={animal.id} data-testid={`animal-option-${animal.name.toLowerCase()}`}
          leading={<Avatar src={animal.photoUrls?.[0]} name={animal.name} species={animal.species} size={52} />}
          title={animal.name} subtitle={animal.breed} onClick={() => { setSelectedAnimalId(animal.id); setOpen(false); }}
          trailing={animal.id === selectedAnimalId ? <Check size={20} className="pp-check" aria-label={t('common.selected')} /> : <span />} />)}</div>
      </div>
    </DialogLayer>
  </>;
}

export function EnvironmentHeader({ environment, onSwitch }) {
  const { t, activeTab } = useApp();
  const [open, setOpen] = useState(false);
  const unread = useUnread();
  const current = SPACES.find(([key]) => key === environment);
  const other = SPACES.find(([key]) => key !== environment);
  const otherUnread = other ? unread[other[4]] || 0 : 0;

  // With one space there is nothing to switch to, so the name is just a label.
  if (!other) return <header className="pp-bar">
    <span className="pp-bar-space"><Art name={current[1]} size={30} play={false} /><span>{t(current[2])}</span></span>
  </header>;

  return <header className="pp-bar">
    <button type="button" data-testid="back-to-environments" className="pp-bar-space" onClick={() => setOpen(true)}
      aria-haspopup="dialog" aria-label={t('environment.switchSpace')}>
      <Art name={current[1]} size={30} play={false} />
      <span>{t(current[2])}</span>
      <ChevronDown size={16} aria-hidden="true" />
      {otherUnread > 0 && <span className="pp-bar-dot" aria-hidden="true" />}
    </button>
    {environment === MATCH_ENVIRONMENT && activeTab === 'matches' && <AnimalSwitch />}
    <DialogLayer open={open} onClose={() => setOpen(false)} sheet draggable label={t('environment.switchSpace')}>
      <div className="pp-sheet"><h2 className="ui-title-m pp-sheet-title">{t('environment.switchSpace')}</h2>
        <div className="ui-list pp-sheet-list">{SPACES.map(([key, art, title, description, source]) => <Row key={key}
          data-testid={`choose-${key}-environment`} leading={<Art name={art} size={52} play={false} />}
          title={t(title)} subtitle={t(description)}
          trailing={key === environment ? <Check size={20} className="pp-check" aria-label={t('common.selected')} /> : <Count value={unread[source]} />}
          onClick={() => { setOpen(false); if (key !== environment) onSwitch(key); }} />)}</div>
      </div>
    </DialogLayer>
  </header>;
}

export function EnvironmentBottomTabs({ environment }) {
  const { activeTab, setActiveTab, t } = useApp();
  const reduced = useReducedPetMotion();
  const unread = useUnread();
  const isFoster = environment === FOSTER_ENVIRONMENT;
  const tabs = [
    { key: getEnvironmentHomeTab(environment), icon: isFoster ? Sun : Heart, label: isFoster ? t('fx.tabToday') : t('readiness.discover') },
    ...(isFoster ? [{ key: 'foster-find', icon: Search, label: t('fx.tabFind') },
      { key: 'foster-mine', icon: PawPrint, label: t('fx.tabMine') }] : []),
    { key: 'messages', icon: MessageCircle, label: t('tabs.messages') },
    { key: 'profile', icon: User, label: t('tabs.profile') },
  ];
  // Only this space's inbox counts here; the other space keeps its own badge.
  const unreadCount = unread[isFoster ? 'FOSTER' : 'MATCH'] || 0;

  return <LayoutGroup id={`navigation-${environment}`}>
    <nav data-testid="bottom-tabs" aria-label="PetPal" className="pp-tabs petpal-bottom-tabs">
      {tabs.map(tab => {
        const active = activeTab === tab.key;
        const Icon = tab.icon;
        return <motion.button type="button" key={tab.key} data-testid={`tab-${tab.key}`} aria-label={tab.label}
          aria-current={active ? 'page' : undefined} whileTap={reduced ? undefined : { scale: 0.94 }}
          onClick={() => { if (!active) setActiveTab(tab.key); }} className="pp-tab">
          {active && <motion.span layoutId={reduced ? undefined : 'tab-mark'} className="pp-tab-mark" transition={spring} />}
          <span className="pp-tab-icon">
            <Icon size={23} strokeWidth={active ? 2.3 : 1.75} aria-hidden="true" />
            {tab.key === 'messages' && <Count value={unreadCount} className="ui-count-float" />}
          </span>
          <span className="pp-tab-label">{tab.label}</span>
        </motion.button>;
      })}
    </nav>
  </LayoutGroup>;
}
