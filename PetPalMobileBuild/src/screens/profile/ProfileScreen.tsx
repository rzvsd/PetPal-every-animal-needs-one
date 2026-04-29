import { StyleSheet, View } from 'react-native';

import { SectionHeader } from '../../components/ui';
import { spacing } from '../../design/tokens';
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
  onEditProfile,
  onManageVerification,
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
  onEditProfile: () => void;
  onManageVerification: () => void;
  onMatchSettings: (animal: AnimalProfile) => void;
  userProfile: UserProfile;
}) {
  return (
    <View style={styles.stack}>
      <SectionHeader
        title="Profile"
        detail="Manage your animals, verification, preferences, and safety."
      />
      <UserSummaryCard
        onEditProfile={onEditProfile}
        onManageVerification={onManageVerification}
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
        onManageVerification={onManageVerification}
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
        onBlockedUsers={() => undefined}
        onPrivacySettings={() => undefined}
        onReportHistory={() => undefined}
      />
      <AppSettingsSection />
      <HelpLegalSection />
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.md,
  },
});
