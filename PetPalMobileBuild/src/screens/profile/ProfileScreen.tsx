import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Band, SectionHeader } from '../../components/ui';
import { colors, spacing, typography } from '../../design/tokens';
import { AnimalProfile, FosterPreferences, MatchPreferences, UserProfile } from '../../types/petpal';
import { AppSettingsSection } from './AppSettingsSection';
import { HelpLegalSection } from './HelpLegalSection';
import { MyAnimalsSection } from './MyAnimalsSection';
import { PreferencesSection } from './PreferencesSection';
import { SafetySection } from './SafetySection';
import { UserSummaryCard } from './UserSummaryCard';
import { VerificationSection } from './VerificationSection';

export function ProfileScreen({
  animals,
  eligibility,
  fosterPreferences,
  matchPreferences,
  onAddAnimal,
  onEditAnimal,
  onEditFosterPreferences,
  onEditMatchPreferences,
  onEditNotifications,
  onMatchSettings,
  userProfile,
}: {
  animals: AnimalProfile[];
  eligibility: { label: string; done: boolean }[];
  fosterPreferences: FosterPreferences;
  matchPreferences: MatchPreferences;
  onAddAnimal: () => void;
  onEditAnimal: (animal: AnimalProfile) => void;
  onEditFosterPreferences: () => void;
  onEditMatchPreferences: () => void;
  onEditNotifications: () => void;
  onMatchSettings: (animal: AnimalProfile) => void;
  userProfile: UserProfile;
}) {
  const [notice, setNotice] = useState<string | null>(null);

  function handleEditProfile() {
    setNotice('Profile editing will open as a dedicated account screen in the full app.');
  }

  function handleManageVerification() {
    setNotice('Verification management will show owner, animal, health document, and rescuer access steps.');
  }

  return (
    <View style={styles.stack}>
      <SectionHeader
        title="Profile"
        detail="Manage your animals, verification, preferences, and safety."
      />
      <UserSummaryCard
        onEditProfile={handleEditProfile}
        onManageVerification={handleManageVerification}
        userProfile={userProfile}
      />
      <MyAnimalsSection
        animals={animals}
        onAddAnimal={onAddAnimal}
        onEditAnimal={onEditAnimal}
        onMatchSettings={onMatchSettings}
      />
      <VerificationSection
        animals={animals}
        eligibility={eligibility}
        onManageVerification={handleManageVerification}
        userProfile={userProfile}
      />
      <PreferencesSection
        animals={animals}
        fosterPreferences={fosterPreferences}
        matchPreferences={matchPreferences}
        onEditFosterPreferences={onEditFosterPreferences}
        onEditMatchPreferences={onEditMatchPreferences}
        onEditNotifications={onEditNotifications}
      />
      <SafetySection
        onBlockedUsers={() => setNotice('Blocked users will open as a dedicated safety screen in the full app.')}
        onPrivacySettings={() => setNotice('Privacy settings will manage profile visibility and contact permissions.')}
        onReportHistory={() => setNotice('Report history will show submitted safety reports and review status.')}
      />
      {notice ? (
        <Band tone="sky">
          <Text style={styles.notice}>{notice}</Text>
        </Band>
      ) : null}
      <AppSettingsSection />
      <HelpLegalSection />
    </View>
  );
}

const styles = StyleSheet.create({
  notice: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: '700',
    lineHeight: 23,
  },
  stack: {
    gap: spacing.md,
  },
});
