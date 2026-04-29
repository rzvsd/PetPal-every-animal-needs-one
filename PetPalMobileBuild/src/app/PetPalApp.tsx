import { useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { MainTab } from './navigation';
import { AppShell } from '../components/AppShell';
import { BottomTabs } from '../components/BottomTabs';
import { Band, Button, Chip, SectionHeader, TextField } from '../components/ui';
import { createDemoFosterCase, demoFosterCases } from '../data/demoFosterCases';
import { demoFosterPreferences, demoMatchPreferences, demoUserProfile } from '../data/demoUserProfile';
import { colors, radii, spacing, typography } from '../design/tokens';
import {
  emptyFosterApplicationDraft,
  FosterApplicationFlow,
  isFosterApplicationReady,
} from '../screens/foster/FosterApplicationFlow';
import { FosterCaseDetail } from '../screens/foster/FosterCaseDetail';
import { FosterScreen, FosterSection } from '../screens/foster/FosterScreen';
import { ConversationThread } from '../screens/messages/ConversationThread';
import { MessageFilter } from '../screens/messages/MessageFilters';
import { MessagesScreen } from '../screens/messages/MessagesScreen';
import {
  MatchesScreen as MatchesTabScreen,
  MatchDetailScreen as MatchDetailTabScreen,
  MatchSuccessScreen as MatchSuccessTabScreen,
} from '../screens/matches/MatchesScreen';
import { ProfileScreen } from '../screens/profile/ProfileScreen';
import {
  AnimalProfile,
  ChatMessage,
  Conversation,
  FosterApplication,
  FosterApplicationDraft,
  FosterCase,
  MatchCandidate,
  MatchMode,
  Species,
} from '../types/petpal';

type EntryChoice = 'animal' | 'foster' | 'rescuer' | null;
type AppView =
  | 'tabs'
  | 'entry'
  | 'animalEditor'
  | 'matchDetail'
  | 'matchSuccess'
  | 'fosterDetail'
  | 'fosterApplication'
  | 'conversation';

const now = new Date().toISOString();

const initialAnimals: AnimalProfile[] = [
  {
    id: 'animal-max',
    ownerId: 'user-demo',
    name: 'Max',
    species: 'DOG',
    breed: 'Labrador',
    isMixedBreed: false,
    ageMonths: 36,
    sex: 'MALE',
    sizeLabel: 'LARGE',
    weightKg: 29,
    sterilizedStatus: 'NO',
    vaccineStatus: 'UP_TO_DATE',
    healthDocumentStatus: 'VERIFIED',
    adminMateApprovalStatus: 'PENDING',
    temperamentTags: ['calm', 'social', 'gentle'],
    energyLevel: 'MEDIUM',
    goodWithDogs: true,
    goodWithCats: null,
    goodWithChildren: true,
    city: 'Bucharest',
    coarseArea: 'Sector 3',
    photoUrls: [],
    activeMatchModes: ['PLAY', 'SOCIAL', 'VERIFIED_MATE'],
    profileCompleteness: 92,
    verificationStatus: 'VERIFIED',
  },
];

const candidateAnimals: MatchCandidate[] = [
  {
    animal: {
      ...initialAnimals[0],
      id: 'animal-luna',
      ownerId: 'owner-luna',
      name: 'Luna',
      breed: 'Golden Retriever',
      ageMonths: 26,
      sex: 'FEMALE',
      city: 'Bucharest',
      coarseArea: 'Sector 3',
      temperamentTags: ['calm', 'social', 'used to other dogs'],
      profileCompleteness: 96,
      verificationStatus: 'VERIFIED',
      adminMateApprovalStatus: 'VERIFIED',
    },
    mode: 'VERIFIED_MATE',
    hasLikedBack: true,
    compatibilityScore: 84,
    compatibilityReasons: [
      'same species',
      'compatible age',
      'compatible size',
      'nearby area',
      'verified owner',
      'health fields available',
    ],
    ownerVerificationStatus: 'VERIFIED',
    healthDocumentStatus: 'VERIFIED',
    distanceLabel: 'Bucharest / Sector 3',
    exactLocationHidden: true,
  },
  {
    animal: {
      ...initialAnimals[0],
      id: 'animal-nora',
      ownerId: 'owner-nora',
      name: 'Nora',
      breed: 'Metis',
      isMixedBreed: true,
      ageMonths: 20,
      sex: 'FEMALE',
      sizeLabel: 'MEDIUM',
      city: 'Ilfov',
      coarseArea: 'Otopeni',
      activeMatchModes: ['PLAY', 'SOCIAL'],
      temperamentTags: ['playful', 'curious', 'friendly'],
      verificationStatus: 'VERIFIED',
      adminMateApprovalStatus: 'UNVERIFIED',
    },
    mode: 'PLAY',
    hasLikedBack: false,
    compatibilityScore: 78,
    compatibilityReasons: ['similar energy', 'good social fit', 'reachable area'],
    ownerVerificationStatus: 'VERIFIED',
    healthDocumentStatus: 'PENDING',
    distanceLabel: 'Ilfov / Otopeni',
    exactLocationHidden: true,
  },
  {
    animal: {
      ...initialAnimals[0],
      id: 'animal-milo',
      ownerId: 'owner-milo',
      name: 'Milo',
      species: 'CAT',
      breed: 'European Shorthair',
      ageMonths: 18,
      sex: 'MALE',
      sizeLabel: 'SMALL',
      city: 'Bucharest',
      coarseArea: 'Sector 2',
      activeMatchModes: ['SOCIAL'],
      temperamentTags: ['calm', 'clean', 'used to people'],
      verificationStatus: 'PENDING',
    },
    mode: 'SOCIAL',
    hasLikedBack: false,
    compatibilityScore: 64,
    compatibilityReasons: ['complete profile', 'nearby area', 'calm temperament'],
    ownerVerificationStatus: 'PENDING',
    healthDocumentStatus: 'PENDING',
    distanceLabel: 'Bucharest / Sector 2',
    exactLocationHidden: true,
  },
];

export function PetPalApp() {
  const scrollViewRef = useRef<ScrollView>(null);
  const [activeTab, setActiveTab] = useState<MainTab>('matches');
  const [view, setView] = useState<AppView>('entry');
  const [entryChoice, setEntryChoice] = useState<EntryChoice>(null);
  const [animals, setAnimals] = useState(initialAnimals);
  const [selectedAnimalId, setSelectedAnimalId] = useState(initialAnimals[0]?.id ?? '');
  const [matchMode, setMatchMode] = useState<MatchMode>('PLAY');
  const [speciesFilter, setSpeciesFilter] = useState<Species | 'ALL'>('ALL');
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [candidateIndex, setCandidateIndex] = useState(0);
  const [selectedCandidate, setSelectedCandidate] = useState<MatchCandidate | null>(null);
  const [likeNotice, setLikeNotice] = useState<string | null>(null);
  const [fosterSection, setFosterSection] = useState<FosterSection>('find');
  const [fosterCases, setFosterCases] = useState(demoFosterCases);
  const [selectedFosterCase, setSelectedFosterCase] = useState<FosterCase | null>(null);
  const [applications, setApplications] = useState<FosterApplication[]>([]);
  const [applicationDraft, setApplicationDraft] = useState<FosterApplicationDraft>(emptyFosterApplicationDraft);
  const [applicationStep, setApplicationStep] = useState(0);
  const [messageFilter, setMessageFilter] = useState<MessageFilter>('all');
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messageDraft, setMessageDraft] = useState('');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [animalForm, setAnimalForm] = useState({
    name: 'Bella',
    breed: 'Mixed breed',
    city: 'Bucharest',
    coarseArea: 'Sector 2',
  });
  const isRescuer = entryChoice === 'rescuer';

  const selectedAnimal = animals.find((animal) => animal.id === selectedAnimalId) ?? animals[0] ?? null;
  const verifiedMateEligibility = selectedAnimal ? getVerifiedMateEligibility(selectedAnimal) : [];
  const canUseVerifiedMate = verifiedMateEligibility.every((item) => item.done);

  function goToTab(tab: MainTab) {
    setActiveTab(tab);
    setView('tabs');
    setLikeNotice(null);
    scrollViewRef.current?.scrollTo({ y: 0, animated: false });
  }

  function handleEntry(choice: Exclude<EntryChoice, null>) {
    setEntryChoice(choice);
    if (choice === 'animal') {
      setActiveTab('matches');
      setView(animals.length ? 'tabs' : 'animalEditor');
    } else if (choice === 'foster') {
      setActiveTab('foster');
      setView('tabs');
    } else {
      setActiveTab('foster');
      setFosterSection('manage');
      setView('tabs');
    }
  }

  function addAnimal() {
    const nextAnimal: AnimalProfile = {
      id: `animal-${Date.now()}`,
      ownerId: 'user-demo',
      name: animalForm.name.trim() || 'My animal',
      species: 'DOG',
      breed: animalForm.breed.trim() || null,
      isMixedBreed: true,
      ageMonths: 24,
      sex: 'UNKNOWN',
      sizeLabel: 'MEDIUM',
      weightKg: null,
      sterilizedStatus: 'UNKNOWN',
      vaccineStatus: 'PARTIAL',
      healthDocumentStatus: 'PENDING',
      adminMateApprovalStatus: 'UNVERIFIED',
      temperamentTags: ['gentle', 'curious'],
      energyLevel: 'MEDIUM',
      goodWithDogs: true,
      goodWithCats: null,
      goodWithChildren: null,
      city: animalForm.city.trim() || 'Bucharest',
      coarseArea: animalForm.coarseArea.trim() || null,
      photoUrls: [],
      activeMatchModes: ['PLAY', 'SOCIAL'],
      profileCompleteness: 68,
      verificationStatus: 'PENDING',
    };
    setAnimals((current) => [...current, nextAnimal]);
    setSelectedAnimalId(nextAnimal.id);
    setView('tabs');
    setActiveTab('matches');
  }

  function handleCandidateAction(candidate: MatchCandidate, action: 'like' | 'pass' | 'save') {
    if (!selectedAnimal) return;
    if (action === 'like' && candidate.hasLikedBack) {
      const conversation = createMatchConversation(selectedAnimal.name, candidate);
      setConversations((current) => [conversation, ...current]);
      setSelectedConversation(conversation);
      setSelectedCandidate(candidate);
      setLikeNotice(null);
      setView('matchSuccess');
      return;
    }

    if (action === 'like') {
      setLikeNotice(`Like sent for ${candidate.animal.name}. Conversation opens only after a mutual match.`);
    } else if (action === 'save') {
      setLikeNotice(`${candidate.animal.name} was saved.`);
    } else {
      setLikeNotice(null);
    }
    setCandidateIndex((current) => current + 1);
  }

  function submitFosterApplication() {
    if (!selectedFosterCase || !isFosterApplicationReady(applicationDraft)) return;
    const application: FosterApplication = {
      id: `application-${Date.now()}`,
      fosterCaseId: selectedFosterCase.id,
      applicantId: 'user-demo',
      status: 'SUBMITTED',
      housingType: applicationDraft.housingType,
      experience: applicationDraft.experience,
      availability: applicationDraft.availability,
      otherPets: applicationDraft.otherPets,
      childrenInHome: applicationDraft.childrenInHome,
      canTransport: applicationDraft.canTransport,
      canHandleMedicalNeeds: applicationDraft.canHandleMedicalNeeds,
      motivation: applicationDraft.motivation,
      createdAt: now,
    };
    setApplications((current) => [application, ...current]);
    setFosterSection('applications');
    setApplicationStep(0);
    setApplicationDraft(emptyFosterApplicationDraft);
    setView('tabs');
  }

  function acceptApplication(application: FosterApplication) {
    const fosterCase = fosterCases.find((item) => item.id === application.fosterCaseId);
    setApplications((current) =>
      current.map((item) => (item.id === application.id ? { ...item, status: 'ACCEPTED' } : item)),
    );
    if (fosterCase) {
      const conversation = createFosterConversation(fosterCase);
      setConversations((current) => [conversation, ...current]);
      setSelectedConversation(conversation);
      setActiveTab('messages');
      setView('conversation');
    }
  }

  function rejectApplication(application: FosterApplication) {
    setApplications((current) =>
      current.map((item) => (item.id === application.id ? { ...item, status: 'REJECTED' } : item)),
    );
  }

  function openAcceptedFosterConversation(application: FosterApplication) {
    if (application.status !== 'ACCEPTED') return;
    const fosterCase = fosterCases.find((item) => item.id === application.fosterCaseId);
    if (!fosterCase) return;
    const existingConversation = conversations.find(
      (conversation) => conversation.source === 'FOSTER' && conversation.title === fosterCase.animalName,
    );
    const conversation = existingConversation ?? createFosterConversation(fosterCase);
    if (!existingConversation) {
      setConversations((current) => [conversation, ...current]);
    }
    setSelectedConversation(conversation);
    setActiveTab('messages');
    setView('conversation');
  }

  function markFosterFound(fosterCase: FosterCase) {
    setFosterCases((current) =>
      current.map((item) => (item.id === fosterCase.id ? { ...item, status: 'FOSTER_FOUND' } : item)),
    );
  }

  function archiveFosterCase(fosterCase: FosterCase) {
    setFosterCases((current) =>
      current.map((item) => (item.id === fosterCase.id ? { ...item, status: 'ARCHIVED' } : item)),
    );
  }

  function sendMessage() {
    if (!selectedConversation || !messageDraft.trim()) return;
    const sentAt = new Date().toISOString();
    const nextMessage: ChatMessage = {
      id: `message-${Date.now()}`,
      messageId: `message-${Date.now()}`,
      senderDisplayName: 'Me',
      sender: 'Me',
      body: messageDraft.trim(),
      createdAt: sentAt,
      isMine: true,
    };
    setConversations((current) =>
      current.map((conversation) =>
        conversation.id === selectedConversation.id
          ? {
              ...conversation,
              lastMessage: nextMessage.body,
              lastMessageAt: sentAt,
              messages: [...conversation.messages, nextMessage],
            }
          : conversation,
      ),
    );
    setSelectedConversation((current) =>
      current
        ? { ...current, lastMessage: nextMessage.body, lastMessageAt: sentAt, messages: [...current.messages, nextMessage] }
        : current,
    );
    setMessageDraft('');
  }

  const content = (() => {
    if (view === 'entry') return <EntryChoiceScreen onChoose={handleEntry} />;
    if (view === 'animalEditor') {
      return (
        <AnimalProfileEditor
          form={animalForm}
          onBack={() => setView('tabs')}
          onChange={setAnimalForm}
          onSave={addAnimal}
        />
      );
    }
    if (view === 'matchDetail' && selectedCandidate && selectedAnimal) {
      return (
        <MatchDetailTabScreen
          candidate={selectedCandidate}
          onBack={() => setView('tabs')}
          onLike={() => {
            handleCandidateAction(selectedCandidate, 'like');
            if (!selectedCandidate.hasLikedBack) {
              setView('tabs');
            }
          }}
          selectedAnimalName={selectedAnimal.name}
        />
      );
    }
    if (view === 'matchSuccess' && selectedCandidate && selectedAnimal) {
      return (
        <MatchSuccessTabScreen
          candidate={selectedCandidate}
          onOpenMessages={() => {
            setActiveTab('messages');
            setView('conversation');
          }}
          selectedAnimalName={selectedAnimal.name}
        />
      );
    }
    if (view === 'fosterDetail' && selectedFosterCase) {
      return (
        <FosterCaseDetail
          fosterCase={selectedFosterCase}
          onApply={() => setView('fosterApplication')}
          onBack={() => setView('tabs')}
        />
      );
    }
    if (view === 'fosterApplication' && selectedFosterCase) {
      return (
        <FosterApplicationFlow
          draft={applicationDraft}
          fosterCase={selectedFosterCase}
          onBack={() => setView('fosterDetail')}
          onChange={setApplicationDraft}
          onStepChange={setApplicationStep}
          onSubmit={submitFosterApplication}
          step={applicationStep}
        />
      );
    }
    if (view === 'conversation' && selectedConversation) {
      return (
        <ConversationThread
          conversation={selectedConversation}
          draft={messageDraft}
          onBack={() => setView('tabs')}
          onBlock={() => markConversation(selectedConversation.id, 'blocked')}
          onDraft={setMessageDraft}
          onReport={() => markConversation(selectedConversation.id, 'reported')}
          onSend={sendMessage}
          onViewApplication={() => {
            setActiveTab('foster');
            setFosterSection('applications');
            setView('tabs');
          }}
          onViewContext={() => openConversationContext(selectedConversation)}
        />
      );
    }
    if (activeTab === 'matches') {
      return (
        <MatchesTabScreen
          animals={animals}
          candidateIndex={candidateIndex}
          candidates={candidateAnimals}
          canUseVerifiedMate={canUseVerifiedMate}
          eligibility={verifiedMateEligibility}
          likeNotice={likeNotice}
          matchMode={matchMode}
          onAction={handleCandidateAction}
          onAddAnimal={() => setView('animalEditor')}
          onOpenDetail={(candidate) => {
            setSelectedCandidate(candidate);
            setView('matchDetail');
          }}
          onSelectAnimal={setSelectedAnimalId}
          onSetMatchMode={(mode) => {
            setMatchMode(mode);
            setCandidateIndex(0);
            setLikeNotice(null);
          }}
          onSetSpeciesFilter={(species) => {
            setSpeciesFilter(species);
            setCandidateIndex(0);
            setLikeNotice(null);
          }}
          onSetVerifiedOnly={(value) => {
            setVerifiedOnly(value);
            setCandidateIndex(0);
            setLikeNotice(null);
          }}
          selectedAnimal={selectedAnimal}
          speciesFilter={speciesFilter}
          verifiedOnly={verifiedOnly}
        />
      );
    }
    if (activeTab === 'foster') {
      return (
        <FosterScreen
          applications={applications}
          fosterCases={fosterCases}
          isRescuer={isRescuer}
          onAcceptApplication={acceptApplication}
          onActiveCases={() => setFosterSection('manage')}
          onAddCase={() => setFosterCases((current) => [createDemoFosterCase(), ...current])}
          onArchiveCase={archiveFosterCase}
          onMarkFosterFound={markFosterFound}
          onOpenCase={(fosterCase) => {
            setSelectedFosterCase(fosterCase);
            setView('fosterDetail');
          }}
          onOpenMessages={openAcceptedFosterConversation}
          onRejectApplication={rejectApplication}
          onRequestAccess={() => {
            setEntryChoice('rescuer');
            setFosterSection('manage');
          }}
          onSection={setFosterSection}
          section={fosterSection}
        />
      );
    }
    if (activeTab === 'messages') {
      return (
        <MessagesScreen
          conversations={conversations}
          filter={messageFilter}
          onFilter={setMessageFilter}
          onGoFoster={() => {
            setActiveTab('foster');
            setFosterSection('find');
          }}
          onGoMatches={() => {
            setActiveTab('matches');
          }}
          onOpen={(conversation) => {
            setSelectedConversation(conversation);
            setView('conversation');
          }}
        />
      );
    }
    return (
      <ProfileScreen
        animals={animals}
        eligibility={verifiedMateEligibility}
        fosterPreferences={demoFosterPreferences}
        matchPreferences={demoMatchPreferences}
        onAddAnimal={() => setView('animalEditor')}
        onEditAnimal={(animal) => {
          setSelectedAnimalId(animal.id);
          setAnimalForm({
            name: animal.name,
            breed: animal.breed ?? 'Mixed breed',
            city: animal.city,
            coarseArea: animal.coarseArea ?? '',
          });
          setView('animalEditor');
        }}
        onEditFosterPreferences={() => {
          setActiveTab('foster');
          setFosterSection('find');
        }}
        onEditMatchPreferences={() => {
          setActiveTab('matches');
        }}
        onEditNotifications={() => {
          setActiveTab('messages');
        }}
        onEditProfile={() => undefined}
        onManageVerification={() => undefined}
        onMatchSettings={(animal) => {
          setSelectedAnimalId(animal.id);
          setActiveTab('matches');
        }}
        userProfile={demoUserProfile}
      />
    );
  })();

  function markConversation(id: string, flag: 'blocked' | 'reported') {
    setConversations((current) =>
      current.map((conversation) => (conversation.id === id ? { ...conversation, [flag]: true } : conversation)),
    );
    setSelectedConversation((current) => (current?.id === id ? { ...current, [flag]: true } : current));
  }

  function openConversationContext(conversation: Conversation) {
    if (conversation.source === 'FOSTER') {
      const fosterCase = fosterCases.find((item) => item.animalName === conversation.animalName);
      if (fosterCase) {
        setSelectedFosterCase(fosterCase);
        setView('fosterDetail');
        return;
      }
      setActiveTab('foster');
      setFosterSection('applications');
      setView('tabs');
      return;
    }

    const candidate = candidateAnimals.find((item) => item.animal.name === conversation.relatedAnimalName);
    if (candidate) {
      setSelectedCandidate(candidate);
      setView('matchDetail');
      return;
    }
    setActiveTab('matches');
    setView('tabs');
  }

  return (
    <AppShell hideChrome={view === 'entry'} isLive={false}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        ref={scrollViewRef}
        showsVerticalScrollIndicator={false}
        style={styles.scrollView}
      >
        {content}
      </ScrollView>
      {view !== 'entry' ? <BottomTabs activeTab={activeTab} onTabPress={goToTab} /> : null}
    </AppShell>
  );
}

