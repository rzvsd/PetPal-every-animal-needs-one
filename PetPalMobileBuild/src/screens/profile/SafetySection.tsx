import { StyleSheet, Text, View } from 'react-native';

import { Band, Button, InfoRow } from '../../components/ui';
import { colors, spacing, typography } from '../../design/tokens';

export function SafetySection({
  onBlockedUsers,
  onPrivacySettings,
  onReportHistory,
}: {
  onBlockedUsers: () => void;
  onPrivacySettings: () => void;
  onReportHistory: () => void;
}) {
  return (
    <View style={styles.stack}>
      <Text style={styles.title}>Safety</Text>
      <Band tone="sky">
        <InfoRow label="Blocked users" value="Manage people you blocked" />
        <InfoRow label="Report history" value="Review reports you submitted" />
        <InfoRow label="Privacy settings" value="Control profile and contact visibility" />
        <InfoRow label="Location visibility" value="Exact location is never public." />
        <View style={styles.actions}>
          <Button label="Manage blocked users" onPress={onBlockedUsers} tone="secondary" style={styles.actionButton} />
          <Button label="Privacy settings" onPress={onPrivacySettings} tone="quiet" style={styles.actionButton} />
          <Button label="Report history" onPress={onReportHistory} tone="quiet" style={styles.actionButton} />
        </View>
      </Band>
    </View>
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
    minWidth: 120,
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
