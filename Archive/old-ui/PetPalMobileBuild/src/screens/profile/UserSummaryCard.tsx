import { StyleSheet, Text, View } from 'react-native';

import { Band, Button, StatusBadge } from '../../components/ui';
import { colors, spacing, typography } from '../../design/tokens';
import { UserProfile, UserRole } from '../../types/petpal';
import { verificationStatusLabel } from './AnimalProfileCard';

export function UserSummaryCard({
  onEditProfile,
  onManageVerification,
  userProfile,
}: {
  onEditProfile: () => void;
  onManageVerification: () => void;
  userProfile: UserProfile;
}) {
  return (
    <Band tone="sage">
      <View style={styles.rowBetween}>
        <View style={styles.flex}>
          <Text style={styles.name}>{userProfile.displayName}</Text>
          <Text style={styles.meta}>{formatLocation(userProfile)}</Text>
          <Text style={styles.bodyText}>{userProfile.roles.map(roleLabel).join(' / ')}</Text>
        </View>
        <StatusBadge label={verificationStatusLabel(userProfile.ownerVerificationStatus)} tone="sky" />
      </View>
      <Text style={styles.bodyText}>Owner verification: {verificationStatusLabel(userProfile.ownerVerificationStatus)}</Text>
      <Text style={styles.bodyText}>Rescuer access: {verificationStatusLabel(userProfile.rescuerAccessStatus)}</Text>
      <View style={styles.actions}>
        <Button label="Edit profile" onPress={onEditProfile} tone="secondary" style={styles.actionButton} />
        <Button label="Verification" onPress={onManageVerification} tone="quiet" style={styles.actionButton} />
      </View>
    </Band>
  );
}

function formatLocation(userProfile: UserProfile) {
  return `${userProfile.city}${userProfile.coarseArea ? ` / ${userProfile.coarseArea}` : ''}`;
}

function roleLabel(role: UserRole) {
  if (role === 'OWNER') return 'Owner profile';
  if (role === 'FOSTER_VOLUNTEER') return 'Foster volunteer';
  if (role === 'RESCUER') return 'Rescuer';
  return 'Shelter member';
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
  flex: {
    flex: 1,
  },
  meta: {
    color: colors.inkMuted,
    fontSize: typography.body,
    fontWeight: '800',
    lineHeight: 22,
  },
  name: {
    color: colors.ink,
    fontSize: 28,
    fontWeight: '900',
    lineHeight: 32,
  },
  rowBetween: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
});
