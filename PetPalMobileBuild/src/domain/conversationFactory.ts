import { modeLabel } from './labels';
import { ChatMessage, Conversation, FosterApplication, FosterCase, MatchCandidate } from '../types/petpal';

export function buildMatchConversation(
  selectedAnimalName: string,
  candidate: MatchCandidate,
): Conversation {
  const createdAt = new Date().toISOString();

  return {
    id: `conversation-match-${candidate.animal.id}-${Date.now()}`,
    source: 'MATCH',
    candidateId: candidate.animal.id,
    title: `${selectedAnimalName} + ${candidate.animal.name}`,
    subtitle: `Match - ${modeLabel(candidate.mode)}`,
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
        id: `message-match-${candidate.animal.id}-1`,
        messageId: `message-match-${candidate.animal.id}-1`,
        senderDisplayName: candidate.animal.name,
        sender: candidate.animal.name,
        body: 'Hi! Can we discuss documents and a first safe meeting?',
        createdAt,
        isMine: false,
      },
    ],
  };
}

export function buildFosterConversation(
  fosterCase: FosterCase,
  application?: FosterApplication,
): Conversation {
  const createdAt = new Date().toISOString();

  return {
    id: `conversation-foster-${fosterCase.id}-${Date.now()}`,
    source: 'FOSTER',
    fosterCaseId: fosterCase.id,
    fosterApplicationId: application?.id,
    title: fosterCase.animalName,
    subtitle: 'Foster - Application accepted',
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
        id: `message-foster-${fosterCase.id}-1`,
        messageId: `message-foster-${fosterCase.id}-1`,
        senderDisplayName: fosterCase.rescuerName,
        sender: fosterCase.rescuerName,
        body: 'The application was accepted. Can we coordinate transport Friday?',
        createdAt,
        isMine: false,
      },
    ],
  };
}

export function createLocalMessage(body: string): ChatMessage {
  const sentAt = new Date().toISOString();
  const id = `message-${Date.now()}`;

  return {
    id,
    messageId: id,
    senderDisplayName: 'Me',
    sender: 'Me',
    body,
    createdAt: sentAt,
    isMine: true,
  };
}
