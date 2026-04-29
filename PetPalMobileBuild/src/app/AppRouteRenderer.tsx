import { MainTab } from './navigation';
import { useAppNavigation } from './useAppNavigation';
import { demoMatchCandidates } from '../data/demoMatchCandidates';
import { EligibilityItem } from '../domain/verification';
import { useDemoUser } from '../hooks/useDemoUser';
import { useFosterFlow } from '../hooks/useFosterFlow';
import { useMatchFlow } from '../hooks/useMatchFlow';
import { useMessageConversations } from '../hooks/useMessageConversations';
import { useMyAnimals } from '../hooks/useMyAnimals';
import { AnimalProfileEditor } from '../screens/animals/AnimalProfileEditor';
import { FosterApplicationFlow } from '../screens/foster/FosterApplicationFlow';
import { FosterCaseDetail } from '../screens/foster/FosterCaseDetail';
import { FosterScreen } from '../screens/foster/FosterScreen';
import { ConversationThread } from '../screens/messages/ConversationThread';
import { MessagesScreen } from '../screens/messages/MessagesScreen';
import {
  MatchesScreen as MatchesTabScreen,
  MatchDetailScreen as MatchDetailTabScreen,
  MatchSuccessScreen as MatchSuccessTabScreen,
} from '../screens/matches/MatchesScreen';
import { EntryChoiceScreen } from '../screens/onboarding/EntryChoiceScreen';
import { ProfileScreen } from '../screens/profile/ProfileScreen';
import { Conversation, EntryChoice } from '../types/petpal';

type NavigationState = ReturnType<typeof useAppNavigation>;
type DemoUserState = ReturnType<typeof useDemoUser>;
type AnimalsState = ReturnType<typeof useMyAnimals>;
type MatchFlowState = ReturnType<typeof useMatchFlow>;
type FosterFlowState = ReturnType<typeof useFosterFlow>;
type ConversationState = ReturnType<typeof useMessageConversations>;

