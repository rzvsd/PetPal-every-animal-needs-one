import { StyleSheet, Text, View } from 'react-native';

import { Band, Button } from '../../components/ui';
import { colors, spacing, typography } from '../../design/tokens';
import { Conversation } from '../../types/petpal';

export function SafetyMenu({
  conversation,
  onBlock,
  onReport,
  onViewContext,
}: {
  conversation: Conversation;
  onBlock: () => void;
  onReport: () => void;
  onViewContext: () => void;
}) {
  return (
    <Band tone="surface">
      <Text style={styles.label}>Safety menu</Text>
      <View style={styles.actions}>
        <Button label="View context" onPress={onViewContext} tone="quiet" style={styles.actionButton} />
        <Button
          label={conversation.reported ? 'Reported' : reportLabel(conversation)}
          onPress={onReport}
          tone="quiet"
          style={styles.actionButton}
        />
        <Button
          label={conversation.blocked ? 'Blocked' : blockLabel(conversation)}
          onPress={onBlock}
          tone="quiet"
          style={styles.actionButton}
        />
      </View>
    </Band>
  );
}

function reportLabel(conversation: Conversation) {
  return conversation.source === 'MATCH' ? 'Report match' : 'Report foster conversation';
}

function blockLabel(conversation: Conversation) {
  return conversation.source === 'MATCH' ? 'Block owner' : 'Block user';
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  actionButton: {
    flex: 1,
    minWidth: 112,
  },
  label: {
    color: colors.ink,
    fontSize: typography.caption,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
});
