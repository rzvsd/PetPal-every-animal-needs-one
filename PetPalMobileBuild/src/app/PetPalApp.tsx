import { useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { MainTab } from './navigation';
import { AppShell } from '../components/AppShell';
import { BottomTabs } from '../components/BottomTabs';
import { Band, Button, Chip, EmptyState, InfoRow, SectionHeader, StatusBadge, TextField } from '../components/ui';
import { colors, radii, spacing, typography } from '../design/tokens';
import {
  AnimalProfile,
  ChatMessage,
  Conversation,
  FosterApplication,
  FosterApplicationStatus,
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
type FosterSection = 'find' | 'applications' | 'manage';
type MessageFilter = 'all' | 'matches' | 'foster';

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
    compatibilityScore: 84,
    compatibilityReasons: [
      'aceeasi specie',
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
    compatibilityScore: 64,
    compatibilityReasons: ['complete profile', 'nearby area', 'calm temperament'],
    ownerVerificationStatus: 'PENDING',
    healthDocumentStatus: 'PENDING',
    distanceLabel: 'Bucharest / Sector 2',
    exactLocationHidden: true,
  },
];

const initialFosterCases: FosterCase[] = [
  {
    id: 'foster-bruno',
    animalId: 'animal-bruno',
    organizationId: 'hope-rescue',
    rescuerId: 'rescuer-1',
    title: 'Bruno needs urgent foster',
    animalName: 'Bruno',
    species: 'DOG',
    ageMonths: 24,
    sizeLabel: 'MEDIUM',
    description: 'Foster need 2-4 saptamani pentru recuperare calma.',
    status: 'ACTIVE',
    urgency: 'HIGH',
    duration: 'ONE_TWO_WEEKS',
    foodCovered: true,
    vetCovered: true,
    transportAvailable: true,
    medicalNeeds: 'Vaccines started. Quiet recovery after light treatment.',
    homeFit: 'Household calma, preferabil fara copii mici.',
    city: 'Bucharest',
    coarseArea: 'Sector 4',
    exactLocationPrivate: 'hidden',
    rescuerName: 'Hope Rescue',
    rescuerVerified: true,
    createdAt: now,
  },
  {
    id: 'foster-iris',
    animalId: 'animal-iris',
    organizationId: 'cat-safe',
    rescuerId: 'rescuer-2',
    title: 'Iris needs foster until adoption',
    animalName: 'Iris',
    species: 'CAT',
    ageMonths: 9,
    sizeLabel: 'SMALL',
    description: 'Young gentle cat, needs a separate room for a few days.',
    status: 'ACTIVE',
    urgency: 'MEDIUM',
    duration: 'UNTIL_ADOPTION',
    foodCovered: true,
    vetCovered: true,
    transportAvailable: false,
    medicalNeeds: null,
    homeFit: 'Calm apartment, no dominant animals.',
    city: 'Bucharest',
    coarseArea: 'Sector 1',
    exactLocationPrivate: 'hidden',
    rescuerName: 'Cat Safe',
    rescuerVerified: true,
    createdAt: now,
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
  const [fosterSection, setFosterSection] = useState<FosterSection>('find');
  const [fosterCases, setFosterCases] = useState(initialFosterCases);
  const [selectedFosterCase, setSelectedFosterCase] = useState<FosterCase | null>(null);
  const [applications, setApplications] = useState<FosterApplication[]>([]);
  const [applicationDraft, setApplicationDraft] = useState({
    housingType: '',
    experience: '',
    availability: '',
    household: '',
    motivation: '',
  });
  const [applicationStep, setApplicationStep] = useState(0);
  const [messageFilter, setMessageFilter] = useState<MessageFilter>('all');
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messageDraft, setMessageDraft] = useState('');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [animalForm, setAnimalForm] = useState({
    name: 'Bella',
    breed: 'Metis',
    city: 'Bucharest',
    coarseArea: 'Sector 2',
  });
  const isRescuer = entryChoice === 'rescuer';

  const selectedAnimal = animals.find((animal) => animal.id === selectedAnimalId) ?? animals[0] ?? null;
  const verifiedMateEligibility = selectedAnimal ? getVerifiedMateEligibility(selectedAnimal) : [];
  const canUseVerifiedMate = verifiedMateEligibility.every((item) => item.done);

  const visibleCandidates = useMemo(() => {
    return candidateAnimals.filter((candidate) => {
      const modeMatches = candidate.mode === matchMode;
      const speciesMatches = speciesFilter === 'ALL' || candidate.animal.species === speciesFilter;
      const verifiedMatches = !verifiedOnly || candidate.ownerVerificationStatus === 'VERIFIED';
      const gateMatches = matchMode !== 'VERIFIED_MATE' || (canUseVerifiedMate && candidate.healthDocumentStatus === 'VERIFIED');
      return modeMatches && speciesMatches && verifiedMatches && gateMatches;
    });
  }, [canUseVerifiedMate, matchMode, speciesFilter, verifiedOnly]);

  const activeCandidate = visibleCandidates[candidateIndex % Math.max(visibleCandidates.length, 1)] ?? null;

  function goToTab(tab: MainTab) {
    setActiveTab(tab);
    setView('tabs');
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

  function handleCandidateAction(action: 'like' | 'pass' | 'save') {
    if (!activeCandidate || !selectedAnimal) return;
    if (action === 'like' && activeCandidate.compatibilityScore >= 80) {
      const conversation = createMatchConversation(selectedAnimal.name, activeCandidate);
      setConversations((current) => [conversation, ...current]);
      setSelectedConversation(conversation);
      setSelectedCandidate(activeCandidate);
      setView('matchSuccess');
      return;
    }
    setCandidateIndex((current) => current + 1);
  }

  function submitFosterApplication() {
    if (!selectedFosterCase || !isApplicationReady(applicationDraft)) return;
    const application: FosterApplication = {
      id: `application-${Date.now()}`,
      fosterCaseId: selectedFosterCase.id,
      applicantId: 'user-demo',
      status: 'SUBMITTED',
      housingType: applicationDraft.housingType,
      experience: applicationDraft.experience,
      availability: applicationDraft.availability,
      otherPets: applicationDraft.household,
      childrenInHome: applicationDraft.household,
      canTransport: true,
      canHandleMedicalNeeds: true,
      motivation: applicationDraft.motivation,
      createdAt: now,
    };
    setApplications((current) => [application, ...current]);
    setFosterSection('applications');
    setApplicationStep(0);
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

  function sendMessage() {
    if (!selectedConversation || !messageDraft.trim()) return;
    const nextMessage: ChatMessage = {
      id: `message-${Date.now()}`,
      messageId: `message-${Date.now()}`,
      senderDisplayName: 'Eu',
      sender: 'Eu',
      body: messageDraft.trim(),
      createdAt: now,
      isMine: true,
    };
    setConversations((current) =>
      current.map((conversation) =>
        conversation.id === selectedConversation.id
          ? {
              ...conversation,
              lastMessage: nextMessage.body,
              messages: [...conversation.messages, nextMessage],
            }
          : conversation,
      ),
    );
    setSelectedConversation((current) =>
      current ? { ...current, lastMessage: nextMessage.body, messages: [...current.messages, nextMessage] } : current,
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
        <MatchDetailScreen
          candidate={selectedCandidate}
          onBack={() => setView('tabs')}
          onLike={() => handleCandidateAction('like')}
          selectedAnimalName={selectedAnimal.name}
        />
      );
    }
    if (view === 'matchSuccess' && selectedCandidate && selectedAnimal) {
      return (
        <MatchSuccessScreen
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
        />
      );
    }
    if (activeTab === 'matches') {
      return (
        <MatchesScreen
          activeCandidate={activeCandidate}
          animals={animals}
          canUseVerifiedMate={canUseVerifiedMate}
          eligibility={verifiedMateEligibility}
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
          }}
          onSetSpeciesFilter={setSpeciesFilter}
          onSetVerifiedOnly={setVerifiedOnly}
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
          onAddCase={() => setFosterCases((current) => [createDemoFosterCase(), ...current])}
          onOpenCase={(fosterCase) => {
            setSelectedFosterCase(fosterCase);
            setView('fosterDetail');
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
        canUseVerifiedMate={canUseVerifiedMate}
        eligibility={verifiedMateEligibility}
        onAddAnimal={() => setView('animalEditor')}
      />
    );
  })();

  function markConversation(id: string, flag: 'blocked' | 'reported') {
    setConversations((current) =>
      current.map((conversation) => (conversation.id === id ? { ...conversation, [flag]: true } : conversation)),
    );
    setSelectedConversation((current) => (current?.id === id ? { ...current, [flag]: true } : current));
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

function MatchesScreen({
  animals,
  selectedAnimal,
  activeCandidate,
  matchMode,
  speciesFilter,
  verifiedOnly,
  canUseVerifiedMate,
  eligibility,
  onAddAnimal,
  onSelectAnimal,
  onSetMatchMode,
  onSetSpeciesFilter,
  onSetVerifiedOnly,
  onOpenDetail,
  onAction,
}: {
  animals: AnimalProfile[];
  selectedAnimal: AnimalProfile | null;
  activeCandidate: MatchCandidate | null;
  matchMode: MatchMode;
  speciesFilter: Species | 'ALL';
  verifiedOnly: boolean;
  canUseVerifiedMate: boolean;
  eligibility: { label: string; done: boolean }[];
  onAddAnimal: () => void;
  onSelectAnimal: (id: string) => void;
  onSetMatchMode: (mode: MatchMode) => void;
  onSetSpeciesFilter: (species: Species | 'ALL') => void;
  onSetVerifiedOnly: (value: boolean) => void;
  onOpenDetail: (candidate: MatchCandidate) => void;
  onAction: (action: 'like' | 'pass' | 'save') => void;
}) {
  if (!selectedAnimal) {
    return (
      <EmptyState
        action="Create animal profile"
        body="For good matches, PetPal needs species, breed, age, sex, photos, temperament, and match goal."
        onAction={onAddAnimal}
        title="Create your animal profile"
      />
    );
  }

  return (
    <View style={styles.stack}>
      <SectionHeader
        eyebrow="PetPal"
        title="Matches for your animal"
        detail="Choose your animal, match goal, and browse compatible cards. Exact location stays private."
      />
      <Band tone="sage">
        <Text style={styles.label}>My animal</Text>
        <View style={styles.wrapRow}>
          {animals.map((animal) => (
            <Chip
              key={animal.id}
              label={animal.name}
              onPress={() => onSelectAnimal(animal.id)}
              selected={animal.id === selectedAnimal.id}
            />
          ))}
          <Chip label="+ Animal" onPress={onAddAnimal} />
        </View>
      </Band>
      <Band>
        <Text style={styles.label}>What are you looking for?</Text>
        <View style={styles.wrapRow}>
          <Chip label="Play" onPress={() => onSetMatchMode('PLAY')} selected={matchMode === 'PLAY'} />
          <Chip label="Social" onPress={() => onSetMatchMode('SOCIAL')} selected={matchMode === 'SOCIAL'} />
          <Chip
            label="Verified Mate"
            onPress={() => onSetMatchMode('VERIFIED_MATE')}
            selected={matchMode === 'VERIFIED_MATE'}
          />
        </View>
        <View style={styles.wrapRow}>
          <Chip label="Dogs" onPress={() => onSetSpeciesFilter('DOG')} selected={speciesFilter === 'DOG'} />
          <Chip label="Cats" onPress={() => onSetSpeciesFilter('CAT')} selected={speciesFilter === 'CAT'} />
          <Chip label="All" onPress={() => onSetSpeciesFilter('ALL')} selected={speciesFilter === 'ALL'} />
          <Chip label="Verified" onPress={() => onSetVerifiedOnly(!verifiedOnly)} selected={verifiedOnly} />
        </View>
      </Band>
      {matchMode === 'VERIFIED_MATE' && !canUseVerifiedMate ? (
        <VerifiedMateLocked eligibility={eligibility} />
      ) : activeCandidate ? (
        <AnimalMatchCard
          candidate={activeCandidate}
          onDetails={() => onOpenDetail(activeCandidate)}
          onLike={() => onAction('like')}
          onPass={() => onAction('pass')}
          onSave={() => onAction('save')}
          selectedAnimalName={selectedAnimal.name}
        />
      ) : (
        <EmptyState
          body="Change filters or choose another mode. Verified Mate results are hidden until checks are complete."
          title="No matches for the current filters"
        />
      )}
    </View>
  );
}

function AnimalMatchCard({
  candidate,
  selectedAnimalName,
  onPass,
  onDetails,
  onLike,
  onSave,
}: {
  candidate: MatchCandidate;
  selectedAnimalName: string;
  onPass: () => void;
  onDetails: () => void;
  onLike: () => void;
  onSave: () => void;
}) {
  return (
    <Band style={styles.heroCard}>
      <View style={styles.photoBlock}>
        <Text style={styles.photoInitial}>{candidate.animal.name.slice(0, 1)}</Text>
      </View>
      <View style={styles.rowBetween}>
        <View style={styles.flex}>
          <Text style={styles.cardName}>{candidate.animal.name}</Text>
          <Text style={styles.meta}>
            {candidate.animal.breed ?? 'Metis'} · {sexLabel(candidate.animal.sex)} · {ageLabel(candidate.animal.ageMonths)}
          </Text>
        </View>
        <StatusBadge label={`${candidate.compatibilityScore}%`} tone="sage" />
      </View>
      <Text style={styles.bodyText}>For: {modeLabel(candidate.mode)}</Text>
      <Text style={styles.bodyText}>{candidate.distanceLabel}</Text>
      <View style={styles.checks}>
        <Text style={styles.check}>✓ Owner verified</Text>
        <Text style={styles.check}>✓ Vaccines confirmed</Text>
        <Text style={styles.check}>✓ Profile complete</Text>
      </View>
      <Text style={styles.bodyText}>
        Compatibility with {selectedAnimalName}: {candidate.compatibilityScore}%
      </Text>
      <Text style={styles.muted}>{candidate.animal.temperamentTags.join(', ')}.</Text>
      <View style={styles.actions}>
        <Button label="Not now" onPress={onPass} tone="quiet" style={styles.actionButton} />
        <Button label="Details" onPress={onDetails} tone="secondary" style={styles.actionButton} />
        <Button label="Like" onPress={onLike} tone="primary" style={styles.actionButton} />
      </View>
      <Button label="Save" onPress={onSave} tone="quiet" />
    </Band>
  );
}

function MatchDetailScreen({
  candidate,
  selectedAnimalName,
  onBack,
  onLike,
}: {
  candidate: MatchCandidate;
  selectedAnimalName: string;
  onBack: () => void;
  onLike: () => void;
}) {
  return (
    <View style={styles.stack}>
      <Button label="Back" onPress={onBack} tone="quiet" />
      <SectionHeader
        eyebrow="Match details"
        title={candidate.animal.name}
        detail={`${candidate.animal.breed ?? 'Metis'} · ${sexLabel(candidate.animal.sex)} · ${ageLabel(candidate.animal.ageMonths)}`}
      />
      <Band>
        <InfoRow label="Goal" value={modeLabel(candidate.mode)} />
        <InfoRow label={`Compatibility with ${selectedAnimalName}`} value={`${candidate.compatibilityScore}%`} />
        <InfoRow label="Location" value={`${candidate.distanceLabel}. Exact location stays private.`} />
        <Text style={styles.label}>Why this match makes sense</Text>
        {candidate.compatibilityReasons.map((reason) => (
          <Text key={reason} style={styles.check}>
            ✓ {reason}
          </Text>
        ))}
      </Band>
      <Band tone="sky">
        <InfoRow label="Temperament" value={candidate.animal.temperamentTags.join(', ')} />
        <InfoRow label="Health" value="Vaccines confirmed. Medical documents uploaded." />
      </Band>
      <View style={styles.actions}>
        <Button label="Like" onPress={onLike} tone="primary" style={styles.actionButton} />
        <Button label="Not now" onPress={onBack} tone="quiet" style={styles.actionButton} />
        <Button label="Report" onPress={onBack} tone="danger" style={styles.actionButton} />
      </View>
    </View>
  );
}

function MatchSuccessScreen({
  candidate,
  selectedAnimalName,
  onOpenMessages,
}: {
  candidate: MatchCandidate;
  selectedAnimalName: string;
  onOpenMessages: () => void;
}) {
  return (
    <Band tone="sage" style={styles.success}>
      <Text style={styles.successTitle}>New match!</Text>
      <Text style={styles.bodyText}>
        {selectedAnimalName} si {candidate.animal.name} matched.
      </Text>
      <Button label="Open messages" onPress={onOpenMessages} tone="primary" />
    </Band>
  );
}

function VerifiedMateLocked({ eligibility }: { eligibility: { label: string; done: boolean }[] }) {
  return (
    <Band tone="clay">
      <SectionHeader
        eyebrow="Verified Mate"
        title="Available only after checks"
        detail="Verified Mate requires additional checks. PetPal does not allow free or public breeding."
      />
      {eligibility.map((item) => (
        <Text key={item.label} style={item.done ? styles.check : styles.missing}>
          {item.done ? '✓' : '•'} {item.label}
        </Text>
      ))}
    </Band>
  );
}

function FosterScreen({
  section,
  fosterCases,
  applications,
  isRescuer,
  onSection,
  onOpenCase,
  onAddCase,
  onAcceptApplication,
}: {
  section: FosterSection;
  fosterCases: FosterCase[];
  applications: FosterApplication[];
  isRescuer: boolean;
  onSection: (section: FosterSection) => void;
  onOpenCase: (fosterCase: FosterCase) => void;
  onAddCase: () => void;
  onAcceptApplication: (application: FosterApplication) => void;
}) {
  return (
    <View style={styles.stack}>
      <SectionHeader
        eyebrow="Foster"
        title="Animals needing temporary homes"
        detail="Find cases, apply, and track applications. Chat opens only after acceptance."
      />
      <View style={styles.wrapRow}>
        <Chip label="Find" onPress={() => onSection('find')} selected={section === 'find'} />
        <Chip label="Applications" onPress={() => onSection('applications')} selected={section === 'applications'} />
        <Chip label="Manage" onPress={() => onSection('manage')} selected={section === 'manage'} />
      </View>
      {section === 'find' ? <FosterFindSection fosterCases={fosterCases} onOpenCase={onOpenCase} /> : null}
      {section === 'applications' ? <FosterApplications applications={applications} fosterCases={fosterCases} /> : null}
      {section === 'manage' ? (
        <FosterManageSection
          applications={applications}
          fosterCases={fosterCases}
          isRescuer={isRescuer}
          onAcceptApplication={onAcceptApplication}
          onAddCase={onAddCase}
        />
      ) : null}
    </View>
  );
}

function FosterFindSection({
  fosterCases,
  onOpenCase,
}: {
  fosterCases: FosterCase[];
  onOpenCase: (fosterCase: FosterCase) => void;
}) {
  return (
    <View style={styles.stack}>
      <View style={styles.wrapRow}>
        {['Dogs', 'Cats', 'Urgent', 'Duration', 'Size', 'Food covered', 'Vet covered', 'Transport', 'Verified'].map(
          (label) => (
            <Chip key={label} label={label} />
          ),
        )}
      </View>
      {fosterCases.map((fosterCase) => (
        <Pressable key={fosterCase.id} onPress={() => onOpenCase(fosterCase)} style={({ pressed }) => pressed && styles.pressed}>
          <Band>
            <View style={styles.rowBetween}>
              <View style={styles.flex}>
                <Text style={styles.cardName}>{fosterCase.animalName}</Text>
                <Text style={styles.meta}>
                  {speciesLabel(fosterCase.species)} · {ageLabel(fosterCase.ageMonths)} · {urgencyLabel(fosterCase.urgency)}
                </Text>
              </View>
              <StatusBadge label={fosterCase.rescuerVerified ? 'Verificat' : 'Neverificat'} tone="sage" />
            </View>
            <Text style={styles.bodyText}>{fosterCase.description}</Text>
            <Text style={styles.muted}>
              {coverageText(fosterCase)} · {fosterCase.city} / {fosterCase.coarseArea}
            </Text>
            <View style={styles.actions}>
              <Button label="View case" onPress={() => onOpenCase(fosterCase)} tone="primary" style={styles.actionButton} />
              <Button label="Save" onPress={() => undefined} tone="quiet" style={styles.actionButton} />
            </View>
          </Band>
        </Pressable>
      ))}
    </View>
  );
}

function FosterCaseDetail({
  fosterCase,
  onBack,
  onApply,
}: {
  fosterCase: FosterCase;
  onBack: () => void;
  onApply: () => void;
}) {
  return (
    <View style={styles.stack}>
      <Button label="Back" onPress={onBack} tone="quiet" />
      <SectionHeader
        eyebrow="Foster case"
        title={fosterCase.animalName}
        detail={`${speciesLabel(fosterCase.species)} · ${ageLabel(fosterCase.ageMonths)} · ${sizeLabel(fosterCase.sizeLabel)}`}
      />
      <Band>
        <InfoRow label="Foster need" value={durationLabel(fosterCase.duration)} />
        <InfoRow label="Urgency" value={urgencyLabel(fosterCase.urgency)} />
        <InfoRow label="What is covered" value={coverageText(fosterCase)} />
        <InfoRow label="Home fit" value={fosterCase.homeFit} />
        <InfoRow label="Health" value={fosterCase.medicalNeeds ?? 'Fara nevoi medicale publice.'} />
        <InfoRow label="Location" value={`${fosterCase.city} / ${fosterCase.coarseArea}. Exact location stays private.`} />
        <InfoRow label="Rescuer" value={`${fosterCase.rescuerName} · Verified rescuer`} />
      </Band>
      <View style={styles.actions}>
        <Button label="Apply to foster" onPress={onApply} tone="primary" style={styles.actionButton} />
        <Button label="Save" onPress={() => undefined} tone="secondary" style={styles.actionButton} />
        <Button label="Report" onPress={() => undefined} tone="danger" style={styles.actionButton} />
      </View>
    </View>
  );
}

function FosterApplicationFlow({
  fosterCase,
  draft,
  step,
  onChange,
  onStepChange,
  onBack,
  onSubmit,
}: {
  fosterCase: FosterCase;
  draft: { housingType: string; experience: string; availability: string; household: string; motivation: string };
  step: number;
  onChange: (draft: { housingType: string; experience: string; availability: string; household: string; motivation: string }) => void;
  onStepChange: (step: number) => void;
  onBack: () => void;
  onSubmit: () => void;
}) {
  const steps = ['Home', 'Experience', 'Availability', 'Household', 'Review'];
  const fields = [
    ['housingType', 'Housing type', 'Apartment, house, yard...'],
    ['experience', 'Experience', 'Have you cared for animals before?'],
    ['availability', 'Availability', 'How long can you foster?'],
    ['household', 'Household', 'Other pets, children, schedule...'],
    ['motivation', 'Motivation', 'Why do you want to help?'],
  ] as const;
  const activeField = fields[step];
  const ready = isApplicationReady(draft);

  return (
    <View style={styles.stack}>
      <Button label="Back" onPress={onBack} tone="quiet" />
      <SectionHeader eyebrow="Foster application" title={fosterCase.animalName} detail={steps.join(' · ')} />
      <Band>
        <View style={styles.wrapRow}>
          {steps.map((label, index) => (
            <Chip key={label} label={label} onPress={() => onStepChange(index)} selected={index === step} />
          ))}
        </View>
        <TextField
          label={activeField[1]}
          multiline
          onChangeText={(value) => onChange({ ...draft, [activeField[0]]: value })}
          placeholder={activeField[2]}
          value={draft[activeField[0]]}
        />
      </Band>
      <View style={styles.actions}>
        <Button
          label="Back pas"
          onPress={() => onStepChange(Math.max(0, step - 1))}
          tone="quiet"
          style={styles.actionButton}
        />
        {step < steps.length - 1 ? (
          <Button
            label="Continue"
            onPress={() => onStepChange(Math.min(steps.length - 1, step + 1))}
            tone="primary"
            style={styles.actionButton}
          />
        ) : (
          <Button
            disabled={!ready}
            label="Send foster application"
            onPress={onSubmit}
            tone="primary"
            style={styles.actionButton}
          />
        )}
      </View>
      <Text style={styles.muted}>Rescuerul va analiza cererea inainte ca mesajele sa se deschida.</Text>
    </View>
  );
}

function FosterApplications({
  applications,
  fosterCases,
}: {
  applications: FosterApplication[];
  fosterCases: FosterCase[];
}) {
  if (!applications.length) {
    return <EmptyState body="Applicationsle trimise pentru foster vor aparea aici." title="No foster applications yet" />;
  }
  return (
    <View style={styles.stack}>
      {applications.map((application) => {
        const fosterCase = fosterCases.find((item) => item.id === application.fosterCaseId);
        return (
          <Band key={application.id}>
            <Text style={styles.cardName}>{fosterCase?.animalName ?? 'Foster case'}</Text>
            <Text style={styles.meta}>Foster · {fosterCase?.rescuerName ?? 'Rescuer'}</Text>
            <StatusBadge label={applicationStatusLabel(application.status)} tone={application.status === 'ACCEPTED' ? 'sage' : 'sky'} />
            <Text style={styles.muted}>
              {application.status === 'ACCEPTED'
                ? 'Messages are available.'
                : 'Next: wait for the rescuer response.'}
            </Text>
          </Band>
        );
      })}
    </View>
  );
}

function FosterManageSection({
  isRescuer,
  fosterCases,
  applications,
  onAddCase,
  onAcceptApplication,
}: {
  isRescuer: boolean;
  fosterCases: FosterCase[];
  applications: FosterApplication[];
  onAddCase: () => void;
  onAcceptApplication: (application: FosterApplication) => void;
}) {
  if (!isRescuer) {
    return (
      <EmptyState
        body="Manage is available only for verified rescuers or shelters."
        title="Locked section"
      />
    );
  }

  return (
    <View style={styles.stack}>
      <Band tone="forest">
        <Text style={styles.darkTitle}>Manage foster</Text>
        <View style={styles.metrics}>
          <Metric value={String(fosterCases.length)} label="Active cases" />
          <Metric value={String(applications.length)} label="Applications noi" />
          <Metric value={String(fosterCases.filter((item) => item.urgency === 'HIGH').length)} label="Urgente" />
        </View>
        <Button label="Add foster case" onPress={onAddCase} tone="secondary" />
      </Band>
      {applications.map((application) => (
        <Band key={application.id}>
          <Text style={styles.cardName}>New application</Text>
          <Text style={styles.bodyText}>{application.motivation}</Text>
          <View style={styles.actions}>
            <Button label="Accept" onPress={() => onAcceptApplication(application)} tone="primary" style={styles.actionButton} />
            <Button label="Reject" onPress={() => undefined} tone="danger" style={styles.actionButton} />
          </View>
        </Band>
      ))}
    </View>
  );
}

function MessagesScreen({
  conversations,
  filter,
  onFilter,
  onOpen,
}: {
  conversations: Conversation[];
  filter: MessageFilter;
  onFilter: (filter: MessageFilter) => void;
  onOpen: (conversation: Conversation) => void;
}) {
  const visible = conversations.filter((conversation) => {
    if (filter === 'matches') return conversation.source === 'MATCH';
    if (filter === 'foster') return conversation.source === 'FOSTER';
    return true;
  });
  return (
    <View style={styles.stack}>
      <SectionHeader
        eyebrow="Messagee"
        title="Conversations with context"
        detail="Messages appear only after a mutual match or an accepted foster application."
      />
      <View style={styles.wrapRow}>
        <Chip label="All" onPress={() => onFilter('all')} selected={filter === 'all'} />
        <Chip label="Matches" onPress={() => onFilter('matches')} selected={filter === 'matches'} />
        <Chip label="Foster" onPress={() => onFilter('foster')} selected={filter === 'foster'} />
      </View>
      {visible.length ? (
        visible.map((conversation) => (
          <Pressable key={conversation.id} onPress={() => onOpen(conversation)}>
            <Band>
              <Text style={styles.cardName}>{conversation.title}</Text>
              <Text style={styles.meta}>{conversation.contextLabel}</Text>
              <Text style={styles.muted}>Last message: {conversation.lastMessage}</Text>
            </Band>
          </Pressable>
        ))
      ) : (
        <EmptyState
          body="There is no direct chat from public cards. Conversations are created only when rules are met."
          title="No conversations yet"
        />
      )}
    </View>
  );
}

function ConversationThread({
  conversation,
  draft,
  onBack,
  onDraft,
  onSend,
  onReport,
  onBlock,
}: {
  conversation: Conversation;
  draft: string;
  onBack: () => void;
  onDraft: (value: string) => void;
  onSend: () => void;
  onReport: () => void;
  onBlock: () => void;
}) {
  return (
    <View style={styles.stack}>
      <Button label="Back" onPress={onBack} tone="quiet" />
      <Band tone="sage">
        <Text style={styles.cardName}>{conversation.title}</Text>
        <Text style={styles.meta}>{conversation.contextLabel}</Text>
        <Text style={styles.muted}>{conversation.privacyLabel}</Text>
      </Band>
      {conversation.messages.map((message) => (
        <View key={message.id} style={[styles.bubble, message.isMine && styles.myBubble]}>
          <Text style={styles.label}>{message.sender}</Text>
          <Text style={styles.bodyText}>{message.body}</Text>
        </View>
      ))}
      <TextField label="Message" onChangeText={onDraft} placeholder="Type message..." value={draft} />
      <Button label="Send" onPress={onSend} tone="primary" />
      <Band tone="clay">
        <Text style={styles.label}>Safety</Text>
        <View style={styles.actions}>
          <Button label="View context" onPress={() => undefined} tone="quiet" style={styles.actionButton} />
          <Button label={conversation.reported ? 'Reported' : 'Report'} onPress={onReport} tone="danger" style={styles.actionButton} />
          <Button label={conversation.blocked ? 'Blocked' : 'Block'} onPress={onBlock} tone="danger" style={styles.actionButton} />
        </View>
      </Band>
    </View>
  );
}

function ProfileScreen({
  animals,
  canUseVerifiedMate,
  eligibility,
  onAddAnimal,
}: {
  animals: AnimalProfile[];
  canUseVerifiedMate: boolean;
  eligibility: { label: string; done: boolean }[];
  onAddAnimal: () => void;
}) {
  return (
    <View style={styles.stack}>
      <SectionHeader
        eyebrow="Profile"
        title="Account, animals, verification, and preferences"
        detail="Settings live inside Profile. There is no separate Settings tab."
      />
      <Band>
        <Text style={styles.label}>My animals</Text>
        {animals.map((animal) => (
          <View key={animal.id} style={styles.inlineCard}>
            <Text style={styles.cardName}>{animal.name}</Text>
            <Text style={styles.meta}>
              {animal.breed ?? 'Metis'} · {sexLabel(animal.sex)} · {ageLabel(animal.ageMonths)}
            </Text>
            <Text style={styles.muted}>Profile complete: {animal.profileCompleteness}%</Text>
            <Text style={styles.muted}>Active goals: {animal.activeMatchModes.map(modeLabel).join(', ')}</Text>
          </View>
        ))}
        <Button label="Add animal" onPress={onAddAnimal} tone="primary" />
      </Band>
      <Band tone={canUseVerifiedMate ? 'sage' : 'clay'}>
        <Text style={styles.label}>Verification</Text>
        {eligibility.map((item) => (
          <Text key={item.label} style={item.done ? styles.check : styles.missing}>
            {item.done ? '✓' : '•'} {item.label}
          </Text>
        ))}
      </Band>
      <Band>
        {[
          'My account',
          'Match preferences',
          'Foster preferences',
          'Notifications',
          'Privacy',
          'Blocked users',
          'Language',
          'Help',
          'Terms and safety',
          'Delete account',
        ].map((item) => (
          <InfoRow key={item} label={item} value="Available in Profile" />
        ))}
      </Band>
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
    { label: 'Animal profile complet', done: animal.profileCompleteness >= 85 },
    { label: 'Age eligible', done: ageEligible },
    { label: 'Sex known', done: animal.sex !== 'UNKNOWN' },
    { label: 'Sterilization status known', done: animal.sterilizedStatus !== 'UNKNOWN' },
    { label: 'Vaccines set', done: animal.vaccineStatus !== 'UNKNOWN' },
    { label: 'Health documents uploaded', done: animal.healthDocumentStatus === 'VERIFIED' },
    { label: 'Admin approval if required', done: animal.adminMateApprovalStatus === 'VERIFIED' },
  ];
}

function isApplicationReady(draft: {
  housingType: string;
  experience: string;
  availability: string;
  household: string;
  motivation: string;
}) {
  return Object.values(draft).every((value) => value.trim().length >= 4);
}

function createMatchConversation(selectedAnimalName: string, candidate: MatchCandidate): Conversation {
  return {
    id: `conversation-match-${Date.now()}`,
    source: 'MATCH',
    title: `${selectedAnimalName} + ${candidate.animal.name}`,
    contextLabel: `Match · ${modeLabel(candidate.mode)}`,
    privacyLabel: `${candidate.distanceLabel}. Exact location is private.`,
    lastMessage: 'Can we discuss documents?',
    messages: [
      {
        id: 'm1',
        messageId: 'm1',
        senderDisplayName: candidate.animal.name,
        sender: candidate.animal.name,
        body: 'Hi! Can we discuss documents and a first safe meeting?',
        createdAt: now,
        isMine: false,
      },
    ],
  };
}

function createFosterConversation(fosterCase: FosterCase): Conversation {
  return {
    id: `conversation-foster-${Date.now()}`,
    source: 'FOSTER',
    title: fosterCase.animalName,
    contextLabel: 'Foster · Application accepted',
    privacyLabel: `${fosterCase.rescuerName}. Exact location is private.`,
    lastMessage: 'We can coordinate transport Friday.',
    messages: [
      {
        id: 'f1',
        messageId: 'f1',
        senderDisplayName: fosterCase.rescuerName,
        sender: fosterCase.rescuerName,
        body: 'The application was accepted. Can we coordinate transport Friday?',
        createdAt: now,
        isMine: false,
      },
    ],
  };
}

function createDemoFosterCase(): FosterCase {
  return {
    ...initialFosterCases[0],
    id: `foster-${Date.now()}`,
    animalId: `animal-foster-${Date.now()}`,
    title: 'New foster case',
    animalName: 'Rex',
    urgency: 'HIGH',
    createdAt: now,
  };
}

function modeLabel(mode: MatchMode) {
  return mode === 'PLAY' ? 'Play' : mode === 'SOCIAL' ? 'Social' : 'Verified Mate';
}

function sexLabel(sex: AnimalProfile['sex']) {
  return sex === 'MALE' ? 'Male' : sex === 'FEMALE' ? 'Female' : 'Sex unknown';
}

function speciesLabel(species: Species) {
  return species === 'DOG' ? 'Dog' : 'Cat';
}

function sizeLabel(size: FosterCase['sizeLabel']) {
  return size === 'SMALL' ? 'Small size' : size === 'MEDIUM' ? 'Medium size' : size === 'LARGE' ? 'Large size' : 'Unknown size';
}

function ageLabel(months: number | null) {
  if (!months) return 'unknown age';
  if (months < 12) return `${months} months`;
  const years = Math.floor(months / 12);
  return years === 1 ? '1 year' : `${years} years`;
}

function durationLabel(duration: FosterCase['duration']) {
  const labels = {
    FEW_DAYS: 'Few days',
    ONE_TWO_WEEKS: '1-2 weeks',
    ONE_MONTH: '1 month',
    UNTIL_ADOPTION: 'Until adoption',
    UNKNOWN: 'Unknown yet',
  };
  return labels[duration];
}

function urgencyLabel(urgency: FosterCase['urgency']) {
  return urgency === 'HIGH' ? 'Foster urgent' : urgency === 'MEDIUM' ? 'This week' : 'Low urgency';
}

function coverageText(fosterCase: FosterCase) {
  const values = [];
  if (fosterCase.foodCovered) values.push('food');
  if (fosterCase.vetCovered) values.push('vet care');
  if (fosterCase.transportAvailable) values.push('transport');
  return values.length ? values.join(', ') : 'coverage unconfirmed';
}

function applicationStatusLabel(status: FosterApplicationStatus) {
  const labels: Record<FosterApplicationStatus, string> = {
    DRAFT: 'Draft',
    SUBMITTED: 'Submitted',
    IN_REVIEW: 'In review',
    ACCEPTED: 'Accepted',
    REJECTED: 'Rejected',
    WITHDRAWN: 'Withdrawn',
    COMPLETED: 'Completed',
  };
  return labels[status];
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



