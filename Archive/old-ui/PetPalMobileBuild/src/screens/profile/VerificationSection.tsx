import { StyleSheet, Text, View } from 'react-native';

import { Band, Button, InfoRow, StatusBadge } from '../../components/ui';
import { colors, spacing, typography } from '../../design/tokens';
import { AnimalProfile, UserProfile } from '../../types/petpal';
import { verificationStatusLabel, verifiedMateAnimalStatus } from './AnimalProfileCard';

export function VerificationSection({
  animals,
  eligibility,
  onManageVerification,
  userProfile,
}: {
  animals: AnimalProfile[];
  eligibility: { label: string; done: boolean }[];
  onManageVerification: () => void;
  userProfile: UserProfile;
}) {
  const missingItems = eligibility.filter((item) => !item.done).map((item) => item.label);
  const primaryAnimal = animals[0] ?? null;

  return (
    <View style={styles.stack}>
      <Text style={styles.title}>Verification</Text>
      <Band>
        <ChecklistRow
          label="Owner verification"
          status={verificationStatusLabel(userProfile.ownerVerificationStatus)}
          unlocks="Unlocks stronger trust signals across matches and foster requests."
          complete={userProfile.ownerVerificationStatus === 'VERIFIED'}
        />
        <ChecklistRow
          label="Animal profile completeness"
          status={primaryAnimal ? `${primaryAnimal.name}: ${primaryAnimal.profileCompleteness >= 85 ? 'Complete' : 'Missing details'}` : 'No animal profile'}
          unlocks="Improves matching and shows safer animal context."
          complete={Boolean(primaryAnimal && primaryAnimal.profileCompleteness >= 85)}
        />
        <ChecklistRow
          label="Health documents"
          status={primaryAnimal ? `${primaryAnimal.name}: ${verificationStatusLabel(primaryAnimal.healthDocumentStatus)}` : 'No animal profile'}
          unlocks="Required for Verified Mate and stronger trust."
          complete={Boolean(primaryAnimal && primaryAnimal.healthDocumentStatus === 'VERIFIED')}
        />
        <ChecklistRow
          label="Verified Mate eligibility"
          status={primaryAnimal ? `${primaryAnimal.name}: ${verifiedMateAnimalStatus(primaryAnimal)}` : 'Locked'}
          unlocks={missingItems.length ? `Missing: ${missingItems.join(', ')}` : 'Verified Mate can be used when a mutual match exists.'}
          complete={Boolean(primaryAnimal && verifiedMateAnimalStatus(primaryAnimal) === 'Verified')}
        />
        <ChecklistRow
          label="Rescuer/shelter access"
          status={verificationStatusLabel(userProfile.rescuerAccessStatus)}
          unlocks="Unlocks foster case management for verified rescuers or shelters."
          complete={userProfile.rescuerAccessStatus === 'VERIFIED'}
        />
        <Button label="Manage verification" onPress={onManageVerification} tone="secondary" />
      </Band>
    </View>
  );
}

function ChecklistRow({
  complete,
  label,
  status,
  unlocks,
}: {
  complete: boolean;
  label: string;
  status: string;
  unlocks: string;
}) {
  return (
    <View style={styles.checkRow}>
      <View style={styles.rowBetween}>
        <Text style={styles.label}>{label}</Text>
        <StatusBadge label={complete ? 'Verified' : 'Pending'} tone={complete ? 'sage' : 'sky'} />
      </View>
      <InfoRow label="Status" value={status} />
      <Text style={styles.muted}>{unlocks}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  checkRow: {
    borderTopColor: colors.borderSoft,
    borderTopWidth: 1,
    gap: spacing.xs,
    paddingTop: spacing.sm,
  },
  label: {
    color: colors.ink,
    flex: 1,
    fontSize: typography.caption,
    fontWeight: '900',
    textTransform: 'uppercase',
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
