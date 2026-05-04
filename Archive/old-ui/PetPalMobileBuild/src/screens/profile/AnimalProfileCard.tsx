import { StyleSheet, Text, View } from 'react-native';

import { Band, Button, StatusBadge } from '../../components/ui';
import { colors, spacing, typography } from '../../design/tokens';
import { AnimalProfile, MatchMode, Species, VerificationStatus } from '../../types/petpal';

export function AnimalProfileCard({
  animal,
  onEdit,
  onMatchSettings,
}: {
  animal: AnimalProfile;
  onEdit: () => void;
  onMatchSettings: () => void;
}) {
  return (
    <Band>
      <View style={styles.rowBetween}>
        <View style={styles.flex}>
          <Text style={styles.cardName}>{animal.name}</Text>
          <Text style={styles.meta}>
            {speciesLabel(animal.species)} / {animal.breed ?? 'Mixed breed'} / {sexLabel(animal.sex)} / {ageLabel(animal.ageMonths)}
          </Text>
        </View>
        <StatusBadge label={verificationStatusLabel(animal.verificationStatus)} tone={animal.verificationStatus === 'VERIFIED' ? 'sage' : 'sky'} />
      </View>
      <Text style={styles.bodyText}>Profile complete: {animal.profileCompleteness}%</Text>
      <Text style={styles.bodyText}>Active goals: {animal.activeMatchModes.map(matchModeLabel).join(', ')}</Text>
      <View style={styles.verificationBlock}>
        <Text style={styles.label}>Verification</Text>
        <Text style={styles.muted}>Animal profile: {animal.profileCompleteness >= 85 ? 'Complete' : 'Needs more details'}</Text>
        <Text style={styles.muted}>Health documents: {verificationStatusLabel(animal.healthDocumentStatus)}</Text>
        <Text style={styles.muted}>Verified Mate: {verifiedMateAnimalStatus(animal)}</Text>
      </View>
      <View style={styles.actions}>
        <Button label="Edit animal" onPress={onEdit} tone="secondary" style={styles.actionButton} />
        <Button label="Match settings" onPress={onMatchSettings} tone="quiet" style={styles.actionButton} />
      </View>
    </Band>
  );
}

export function speciesLabel(species: Species) {
  return species === 'DOG' ? 'Dog' : 'Cat';
}

export function sexLabel(sex: AnimalProfile['sex']) {
  if (sex === 'MALE') return 'Male';
  if (sex === 'FEMALE') return 'Female';
  return 'Sex unknown';
}

export function ageLabel(months: number | null) {
  if (!months) return 'unknown age';
  if (months < 12) return `${months} months`;
  const years = Math.floor(months / 12);
  return years === 1 ? '1 year' : `${years} years`;
}

export function matchModeLabel(mode: MatchMode) {
  if (mode === 'PLAY') return 'Play';
  if (mode === 'SOCIAL') return 'Social';
  return 'Verified Mate';
}

export function verificationStatusLabel(status: VerificationStatus) {
  if (status === 'UNVERIFIED') return 'Not verified';
  if (status === 'PENDING') return 'Pending';
  if (status === 'VERIFIED') return 'Verified';
  return 'Rejected';
}

export function verifiedMateAnimalStatus(animal: AnimalProfile) {
  if (!animal.activeMatchModes.includes('VERIFIED_MATE')) return 'Locked';
  if (animal.adminMateApprovalStatus === 'VERIFIED') return 'Verified';
  if (animal.adminMateApprovalStatus === 'PENDING') return 'Pending admin approval';
  if (animal.adminMateApprovalStatus === 'REJECTED') return 'Rejected';
  return 'Locked';
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
  bodyText: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: '700',
    lineHeight: 23,
  },
  cardName: {
    color: colors.ink,
    fontSize: 24,
    fontWeight: '900',
    lineHeight: 28,
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
  verificationBlock: {
    gap: spacing.xxs,
  },
});
