import { StyleSheet, Text, View } from 'react-native';

import { Band, InfoRow } from '../../components/ui';
import { colors, spacing, typography } from '../../design/tokens';

export function AppSettingsSection() {
  return (
    <View style={styles.stack}>
      <Text style={styles.title}>App settings</Text>
      <Band>
        <InfoRow label="Language" value="English" />
        <InfoRow label="Notifications" value="Match and foster updates enabled" />
        <InfoRow label="Data export" value="Available from account tools" />
        <InfoRow label="Delete account" value="Available with confirmation" />
      </Band>
    </View>
  );
}

const styles = StyleSheet.create({
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
