import { StyleSheet, Text, View } from 'react-native';

import { Band, Button, TextField } from '../../components/ui';
import { colors, spacing, typography } from '../../design/tokens';
import { Conversation } from '../../types/petpal';
import { formatLocation } from './ConversationCard';
import { SafetyMenu } from './SafetyMenu';

export function ConversationThread({
  conversation,
  draft,
  onBack,
  onBlock,
  onDraft,
  onReport,
  onSend,
  onViewApplication,
  onViewContext,
}: {
  conversation: Conversation;
  draft: string;
  onBack: () => void;
  onBlock: () => void;
  onDraft: (value: string) => void;
  onReport: () => void;
  onSend: () => void;
  onViewApplication: () => void;
  onViewContext: () => void;
}) {
  return (
    <View style={styles.stack}>
      <Button label="Back" onPress={onBack} tone="quiet" />
      <ContextHeader
        conversation={conversation}
        onViewApplication={onViewApplication}
        onViewContext={onViewContext}
      />
      {conversation.messages.map((message) => (
        <View key={message.messageId} style={[styles.bubble, message.isMine && styles.myBubble]}>
          <Text style={styles.label}>{message.senderDisplayName}</Text>
          <Text style={styles.bodyText}>{message.body}</Text>
        </View>
      ))}
      <TextField label="Message" onChangeText={onDraft} placeholder="Type message..." value={draft} />
      <Button label="Send" onPress={onSend} tone="primary" />
      <SafetyMenu
        conversation={conversation}
        onBlock={onBlock}
        onReport={onReport}
        onViewContext={onViewContext}
      />
    </View>
  );
}

function ContextHeader({
  conversation,
  onViewApplication,
  onViewContext,
}: {
  conversation: Conversation;
  onViewApplication: () => void;
  onViewContext: () => void;
}) {
  const isMatch = conversation.source === 'MATCH';

  return (
    <Band tone={isMatch ? 'sage' : 'sky'}>
      <Text style={styles.title}>{conversation.title}</Text>
      <Text style={styles.meta}>{conversation.subtitle}</Text>
      {isMatch ? null : (
        <Text style={styles.meta}>
          {conversation.organizationName ?? 'Rescuer'} / {conversation.organizationVerified ? 'Verified rescuer' : 'Unverified rescuer'}
        </Text>
      )}
      <Text style={styles.muted}>{formatLocation(conversation)}</Text>
      <Text style={styles.muted}>{conversation.privacyLabel}</Text>
      <View style={styles.contextBlock}>
        <Text style={styles.label}>Context</Text>
        <Text style={styles.bodyText}>
          {isMatch
            ? 'This chat opened after a mutual match. Discuss documents, expectations, and next steps safely.'
            : 'This chat opened after the foster request was accepted. Use it to coordinate handover, supplies, vet care, and timing.'}
        </Text>
      </View>
      <View style={styles.actions}>
        <Button
          label={isMatch ? 'View match details' : 'View foster case'}
          onPress={onViewContext}
          tone="secondary"
          style={styles.actionButton}
        />
        {isMatch ? null : (
          <Button
            label="View application"
            onPress={onViewApplication}
            tone="quiet"
            style={styles.actionButton}
          />
        )}
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
    minWidth: 126,
  },
  bodyText: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: '700',
    lineHeight: 23,
  },
  bubble: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    gap: spacing.xxs,
    maxWidth: '86%',
    padding: spacing.md,
  },
  contextBlock: {
    gap: spacing.xxs,
  },
  label: {
    color: colors.inkSoft,
    fontSize: typography.caption,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  meta: {
    color: colors.inkMuted,
    fontSize: typography.body,
    fontWeight: '800',
    lineHeight: 22,
  },
  muted: {
    color: colors.inkMuted,
    fontSize: typography.body,
    fontWeight: '600',
    lineHeight: 23,
  },
  myBubble: {
    alignSelf: 'flex-end',
    backgroundColor: colors.sageMist,
    borderColor: 'rgba(40, 91, 76, 0.22)',
  },
  stack: {
    gap: spacing.md,
  },
  title: {
    color: colors.ink,
    fontSize: typography.title,
    fontWeight: '900',
    lineHeight: 27,
  },
});
