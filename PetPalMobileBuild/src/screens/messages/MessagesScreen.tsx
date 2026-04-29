import { StyleSheet, Text, View } from 'react-native';

import { Band, Button, SectionHeader } from '../../components/ui';
import { colors, spacing, typography } from '../../design/tokens';
import { Conversation } from '../../types/petpal';
import { ConversationCard } from './ConversationCard';
import { MessageFilter, MessageFilters } from './MessageFilters';

export function MessagesScreen({
  conversations,
  filter,
  onFilter,
  onGoFoster,
  onGoMatches,
  onOpen,
}: {
  conversations: Conversation[];
  filter: MessageFilter;
  onFilter: (filter: MessageFilter) => void;
  onGoFoster: () => void;
  onGoMatches: () => void;
  onOpen: (conversation: Conversation) => void;
}) {
  const matchConversations = conversations.filter((conversation) => conversation.source === 'MATCH');
  const fosterConversations = conversations.filter((conversation) => conversation.source === 'FOSTER');
  const empty =
    (filter === 'all' && conversations.length === 0) ||
    (filter === 'matches' && matchConversations.length === 0) ||
    (filter === 'foster' && fosterConversations.length === 0);

  return (
    <View style={styles.stack}>
      <SectionHeader
        title="Messages"
        detail="Chats open only after a mutual match or accepted foster request."
      />
      <MessageFilters filter={filter} onFilter={onFilter} />
      {empty ? (
        <EmptyMessages onGoFoster={onGoFoster} onGoMatches={onGoMatches} />
      ) : (
        <>
          {filter !== 'foster' ? (
            <ConversationGroup conversations={matchConversations} onOpen={onOpen} title="Matches" />
          ) : null}
          {filter !== 'matches' ? (
            <ConversationGroup conversations={fosterConversations} onOpen={onOpen} title="Foster" />
          ) : null}
        </>
      )}
    </View>
  );
}

function ConversationGroup({
  conversations,
  onOpen,
  title,
}: {
  conversations: Conversation[];
  onOpen: (conversation: Conversation) => void;
  title: string;
}) {
  if (!conversations.length) return null;

  return (
    <View style={styles.stack}>
      <Text style={styles.groupTitle}>{title}</Text>
      {conversations.map((conversation) => (
        <ConversationCard
          conversation={conversation}
          key={conversation.id}
          onOpen={() => onOpen(conversation)}
        />
      ))}
    </View>
  );
}

function EmptyMessages({
  onGoFoster,
  onGoMatches,
}: {
  onGoFoster: () => void;
  onGoMatches: () => void;
}) {
  return (
    <Band>
      <Text style={styles.emptyTitle}>No conversations yet</Text>
      <Text style={styles.emptyBody}>
        Messages open after a mutual animal match or an accepted foster application.
      </Text>
      <View style={styles.actions}>
        <Button label="Go to Matches" onPress={onGoMatches} tone="secondary" style={styles.actionButton} />
        <Button label="Go to Foster" onPress={onGoFoster} tone="quiet" style={styles.actionButton} />
      </View>
    </Band>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  actionButton: {
    flex: 1,
    minWidth: 116,
  },
  emptyBody: {
    color: colors.inkMuted,
    fontSize: typography.body,
    fontWeight: '600',
    lineHeight: 23,
  },
  emptyTitle: {
    color: colors.ink,
    fontSize: typography.bodyLarge,
    fontWeight: '900',
    lineHeight: 24,
  },
  groupTitle: {
    color: colors.ink,
    fontSize: typography.title,
    fontWeight: '900',
    lineHeight: 27,
  },
  stack: {
    gap: spacing.md,
  },
});
