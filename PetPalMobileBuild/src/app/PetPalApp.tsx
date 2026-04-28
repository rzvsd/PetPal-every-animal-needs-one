import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { ActiveTab } from './navigation';
import { AppShell } from '../components/AppShell';
import { BottomTabs } from '../components/BottomTabs';
import { useDiscovery } from '../hooks/useDiscovery';
import { useApplications } from '../hooks/useApplications';
import { useConversations } from '../hooks/useConversations';

import { DiscoverScreen } from '../screens/DiscoverScreen';
import { AnimalDetailScreen } from '../screens/AnimalDetailScreen';
import { ApplicationFlowScreen, ApplicationStep } from '../screens/ApplicationFlowScreen';
import { ApplicationsScreen } from '../screens/ApplicationsScreen';
import { InboxScreen } from '../screens/InboxScreen';
import { ShelterScreen } from '../screens/ShelterScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { WelcomeScreen } from '../screens/WelcomeScreen';

import { ListingMode, Species, ApplicationStatus } from '../types/petpal';
import { demoListings } from '../data/demoListings';

export function PetPalApp() {
  const scrollViewRef = useRef<ScrollView>(null);
  
  // Navigation State
  const [activeTab, setActiveTab] = useState<ActiveTab>('discover');
  const [showWelcome, setShowWelcome] = useState(true);
  const [showDetail, setShowDetail] = useState(false);
  const [showApply, setShowApply] = useState(false);

  // Discover State
  const [modeFilter, setModeFilter] = useState<ListingMode | 'ALL'>('ALL');
  const [speciesFilter, setSpeciesFilter] = useState<Species | 'ALL'>('ALL');
  const [selectedListingId, setSelectedListingId] = useState<string | null>(null);

  // Application Flow State
  const [applicationStep, setApplicationStep] = useState<ApplicationStep>('home');
  const [housingType, setHousingType] = useState('');
  const [animalExperience, setAnimalExperience] = useState('');
  const [motivation, setMotivation] = useState('');

  // Shelter / Review State
  const [reviewStatus, setReviewStatus] = useState<ApplicationStatus>('SUBMITTED');

  // Chat Draft State
  const [chatDraft, setChatDraft] = useState('Hello, I am available to coordinate next steps.');

  const {
    listings,
    dataSource,
    loadMessage,
    isLoading: isLoadingListings,
    refreshListings,
  } = useDiscovery();

  const {
    applications,
    isSubmitting,
    submitMessage,
    refreshApplications,
    submit: submitApplication,
    acceptApplication,
  } = useApplications(dataSource);

  const {
    conversations,
    messages,
    selectedConversationId,
    chatMessage,
    setChatMessage,
    refreshConversations,
    openConversation,
    openConversationForApplication,
    sendMessage,
    report,
    block,
  } = useConversations(dataSource);

  // Effects
  useEffect(() => {
    refreshApplications();
    refreshConversations();
  }, [refreshApplications, refreshConversations]);

  useEffect(() => {
    scrollViewRef.current?.scrollTo({ y: 0, animated: false });
  }, [activeTab, showDetail, showApply]);

  // Derived State
  const filteredListings = useMemo(
    () =>
      listings.filter((listing) => {
        const matchesMode = modeFilter === 'ALL' || listing.mode === modeFilter;
        const matchesSpecies = speciesFilter === 'ALL' || listing.species === speciesFilter;
        return matchesMode && matchesSpecies;
      }),
    [listings, modeFilter, speciesFilter],
  );

  const selectedListing = useMemo(() => {
    return filteredListings.find(l => l.listingId === selectedListingId) 
      ?? filteredListings[0] 
      ?? listings[0] 
      ?? demoListings[0];
  }, [filteredListings, listings, selectedListingId]);

  const applicationReady = useMemo(
    () =>
      housingType.trim().length >= 2 &&
      animalExperience.trim().length >= 20 &&
      motivation.trim().length >= 20,
    [animalExperience, housingType, motivation],
  );

  const latestApplication = applications[0] ?? null;
  const activeConversation = conversations.find(
    (conversation) => conversation.conversationId === selectedConversationId,
  );

  // Handlers
  const handleSelectListing = useCallback((id: string) => {
    setSelectedListingId(id);
    setShowDetail(true);
  }, []);

  const handleStartApplication = useCallback(() => {
    setShowDetail(false);
    setShowApply(true);
    setApplicationStep('home');
  }, []);

  const handleSubmitApplication = useCallback(async () => {
    if (!applicationReady) return;

    const applicationDraft = {
      listingId: selectedListing.listingId,
      applicantAgeConfirmed: true as const,
      housingType: housingType.trim(),
      animalExperience: animalExperience.trim(),
      otherPets: null,
      childrenInHome: null,
      landlordApproval: null,
      motivation: motivation.trim(),
    };

    const success = await submitApplication(applicationDraft);
    if (success) {
      setReviewStatus('SUBMITTED');
      setShowApply(false);
      setActiveTab('applications');
    }
  }, [applicationReady, animalExperience, housingType, motivation, selectedListing.listingId, submitApplication]);

  const handleAcceptApplication = useCallback(async () => {
    if (!latestApplication) {
      setChatMessage('Submit a real application before opening chat.');
      setActiveTab('inbox');
      return;
    }

    const success = await acceptApplication(latestApplication.applicationId);
    if (success) {
      setReviewStatus('ACCEPTED');
      await openConversationForApplication(latestApplication.applicationId);
      setActiveTab('inbox');
    }
  }, [acceptApplication, latestApplication, openConversationForApplication, setChatMessage]);

  const handleNextStep = useCallback(() => {
    const steps: ApplicationStep[] = ['home', 'experience', 'motivation', 'review'];
    const idx = steps.indexOf(applicationStep);
    if (idx < steps.length - 1) {
      setApplicationStep(steps[idx + 1]);
    }
  }, [applicationStep]);

  const handleBackStep = useCallback(() => {
    const steps: ApplicationStep[] = ['home', 'experience', 'motivation', 'review'];
    const idx = steps.indexOf(applicationStep);
    if (idx > 0) {
      setApplicationStep(steps[idx - 1]);
    }
  }, [applicationStep]);

  const handleOpenChat = useCallback((applicationId?: string) => {
    if (applicationId) {
      void openConversationForApplication(applicationId);
    }
    setActiveTab('inbox');
  }, [openConversationForApplication]);

  // Render helpers
  const renderContent = () => {
    if (activeTab === 'discover') {
      if (showApply) {
        return (
          <ApplicationFlowScreen
            animalExperience={animalExperience}
            applicationReady={applicationReady}
            applicationStep={applicationStep}
            housingType={housingType}
            isSubmitting={isSubmitting}
            motivation={motivation}
            onBack={() => setShowApply(false)}
            onBackStep={handleBackStep}
            onNextStep={handleNextStep}
            onSetAnimalExperience={setAnimalExperience}
            onSetApplicationStep={setApplicationStep}
            onSetHousingType={setHousingType}
            onSetMotivation={setMotivation}
            onSubmit={handleSubmitApplication}
            selectedListing={selectedListing}
            submitMessage={submitMessage}
          />
        );
      }
      if (showDetail) {
        return (
          <AnimalDetailScreen
            onApply={handleStartApplication}
            onBack={() => setShowDetail(false)}
            selectedListing={selectedListing}
          />
        );
      }
      return (
        <DiscoverScreen
          dataSource={dataSource}
          filteredListings={filteredListings}
          isLoadingListings={isLoadingListings}
          loadMessage={loadMessage}
          modeFilter={modeFilter}
          onRefresh={refreshListings}
          onSelectListing={handleSelectListing}
          onSetModeFilter={setModeFilter}
          onSetSpeciesFilter={setSpeciesFilter}
          speciesFilter={speciesFilter}
        />
      );
    }

    if (activeTab === 'applications') {
      return (
        <ApplicationsScreen
          applications={applications}
          onOpenChat={handleOpenChat}
        />
      );
    }

    if (activeTab === 'inbox') {
      return (
        <InboxScreen
          activeConversation={activeConversation}
          chatDraft={chatDraft}
          chatMessage={chatMessage}
          conversations={conversations}
          messages={messages}
          onBlock={block}
          onOpenConversation={openConversation}
          onReport={report}
          onSend={() => sendMessage(chatDraft)}
          onSetChatDraft={setChatDraft}
          selectedConversationId={selectedConversationId}
        />
      );
    }

    if (activeTab === 'shelter') {
      return (
        <ShelterScreen
          applications={applications}
          latestApplication={latestApplication}
          listings={listings}
          onAccept={handleAcceptApplication}
          onSetReviewStatus={setReviewStatus}
          reviewStatus={reviewStatus}
          selectedListing={selectedListing}
        />
      );
    }

    if (activeTab === 'profile') {
      return (
        <ProfileScreen
          dataSource={dataSource}
          loadMessage={loadMessage}
          selectedListing={selectedListing}
        />
      );
    }

    return null;
  };

  return (
    <AppShell hideChrome={showWelcome} isLive={dataSource === 'supabase'}>
      {showWelcome ? (
        <WelcomeScreen onStart={() => setShowWelcome(false)} />
      ) : (
        <>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            ref={scrollViewRef}
            showsVerticalScrollIndicator={false}
            style={styles.scrollView}
          >
            {renderContent()}
          </ScrollView>
          <BottomTabs
            activeTab={activeTab}
            onTabPress={(tab) => {
              setActiveTab(tab);
              setShowDetail(false);
              setShowApply(false);
            }}
          />
        </>
      )}
    </AppShell>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 24,
  },
});
