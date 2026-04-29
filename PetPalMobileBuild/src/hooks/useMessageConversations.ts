import { useState } from 'react';

import { buildFosterConversation, buildMatchConversation, createLocalMessage } from '../domain/conversationFactory';
import { MessageFilter } from '../screens/messages/MessageFilters';
import { Conversation, FosterApplication, FosterCase, MatchCandidate } from '../types/petpal';

export function useMessageConversations() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messageFilter, setMessageFilter] = useState<MessageFilter>('all');
  const [messageDraft, setMessageDraft] = useState('');

  function getConversation(conversationId: string) {
    return conversations.find((conversation) => conversation.id === conversationId) ?? null;
  }

  function createMatchConversation(selectedAnimalName: string, candidate: MatchCandidate) {
    const existing = conversations.find(
      (conversation) => conversation.source === 'MATCH' && conversation.candidateId === candidate.animal.id,
    );
    if (existing) return existing;

    const conversation = buildMatchConversation(selectedAnimalName, candidate);
    setConversations((current) => [conversation, ...current]);
    return conversation;
  }

  function createFosterConversation(fosterCase: FosterCase, application?: FosterApplication) {
    const existing = conversations.find(
      (conversation) => conversation.source === 'FOSTER' && conversation.fosterCaseId === fosterCase.id,
    );
    if (existing) return existing;

    const conversation = buildFosterConversation(fosterCase, application);
    setConversations((current) => [conversation, ...current]);
    return conversation;
  }

  function sendMessage(conversationId: string) {
    if (!messageDraft.trim()) return;

    const nextMessage = createLocalMessage(messageDraft.trim());
    setConversations((current) =>
      current.map((conversation) =>
        conversation.id === conversationId
          ? {
              ...conversation,
              lastMessage: nextMessage.body,
              lastMessageAt: nextMessage.createdAt,
              messages: [...conversation.messages, nextMessage],
            }
          : conversation,
      ),
    );
    setMessageDraft('');
  }

  function markConversation(conversationId: string, flag: 'blocked' | 'reported') {
    setConversations((current) =>
      current.map((conversation) =>
        conversation.id === conversationId ? { ...conversation, [flag]: true } : conversation,
      ),
    );
  }

  return {
    conversations,
    createFosterConversation,
    createMatchConversation,
    getConversation,
    markConversation,
    messageDraft,
    messageFilter,
    sendMessage,
    setMessageDraft,
    setMessageFilter,
  };
}
