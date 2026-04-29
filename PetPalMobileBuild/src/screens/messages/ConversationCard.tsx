import { StyleSheet, Text, View } from 'react-native';

import { Band, Button, StatusBadge } from '../../components/ui';
import { colors, spacing, typography } from '../../design/tokens';
import { Conversation } from '../../types/petpal';

export function ConversationCard({
  conversation,
  onOpen,
}: {
  conversation: Conversation;
  onOpen: () => void;
}) {
  return (
    <Band>
      <View style={styles.rowBetween}>
        <View style={styles.flex}>
          <Text style={styles.cardName}>{conversation.title}</Text>
          <Text style={styles.meta}>{conversation.subtitle}</Text>
        </View>
        <StatusBadge label={conversation.source === 'MATCH' ? 'Match' : 'Foster'} tone={conversation.source === 'MATCH' ? 'sage' : 'clay'} />
      </View>
      <View style={styles.badges}>
        <StatusBadge label={conversation.source === 'MATCH' ? 'Match' : 'Foster'} tone={conversation.source === 'MATCH' ? 'sage' : 'clay'} />
        {conversation.source === 'MATCH' && conversation.mode ? <StatusBadge label={modeLabel(conversation.mode)} tone="sky" /> : null}
        {conversation.source === 'MATCH' && conversation.ownerVerified ? <StatusBadge label="Owner verified" tone="sage" /> : null}
        {conversation.source === 'FOSTER' ? <StatusBadge label="Accepted" tone="sage" /> : null}
        {conversation.source === 'FOSTER' && conversation.organizationVerified ? (
          <StatusBadge label="Verified rescuer" tone="sage" />
        ) : null}
      </View>
      {conversation.organizationName ? <Text style={styles.bodyText}>{conversation.organizationName}</Text> : null}
      <Text style={styles.muted}>{formatLocation(conversation)}</Text>
      <Text style={styles.muted}>{conversation.privacyLabel}</Text>
      <View style={styles.lastMessage}>
        <Text style={styles.label}>Last message</Text>
        <Text style={styles.bodyText}>{conversation.lastMessage}</Text>
      </View>
      <Button label="Open" onPress={onOpen} tone="primary" />
    </Band>
  );
}

export function modeLabel(mode: NonNullable<Conversation['mode']>) {
  if (mode === 'PLAY') return 'Play';
  if (mode === 'SOCIAL') return 'Social';
  return 'Verified Mate';
}

export function formatLocation(conversation: Conversation) {
  return `${conversation.city}${conversation.coarseArea ? ` / ${conversation.coarseArea}` : ''}`;
}

const styles = StyleSheet.create({
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  bodyText: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: '700',
    lineHeight: 23,
  },
  cardName: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 26,
  },
  flex: {
    flex: 1,
  },
  label: {
    color: colors.inkSoft,
    fontSize: typography.caption,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  lastMessage: {
    gap: spacing.xxs,
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
  rowBetween: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
});
