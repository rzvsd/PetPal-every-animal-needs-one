import { Image, ImageSourcePropType, StyleSheet, Text, View } from 'react-native';

import { Band, InfoRow, SectionHeader, StatusBadge } from '../components/ui';
import { colors, radii, spacing, typography } from '../design/tokens';
import { DataSource } from '../hooks/useDiscovery';
import { DiscoveryListing } from '../types/petpal';
import { modeLabels } from '../utils/petpalFormat';

declare const require: (path: string) => ImageSourcePropType;

const appIcon = require('../../assets/petpal/app-icon-v1.png');

export function ProfileScreen({
  dataSource,
  loadMessage,
  selectedListing,
}: {
  dataSource: DataSource;
  loadMessage: string;
  selectedListing: DiscoveryListing;
}) {
  return (
    <View style={styles.screen}>
      <Band tone="surface">
        <SectionHeader
          eyebrow="Account and trust"
          title="Your PetPal profile"
          detail="Identity, privacy, and safety defaults live here so discovery stays focused on animals."
        />
        <View style={styles.profileRow}>
          <Image source={appIcon} style={styles.avatar} />
          <View style={styles.profileCopy}>
            <Text style={styles.profileName}>Demo adopter</Text>
            <Text style={styles.profileRole}>Adoption and foster applicant</Text>
          </View>
        </View>
        <InfoRow label="Connection" value={dataSource === 'supabase' ? 'Local Supabase live data' : 'Demo fallback data'} />
        <InfoRow label="Current interest" value={`${selectedListing.animalName} / ${modeLabels[selectedListing.mode]}`} />
        <InfoRow label="Privacy model" value="Exact addresses, documents, reports, and application answers are private." />
        <Text style={styles.helper}>{loadMessage}</Text>
      </Band>

      <Band tone="sage">
        <SectionHeader
          eyebrow="Always on"
          title="Safety defaults"
          detail="These controls are intentionally visible and boring. That is the point."
        />
        <View style={styles.safetyStack}>
          <SafetyRow title="Gated chat" />
          <SafetyRow title="Exact location hidden" />
          <SafetyRow title="Reports reviewed by admin" />
        </View>
      </Band>
    </View>
  );
}

function SafetyRow({ title }: { title: string }) {
  return (
    <View style={styles.safetyRow}>
      <Text style={styles.safetyTitle}>{title}</Text>
      <StatusBadge label="On" tone="sage" />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    gap: spacing.md,
  },
  profileRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  avatar: {
    backgroundColor: colors.cream,
    borderRadius: radii.md,
    height: 70,
    width: 70,
  },
  profileCopy: {
    flex: 1,
    gap: spacing.xxs,
  },
  profileName: {
    color: colors.ink,
    fontSize: typography.title,
    fontWeight: '900',
  },
  profileRole: {
    color: colors.inkMuted,
    fontSize: typography.body,
    fontWeight: '800',
    lineHeight: 22,
  },
  helper: {
    color: colors.inkMuted,
    fontSize: typography.small,
    fontWeight: '700',
    lineHeight: 19,
  },
  safetyStack: {
    gap: spacing.sm,
  },
  safetyRow: {
    alignItems: 'center',
    borderTopColor: colors.borderSoft,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
  },
  safetyTitle: {
    color: colors.ink,
    flex: 1,
    fontSize: typography.body,
    fontWeight: '900',
  },
});
