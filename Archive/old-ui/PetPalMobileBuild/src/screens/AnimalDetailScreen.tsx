import { StyleSheet, Text, View } from 'react-native';

import { AnimalPortrait, Band, Button, InfoRow, StatusBadge, formatLocation, modeTone } from '../components/ui';
import { colors, spacing, typography } from '../design/tokens';
import { DiscoveryListing } from '../types/petpal';
import { formatAge, modeLabels } from '../utils/petpalFormat';

export function AnimalDetailScreen({
  onApply,
  onBack,
  selectedListing,
}: {
  onApply: () => void;
  onBack: () => void;
  selectedListing: DiscoveryListing;
}) {
  const intent = modeLabels[selectedListing.mode].toLowerCase();

  return (
    <View style={styles.screen}>
      <Band tone="forest">
        <AnimalPortrait listing={selectedListing} variant="hero" />
        <View style={styles.heroCopy}>
          <View style={styles.topline}>
            <StatusBadge label={modeLabels[selectedListing.mode]} tone={modeTone(selectedListing.mode)} />
            <Text style={styles.verified}>Verified rescue profile</Text>
          </View>
          <Text style={styles.title}>{selectedListing.animalName}</Text>
          <Text style={styles.meta}>
            {selectedListing.species} / {formatAge(selectedListing.approximateAgeMonths)} / {selectedListing.sizeLabel ?? 'Size TBD'}
          </Text>
          <Text style={styles.body}>{selectedListing.description}</Text>
        </View>
      </Band>

      <View style={styles.actionRow}>
        <Button label="Back" onPress={onBack} tone="quiet" style={styles.secondaryAction} />
        <Button label={`Apply to ${intent}`} onPress={onApply} style={styles.primaryAction} />
      </View>

      <Band tone="surface">
        <Text style={styles.bandKicker}>What is public</Text>
        <InfoRow label="Coarse location" value={formatLocation(selectedListing)} />
        <InfoRow label="Temperament" value={selectedListing.temperament ?? 'Not specified yet'} />
        <InfoRow label="Public health" value={selectedListing.publicHealthSummary ?? 'Not specified yet'} />
        <InfoRow label="Organization" value={`${selectedListing.organizationName} / verified`} />
      </Band>

      <Band tone="sage">
        <Text style={styles.bandKicker}>Safety before contact</Text>
        <View style={styles.ruleStack}>
          <SafetyRule title="Application first" body="The rescuer reviews your request before private chat opens." />
          <SafetyRule title="Exact address hidden" body="PetPal only shows coarse areas in public discovery." />
          <SafetyRule title="Reports remain available" body="Every handoff flow keeps blocking and moderation nearby." />
        </View>
      </Band>
    </View>
  );
}

function SafetyRule({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.rule}>
      <Text style={styles.ruleTitle}>{title}</Text>
      <Text style={styles.ruleBody}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    gap: spacing.md,
  },
  heroCopy: {
    gap: spacing.sm,
  },
  topline: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  verified: {
    color: colors.sky,
    flex: 1,
    fontSize: typography.caption,
    fontWeight: '900',
    textAlign: 'right',
    textTransform: 'uppercase',
  },
  title: {
    color: colors.cream,
    fontSize: typography.headline,
    fontWeight: '900',
    lineHeight: 32,
  },
  meta: {
    color: colors.butter,
    fontSize: typography.caption,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  body: {
    color: colors.sky,
    fontSize: typography.body,
    fontWeight: '700',
    lineHeight: 23,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  secondaryAction: {
    flex: 0.42,
  },
  primaryAction: {
    flex: 1,
  },
  bandKicker: {
    color: colors.clay,
    fontSize: typography.caption,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  ruleStack: {
    gap: spacing.sm,
  },
  rule: {
    borderTopColor: colors.borderSoft,
    borderTopWidth: 1,
    gap: spacing.xxs,
    paddingTop: spacing.sm,
  },
  ruleTitle: {
    color: colors.ink,
    fontSize: typography.bodyLarge,
    fontWeight: '900',
  },
  ruleBody: {
    color: colors.inkMuted,
    fontSize: typography.body,
    lineHeight: 22,
  },
});
