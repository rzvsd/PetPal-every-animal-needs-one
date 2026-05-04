import { useState } from 'react';

import { MainTab } from './navigation';
import { AppRoute } from './routes';

export function useAppNavigation() {
  const [activeTab, setActiveTab] = useState<MainTab>('matches');
  const [route, setRoute] = useState<AppRoute>({ name: 'entry' });

  function openTab(tab: MainTab) {
    setActiveTab(tab);
    setRoute({ name: 'tabs', tab });
  }

  function openCurrentTab() {
    setRoute({ name: 'tabs', tab: activeTab });
  }

  function openAnimalEditor(animalId?: string) {
    setRoute({ name: 'animalEditor', animalId });
  }

  function openMatchDetail(candidateId: string) {
    setActiveTab('matches');
    setRoute({ name: 'matchDetail', candidateId });
  }

  function openMatchSuccess(candidateId: string, conversationId: string) {
    setActiveTab('matches');
    setRoute({ name: 'matchSuccess', candidateId, conversationId });
  }

  function openFosterDetail(fosterCaseId: string) {
    setActiveTab('foster');
    setRoute({ name: 'fosterDetail', fosterCaseId });
  }

  function openFosterApplication(fosterCaseId: string) {
    setActiveTab('foster');
    setRoute({ name: 'fosterApplication', fosterCaseId });
  }

  function openConversation(conversationId: string) {
    setActiveTab('messages');
    setRoute({ name: 'conversation', conversationId });
  }

  return {
    activeTab,
    route,
    openAnimalEditor,
    openConversation,
    openCurrentTab,
    openFosterApplication,
    openFosterDetail,
    openMatchDetail,
    openMatchSuccess,
    openTab,
  };
}
