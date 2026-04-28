import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Band, Button, EmptyState, SectionHeader, StatusBadge, TextField } from '../components/ui';
import { colors, radii, spacing, typography } from '../design/tokens';
import { ChatMessage, ConversationSummary } from '../types/petpal';

export function InboxScreen({
  activeConversation,
  chatDraft,
  chatMessage,
  conversations,
  messages,
  onBlock,
  onOpenConversation,
  onReport,
  onSend,
  onSetChatDraft,
  selectedConversationId,
}: {
  activeConversation: ConversationSummary | undefined;
  chatDraft: string;
  chatMessage: string;
  conversations: ConversationSummary[];
  messages: ChatMessage[];
  onBlock: () => void;
  onOpenConversation: (conversationId: string) => void;
  onReport: () => void;
  onSend: () => void;
  onSetChatDraft: (value: string) => void;
  selectedConversationId: string | null;
}) {
  return (
    <View style={styles.screen}>
      <Band tone="sage">
        <SectionHeader
          eyebrow="Gated messages"
          title="Protected inbox"
          detail="Accepted applications become coordination threads. Everything else stays out of chat."
        />
        <Text style={styles.systemMessage}>{chatMessage}</Text>
      </Band>

      <View style={styles.listStack}>
        {conversations.length > 0 ? (
          conversations.map((conversation) => (
            <ConversationCard
              conversation={conversation}
              key={conversation.conversationId}
              onPress={() => onOpenConversation(conversation.conversationId)}
              selected={conversation.conversationId === selectedConversationId}
            />
          ))
        ) : (
          <EmptyState
            body="When a rescue accepts an application, the approved conversation appears here."
            title="No open conversations"
          />
        )}
      </View>

      <Band tone="surface">
        <SectionHeader
          eyebrow="Coordination"
          title={activeConversation ? activeConversation.animalName : 'No thread selected'}
          detail={activeConversation ? activeConversation.title : 'Choose an approved thread before sending handoff details.'}
        />
        {messages.length > 0 ? (
          <View style={styles.messageStack}>
            {messages.map((message) => (
              <MessageBubble key={message.messageId} message={message} />
            ))}
          </View>
        ) : (
          <EmptyState
            body="Open an accepted conversation. Messages and safety actions will stay attached to that handoff."
            title="No messages loaded"
          />
        )}
        <TextField
          helper="Keep personal addresses out until both sides are ready."
          label="Message"
          multiline
          onChangeText={onSetChatDraft}
          placeholder="Coordinate next steps safely."
          value={chatDraft}
        />
        <View style={styles.actionRow}>
          <Button label="Send" onPress={onSend} style={styles.actionMain} />
          <Button label="Report" onPress={onReport} tone="secondary" style={styles.actionSide} />
          <Button label="Block" onPress={onBlock} tone="danger" style={styles.actionSide} />
        </View>
      </Band>
    </View>
  );
}

function ConversationCard({
  conversation,
  selected,
  onPress,
}: {
  conversation: ConversationSummary;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.threadCard, selected && styles.threadSelected, pressed && styles.pressed]}
    >
      <View style={styles.cardTopline}>
        <StatusBadge label="Open" tone="sage" />
        <Text style={styles.organization}>{conversation.organizationName}</Text>
      </View>
      <Text style={styles.threadTitle}>{conversation.animalName}</Text>
      <Text style={styles.threadMeta}>{conversation.title}</Text>
      {conversation.lastMessageBody ? <Text style={styles.threadBody}>{conversation.lastMessageBody}</Text> : null}
    </Pressable>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  return (
    <View style={[styles.message, message.isMine ? styles.messageMine : styles.messageTheirs]}>
      <Text style={styles.messageSender}>{message.senderDisplayName}</Text>
      <Text style={styles.messageText}>{message.body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    gap: spacing.md,
  },
  systemMessage: {
    color: colors.inkMuted,
    fontSize: typography.body,
    fontWeight: '700',
    lineHeight: 22,
  },
  listStack: {
    gap: spacing.md,
  },
  threadCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.md,
  },
  threadSelected: {
    backgroundColor: colors.sageMist,
    borderColor: colors.sageDeep,
    borderWidth: 2,
  },
  cardTopline: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  organization: {
    color: colors.inkMuted,
    flex: 1,
    fontSize: typography.caption,
    fontWeight: '900',
    textAlign: 'right',
  },
  threadTitle: {
    color: colors.ink,
    fontSize: typography.title,
    fontWeight: '900',
    lineHeight: 27,
  },
  threadMeta: {
    color: colors.inkMuted,
    fontSize: typography.body,
    lineHeight: 22,
  },
  threadBody: {
    color: colors.ink,
    fontSize: typography.small,
    fontWeight: '700',
    lineHeight: 19,
  },
  messageStack: {
    gap: spacing.sm,
  },
  message: {
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing.xxs,
    maxWidth: '86%',
    padding: spacing.sm,
  },
  messageMine: {
    alignSelf: 'flex-end',
    backgroundColor: colors.sageMist,
    borderColor: colors.sageDeep,
  },
  messageTheirs: {
    alignSelf: 'flex-start',
    backgroundColor: colors.cream,
    borderColor: colors.border,
  },
  messageSender: {
    color: colors.inkSoft,
    fontSize: typography.micro,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  messageText: {
    color: colors.ink,
    fontSize: typography.body,
    lineHeight: 22,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  actionMain: {
    flex: 1,
    minWidth: 132,
  },
  actionSide: {
    flex: 0.5,
    minWidth: 102,
  },
  pressed: {
    opacity: 0.72,
  },
});