function EntryChoiceScreen({ onChoose }: { onChoose: (choice: Exclude<EntryChoice, null>) => void }) {
  return (
    <View style={styles.entry}>
      <Text style={styles.entryBrand}>PetPal</Text>
      <Text style={styles.entryTitle}>Every animal deserves their person.</Text>
      <Text style={styles.entryBody}>What do you want to do?</Text>
      <Button label="I have an animal and want matches" onPress={() => onChoose('animal')} tone="primary" />
      <Button label="I want to offer foster" onPress={() => onChoose('foster')} tone="secondary" />
      <Button label="I am a rescuer / shelter" onPress={() => onChoose('rescuer')} tone="quiet" />
    </View>
  );
}

function AnimalProfileEditor({
  form,
  onChange,
  onSave,
  onBack,
}: {
  form: { name: string; breed: string; city: string; coarseArea: string };
  onChange: (form: { name: string; breed: string; city: string; coarseArea: string }) => void;
  onSave: () => void;
  onBack: () => void;
}) {
  return (
    <View style={styles.stack}>
      <Button label="Back" onPress={onBack} tone="quiet" />
      <SectionHeader
        eyebrow="Animal profile"
        title="Create animal profile"
        detail="Local demo for species, breed, age, sex, size, health, temperament, coarse location, and goals."
      />
      <Band>
        <TextField label="Name" onChangeText={(name) => onChange({ ...form, name })} placeholder="Max" value={form.name} />
        <TextField label="Breed" onChangeText={(breed) => onChange({ ...form, breed })} placeholder="Labrador" value={form.breed} />
        <TextField label="City" onChangeText={(city) => onChange({ ...form, city })} placeholder="Bucharest" value={form.city} />
        <TextField
          label="Area"
          onChangeText={(coarseArea) => onChange({ ...form, coarseArea })}
          placeholder="Sector 3"
          value={form.coarseArea}
        />
        <Text style={styles.muted}>
          Fields included in demo: species, mixed breed, age, sex, size, weight, sterilization, vaccines, temperament, energy, good with dogs/cats/children, photos, and active goals.
        </Text>
      </Band>
      <Button label="Save animal profile" onPress={onSave} tone="primary" />
    </View>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function getVerifiedMateEligibility(animal: AnimalProfile) {
  const ageEligible = (animal.ageMonths ?? 0) >= 18;
  return [
    { label: 'Owner verified', done: animal.verificationStatus === 'VERIFIED' },
    { label: 'Animal profile complete', done: animal.profileCompleteness >= 85 },
    { label: 'Age eligible', done: ageEligible },
    { label: 'Sex known', done: animal.sex !== 'UNKNOWN' },
    { label: 'Sterilization status known', done: animal.sterilizedStatus !== 'UNKNOWN' },
    { label: 'Vaccines set', done: animal.vaccineStatus !== 'UNKNOWN' },
    { label: 'Health documents uploaded', done: animal.healthDocumentStatus === 'VERIFIED' },
    { label: 'Admin approval if required', done: animal.adminMateApprovalStatus === 'VERIFIED' },
  ];
}

function createMatchConversation(selectedAnimalName: string, candidate: MatchCandidate): Conversation {
  const createdAt = new Date().toISOString();
  return {
    id: `conversation-match-${Date.now()}`,
    source: 'MATCH',
    title: `${selectedAnimalName} + ${candidate.animal.name}`,
    subtitle: `Match / ${modeLabel(candidate.mode)}`,
    contextLabel: 'This chat opened after a mutual match.',
    privacyLabel: 'Exact location private',
    animalName: selectedAnimalName,
    relatedAnimalName: candidate.animal.name,
    mode: candidate.mode,
    ownerVerified: candidate.ownerVerificationStatus === 'VERIFIED',
    city: candidate.animal.city,
    coarseArea: candidate.animal.coarseArea,
    lastMessage: 'Can we discuss documents?',
    lastMessageAt: createdAt,
    messages: [
      {
        id: 'm1',
        messageId: 'm1',
        senderDisplayName: candidate.animal.name,
        sender: candidate.animal.name,
        body: 'Hi! Can we discuss documents and a first safe meeting?',
        createdAt,
        isMine: false,
      },
    ],
  };
}

function createFosterConversation(fosterCase: FosterCase): Conversation {
  const createdAt = new Date().toISOString();
  return {
    id: `conversation-foster-${Date.now()}`,
    source: 'FOSTER',
    title: fosterCase.animalName,
    subtitle: 'Foster / Application accepted',
    contextLabel: 'This chat opened after the foster request was accepted.',
    privacyLabel: 'Exact location private',
    animalName: fosterCase.animalName,
    fosterStatus: 'ACCEPTED',
    organizationName: fosterCase.rescuerName,
    organizationVerified: fosterCase.rescuerVerified,
    city: fosterCase.city,
    coarseArea: fosterCase.coarseArea,
    lastMessage: 'We can coordinate transport Friday.',
    lastMessageAt: createdAt,
    messages: [
      {
        id: 'f1',
        messageId: 'f1',
        senderDisplayName: fosterCase.rescuerName,
        sender: fosterCase.rescuerName,
        body: 'The application was accepted. Can we coordinate transport Friday?',
        createdAt,
        isMine: false,
      },
    ],
  };
}

function modeLabel(mode: MatchMode) {
  return mode === 'PLAY' ? 'Play' : mode === 'SOCIAL' ? 'Social' : 'Verified Mate';
}

function sexLabel(sex: AnimalProfile['sex']) {
  return sex === 'MALE' ? 'Male' : sex === 'FEMALE' ? 'Female' : 'Sex unknown';
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    gap: spacing.md,
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  stack: {
    gap: spacing.md,
  },
  entry: {
    flex: 1,
    gap: spacing.md,
    justifyContent: 'center',
    minHeight: 620,
    padding: spacing.xl,
  },
  entryBrand: {
    color: colors.forest,
    fontFamily: 'serif',
    fontSize: 44,
    fontWeight: '900',
  },
  entryTitle: {
    color: colors.ink,
    fontSize: typography.headline,
    fontWeight: '900',
    lineHeight: 32,
  },
  entryBody: {
    color: colors.inkMuted,
    fontSize: typography.bodyLarge,
    fontWeight: '700',
  },
  wrapRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  rowBetween: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  flex: {
    flex: 1,
  },
  label: {
    color: colors.ink,
    fontSize: typography.caption,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  muted: {
    color: colors.inkMuted,
    fontSize: typography.small,
    fontWeight: '600',
    lineHeight: 20,
  },
  bodyText: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: '600',
    lineHeight: 23,
  },
  meta: {
    color: colors.inkMuted,
    fontSize: typography.small,
    fontWeight: '800',
    lineHeight: 19,
  },
  cardName: {
    color: colors.ink,
    fontSize: typography.title,
    fontWeight: '900',
    lineHeight: 27,
  },
  darkTitle: {
    color: colors.cream,
    fontSize: typography.title,
    fontWeight: '900',
  },
  heroCard: {
    overflow: 'hidden',
  },
  photoBlock: {
    alignItems: 'center',
    aspectRatio: 1.15,
    backgroundColor: colors.forest,
    borderRadius: radii.md,
    justifyContent: 'center',
  },
  photoInitial: {
    color: colors.cream,
    fontFamily: 'serif',
    fontSize: 88,
    fontWeight: '900',
  },
  checks: {
    gap: spacing.xxs,
  },
  check: {
    color: colors.forest,
    fontSize: typography.small,
    fontWeight: '800',
    lineHeight: 20,
  },
  missing: {
    color: colors.clay,
    fontSize: typography.small,
    fontWeight: '800',
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  actionButton: {
    flex: 1,
    minWidth: 96,
  },
  success: {
    marginTop: spacing.xxl,
  },
  successTitle: {
    color: colors.forest,
    fontSize: typography.hero,
    fontWeight: '900',
    lineHeight: 39,
  },
  inlineCard: {
    borderColor: colors.borderSoft,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.sm,
  },
  metrics: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  metric: {
    backgroundColor: 'rgba(255, 248, 236, 0.10)',
    borderColor: 'rgba(255, 248, 236, 0.18)',
    borderRadius: radii.md,
    borderWidth: 1,
    flex: 1,
    padding: spacing.sm,
  },
  metricValue: {
    color: colors.cream,
    fontSize: typography.title,
    fontWeight: '900',
  },
  metricLabel: {
    color: colors.sky,
    fontSize: typography.micro,
    fontWeight: '900',
    lineHeight: 14,
    textTransform: 'uppercase',
  },
  bubble: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing.xs,
    maxWidth: '88%',
    padding: spacing.md,
  },
  myBubble: {
    alignSelf: 'flex-end',
    backgroundColor: colors.sageMist,
  },
  pressed: {
    opacity: 0.75,
  },
});



