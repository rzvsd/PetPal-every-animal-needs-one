import { useCallback, useState } from 'react';
import { blockProfile, fetchConversationMessages, fetchMyConversations, reportMessage, sendConversationMessage, signInDemoAdopter } from '../api/petpalApi';
import { ChatMessage, ConversationSummary } from '../types/petpal';
import { getErrorMessage } from '../utils/petpalFormat';
import { isSupabaseConfigured } from '../lib/supabase';

export function useConversations(dataSource: 'demo' | 'supabase') {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [chatMessage, setChatMessage] = useState('Chat opens only after a shelter accepts an application.');

  const refreshConversations = useCallback(async () => {
    if (!isSupabaseConfigured || dataSource !== 'supabase') return;

    try {
      await signInDemoAdopter();
      const nextConversations = await fetchMyConversations();
      setConversations(nextConversations);
      
      if (nextConversations.length > 0 && selectedConversationId) {
         if (nextConversations.some(c => c.conversationId === selectedConversationId)) {
            const nextMessages = await fetchConversationMessages(selectedConversationId);
            setMessages(nextMessages);
         }
      }
    } catch (error) {
      setChatMessage(`Local chat sync unavailable: ${getErrorMessage(error)}`);
    }
  }, [dataSource, selectedConversationId]);

  const openConversation = useCallback(async (conversationId: string) => {
    setSelectedConversationId(conversationId);
    try {
      await signInDemoAdopter();
      setMessages(await fetchConversationMessages(conversationId));
    } catch (error) {
      setChatMessage(`Message refresh failed: ${getErrorMessage(error)}`);
    }
  }, []);

  const openConversationForApplication = useCallback(async (applicationId: string) => {
    try {
      await signInDemoAdopter();
      const nextConversations = await fetchMyConversations();
      setConversations(nextConversations);

      const conversation = nextConversations.find((item) => item.applicationId === applicationId) ?? nextConversations[0];

      if (!conversation) {
        setSelectedConversationId(null);
        setMessages([]);
        setChatMessage('No accepted conversation exists for this application yet.');
        return false;
      }

      setSelectedConversationId(conversation.conversationId);
      setMessages(await fetchConversationMessages(conversation.conversationId));
      setChatMessage('Accepted application opened a protected handoff thread.');
      return true;
    } catch (error) {
      setChatMessage(`Open chat failed: ${getErrorMessage(error)}`);
      return false;
    }
  }, []);

  const sendMessage = useCallback(async (body: string) => {
    if (!selectedConversationId) {
      setChatMessage('Open a conversation before sending a message.');
      return;
    }

    try {
      await signInDemoAdopter();
      const messageId = await sendConversationMessage(selectedConversationId, body);
      const nextMessages = await fetchConversationMessages(selectedConversationId);
      const nextConversations = await fetchMyConversations();
      setMessages(nextMessages);
      setConversations(nextConversations);
      setChatMessage(`Message ${messageId.slice(0, 8)} sent through gated chat.`);
    } catch (error) {
      setChatMessage(`Send failed: ${getErrorMessage(error)}`);
    }
  }, [selectedConversationId]);

  const report = useCallback(async () => {
    const reportableMessage = [...messages].reverse().find((message) => !message.isMine) ?? messages[messages.length - 1];
    if (!reportableMessage) {
      setChatMessage('Send or load a message before reporting.');
      return;
    }

    try {
      await signInDemoAdopter();
      const reportId = await reportMessage(
        reportableMessage.messageId,
        'SAFETY_CONCERN',
        'Reported from the mobile UX smoke flow.',
      );
      setChatMessage(`Report ${reportId.slice(0, 8)} created for moderation review.`);
    } catch (error) {
      setChatMessage(`Report failed: ${getErrorMessage(error)}`);
    }
  }, [messages]);

  const block = useCallback(async () => {
    if (!selectedConversationId) {
      setChatMessage('Open a conversation before blocking a participant.');
      return;
    }

    try {
      await signInDemoAdopter();
      await blockProfile('10000000-0000-4000-8000-000000000001');
      setSelectedConversationId(null);
      setMessages([]);
      setConversations([]);
      setChatMessage('Rescue demo profile blocked. Messaging and message visibility are now closed.');
    } catch (error) {
      setChatMessage(`Block failed: ${getErrorMessage(error)}`);
    }
  }, [selectedConversationId]);

  return {
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
  };
}
