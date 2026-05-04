import { StyleSheet, Text, View } from 'react-native';

import { Band, InfoRow } from '../../components/ui';
import { colors, spacing, typography } from '../../design/tokens';

export function HelpLegalSection() {
  return (
    <View style={styles.stack}>
      <Text style={styles.title}>Help and legal</Text>
      <Band>
        <InfoRow label="How matching works" value="Mutual matches unlock conversations" />
        <InfoRow label="How foster works" value="Accepted foster requests unlock chat" />
        <InfoRow label="Safety rules" value="Private location, reports, and blocks" />
        <InfoRow label="Contact support" value="Support center" />
        <InfoRow label="Terms" value="Terms of service" />
        <InfoRow label="Privacy policy" value="Privacy policy" />
        <InfoRow label="Animal welfare policy" value="Required for safe PetPal use" />
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
