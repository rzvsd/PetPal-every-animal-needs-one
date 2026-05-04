import { useRef } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { AppRouteRenderer } from './AppRouteRenderer';
import { MainTab } from './navigation';
import { useAppNavigation } from './useAppNavigation';
import { AppShell } from '../components/AppShell';
import { BottomTabs } from '../components/BottomTabs';
import { getVerifiedMateEligibility } from '../domain/verification';
import { useDemoUser } from '../hooks/useDemoUser';
import { useFosterFlow } from '../hooks/useFosterFlow';
import { useMatchFlow } from '../hooks/useMatchFlow';
import { useMessageConversations } from '../hooks/useMessageConversations';
import { useMyAnimals } from '../hooks/useMyAnimals';
import { spacing } from '../design/tokens';
import { EntryChoice } from '../types/petpal';

export function PetPalApp() {
  const scrollViewRef = useRef<ScrollView>(null);
  const navigation = useAppNavigation();
  const user = useDemoUser();
  const animals = useMyAnimals();
  const conversations = useMessageConversations();

  const foster = useFosterFlow({
    onApplicationAccepted: (application, fosterCase) => {
      const conversation = conversations.createFosterConversation(fosterCase, application);
      navigation.openConversation(conversation.id);
    },
  });

  const verifiedMateEligibility = animals.selectedAnimal
    ? getVerifiedMateEligibility(animals.selectedAnimal)
    : [];
  const canUseVerifiedMate = verifiedMateEligibility.every((item) => item.done);

  const matches = useMatchFlow({
    selectedAnimal: animals.selectedAnimal,
    onMutualMatch: (candidate) => {
      if (!animals.selectedAnimal) return;

      const conversation = conversations.createMatchConversation(animals.selectedAnimal.name, candidate);
      navigation.openMatchSuccess(candidate.animal.id, conversation.id);
    },
  });

  function openTab(tab: MainTab) {
    navigation.openTab(tab);
    scrollViewRef.current?.scrollTo({ y: 0, animated: false });
  }

  function handleEntry(choice: Exclude<EntryChoice, null>) {
    user.chooseEntry(choice);

    if (choice === 'animal') {
      if (animals.animals.length) {
        openTab('matches');
      } else {
        animals.prepareAnimalDraft();
        navigation.openAnimalEditor();
      }
      return;
    }

    if (choice === 'foster') {
      openTab('foster');
      return;
    }

    foster.setSection('manage');
    openTab('foster');
  }

  return (
    <AppShell hideChrome={navigation.route.name === 'entry'} isLive={false}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        ref={scrollViewRef}
        showsVerticalScrollIndicator={false}
        style={styles.scrollView}
      >
        <AppRouteRenderer
          animals={animals}
          canUseVerifiedMate={canUseVerifiedMate}
          conversations={conversations}
          foster={foster}
          matches={matches}
          navigation={navigation}
          onChooseEntry={handleEntry}
          onOpenTab={openTab}
          user={user}
          verifiedMateEligibility={verifiedMateEligibility}
        />
      </ScrollView>
      {navigation.route.name !== 'entry' ? (
        <BottomTabs activeTab={navigation.activeTab} onTabPress={openTab} />
      ) : null}
    </AppShell>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    gap: spacing.md,
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  scrollView: {
    flex: 1,
  },
});