export function AppRouteRenderer({
  animals,
  canUseVerifiedMate,
  conversations,
  foster,
  matches,
  navigation,
  onChooseEntry,
  onOpenTab,
  user,
  verifiedMateEligibility,
}: {
  animals: AnimalsState;
  canUseVerifiedMate: boolean;
  conversations: ConversationState;
  foster: FosterFlowState;
  matches: MatchFlowState;
  navigation: NavigationState;
  onChooseEntry: (choice: Exclude<EntryChoice, null>) => void;
  onOpenTab: (tab: MainTab) => void;
  user: DemoUserState;
  verifiedMateEligibility: EligibilityItem[];
}) {
  function openConversationForApplication(applicationId: string) {
    const application = foster.applications.find((item) => item.id === applicationId);
    if (!application || application.status !== 'ACCEPTED') return;

    const fosterCase = foster.fosterCases.find((item) => item.id === application.fosterCaseId);
    if (!fosterCase) return;

    const conversation = conversations.createFosterConversation(fosterCase, application);
    navigation.openConversation(conversation.id);
  }

  function openConversationContext(conversation: Conversation) {
    if (conversation.source === 'FOSTER') {
      if (conversation.fosterCaseId) {
        const fosterCase = foster.fosterCases.find((item) => item.id === conversation.fosterCaseId);
        if (fosterCase) {
          navigation.openFosterDetail(fosterCase.id);
          return;
        }
      }

      foster.setSection('applications');
      onOpenTab('foster');
      return;
    }

    if (conversation.candidateId) {
      const candidate = demoMatchCandidates.find((item) => item.animal.id === conversation.candidateId);
      if (candidate) {
        navigation.openMatchDetail(candidate.animal.id);
        return;
      }
    }

    onOpenTab('matches');
  }

  function renderTab(tab: MainTab) {
    if (tab === 'matches') {
      return (
        <MatchesTabScreen
          animals={animals.animals}
          candidateIndex={matches.candidateIndex}
          candidates={demoMatchCandidates}
          canUseVerifiedMate={canUseVerifiedMate}
          eligibility={verifiedMateEligibility}
          likeNotice={matches.likeNotice}
          matchMode={matches.matchMode}
          onAction={matches.actOnCandidate}
          onAddAnimal={() => {
            animals.prepareAnimalDraft();
            navigation.openAnimalEditor();
          }}
          onOpenDetail={(candidate) => navigation.openMatchDetail(candidate.animal.id)}
          onSelectAnimal={animals.selectAnimal}
          onSeeVerifiedMateRequirements={() => onOpenTab('profile')}
          onSetMatchMode={matches.setMode}
          onSetSpeciesFilter={matches.setSpeciesFilter}
          onSetVerifiedOnly={matches.setVerifiedOnly}
          selectedAnimal={animals.selectedAnimal}
          speciesFilter={matches.speciesFilter}
          verifiedOnly={matches.verifiedOnly}
        />
      );
    }

    if (tab === 'foster') {
      return (
        <FosterScreen
          applications={foster.applications}
          fosterCases={foster.fosterCases}
          isDemoRescuerPreview={user.isDemoRescuerPreview}
          isRescuer={user.canManageFoster}
          onAcceptApplication={foster.acceptApplication}
          onActiveCases={() => foster.setSection('manage')}
          onAddCase={foster.addCase}
          onArchiveCase={foster.archiveCase}
          onMarkFosterFound={foster.markFosterFound}
          onOpenCase={(fosterCase) => navigation.openFosterDetail(fosterCase.id)}
          onOpenDemoPreview={() => {
            user.openRescuerDemoPreview();
            foster.setSection('manage');
          }}
          onOpenMessages={(application) => openConversationForApplication(application.id)}
          onRejectApplication={foster.rejectApplication}
          onRequestAccess={() => {
            user.requestRescuerAccess();
            foster.setSection('find');
          }}
          onSection={foster.setSection}
          rescuerAccessState={user.rescuerAccessState}
          section={foster.section}
        />
      );
    }

    if (tab === 'messages') {
      return (
        <MessagesScreen
          conversations={conversations.conversations}
          filter={conversations.messageFilter}
          onFilter={conversations.setMessageFilter}
          onGoFoster={() => {
            foster.setSection('find');
            onOpenTab('foster');
          }}
          onGoMatches={() => onOpenTab('matches')}
          onOpen={(conversation) => navigation.openConversation(conversation.id)}
        />
      );
    }

    return (
      <ProfileScreen
        animals={animals.animals}
        eligibility={verifiedMateEligibility}
        fosterPreferences={user.fosterPreferences}
        matchPreferences={user.matchPreferences}
        onAddAnimal={() => {
          animals.prepareAnimalDraft();
          navigation.openAnimalEditor();
        }}
        onEditAnimal={(animal) => {
          animals.selectAnimal(animal.id);
          animals.prepareAnimalDraft(animal.id);
          navigation.openAnimalEditor(animal.id);
        }}
        onEditFosterPreferences={() => {
          foster.setSection('find');
          onOpenTab('foster');
        }}
        onEditMatchPreferences={() => onOpenTab('matches')}
        onEditNotifications={() => onOpenTab('messages')}
        onMatchSettings={(animal) => {
          animals.selectAnimal(animal.id);
          onOpenTab('matches');
        }}
        userProfile={user.userProfile}
      />
    );
  }

  const { route } = navigation;

  if (route.name === 'entry') {
    return <EntryChoiceScreen onChoose={onChooseEntry} />;
  }

  if (route.name === 'animalEditor') {
    return (
      <AnimalProfileEditor
        form={animals.animalDraft}
        isEditing={Boolean(route.animalId)}
        onBack={navigation.openCurrentTab}
        onChange={animals.setAnimalDraft}
        onSave={() => {
          const savedAnimal = animals.saveAnimalDraft(route.animalId);
          if (savedAnimal) navigation.openCurrentTab();
        }}
      />
    );
  }

  if (route.name === 'matchDetail') {
    const candidate = demoMatchCandidates.find((item) => item.animal.id === route.candidateId);
    if (candidate && animals.selectedAnimal) {
      return (
        <MatchDetailTabScreen
          candidate={candidate}
          onBack={() => onOpenTab('matches')}
          onLike={() => {
            matches.actOnCandidate(candidate, 'like');
            if (!candidate.hasLikedBack) onOpenTab('matches');
          }}
          selectedAnimalName={animals.selectedAnimal.name}
        />
      );
    }
    return renderTab('matches');
  }

  if (route.name === 'matchSuccess') {
    const candidate = demoMatchCandidates.find((item) => item.animal.id === route.candidateId);
    if (candidate && animals.selectedAnimal) {
      return (
        <MatchSuccessTabScreen
          candidate={candidate}
          onOpenMessages={() => navigation.openConversation(route.conversationId)}
          selectedAnimalName={animals.selectedAnimal.name}
        />
      );
    }
    return renderTab('matches');
  }

  if (route.name === 'fosterDetail') {
    const fosterCase = foster.fosterCases.find((item) => item.id === route.fosterCaseId);
    if (fosterCase) {
      return (
        <FosterCaseDetail
          fosterCase={fosterCase}
          onApply={() => navigation.openFosterApplication(fosterCase.id)}
          onBack={() => onOpenTab('foster')}
        />
      );
    }
    return renderTab('foster');
  }

  if (route.name === 'fosterApplication') {
    const fosterCase = foster.fosterCases.find((item) => item.id === route.fosterCaseId);
    if (fosterCase) {
      return (
        <FosterApplicationFlow
          draft={foster.applicationDraft}
          fosterCase={fosterCase}
          onBack={() => navigation.openFosterDetail(fosterCase.id)}
          onChange={foster.setApplicationDraft}
          onStepChange={foster.setApplicationStep}
          onSubmit={() => {
            const application = foster.submitApplication(fosterCase.id);
            if (application) onOpenTab('foster');
          }}
          step={foster.applicationStep}
        />
      );
    }
    return renderTab('foster');
  }

  if (route.name === 'conversation') {
    const conversation = conversations.getConversation(route.conversationId);
    if (conversation) {
      return (
        <ConversationThread
          conversation={conversation}
          draft={conversations.messageDraft}
          onBack={() => onOpenTab('messages')}
          onBlock={() => conversations.markConversation(conversation.id, 'blocked')}
          onDraft={conversations.setMessageDraft}
          onReport={() => conversations.markConversation(conversation.id, 'reported')}
          onSend={() => conversations.sendMessage(conversation.id)}
          onViewApplication={() => {
            foster.setSection('applications');
            onOpenTab('foster');
          }}
          onViewContext={() => openConversationContext(conversation)}
        />
      );
    }
    return renderTab('messages');
  }

  return renderTab(route.tab);
}
