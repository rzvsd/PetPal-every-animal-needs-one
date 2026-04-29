import { StyleSheet, Text, View } from 'react-native';

import { Band, Button, InfoRow } from '../../components/ui';
import { colors, spacing, typography } from '../../design/tokens';
import { AnimalProfile, FosterPreferences, MatchPreferences, Species } from '../../types/petpal';
import { matchModeLabel } from './AnimalProfileCard';

export function PreferencesSection({
  animals,
  fosterPreferences,
  matchPreferences,
  onEditFosterPreferences,
  onEditMatchPreferences,
  onEditNotifications,
}: {
  animals: AnimalProfile[];
  fosterPreferences: FosterPreferences;
  matchPreferences: MatchPreferences;
  onEditFosterPreferences: () => void;
  onEditMatchPreferences: () => void;
  onEditNotifications: () => void;
}) {
  const defaultAnimal = animals.find((animal) => animal.id === matchPreferences.defaultAnimalId) ?? animals[0] ?? null;

  return (
    <View style={styles.stack}>
      <Text style={styles.title}>Preferences</Text>
      <Band>
        <Text style={styles.label}>Match preferences</Text>
        <InfoRow label="Default animal" value={defaultAnimal?.name ?? 'Not selected'} />
        <InfoRow label="Default mode" value={matchModeLabel(matchPreferences.defaultMode)} />
        <InfoRow label="Distance" value={locationLabel(matchPreferences.city, matchPreferences.coarseArea)} />
        <InfoRow label="Show only verified owners" value={yesNo(matchPreferences.verifiedOnly)} />
        <InfoRow label="Breed filters" value={matchPreferences.breeds.join(', ') || 'No breed filters'} />
        <InfoRow label="Mixed breeds" value={matchPreferences.allowMixedBreeds ? 'Allowed' : 'Hidden'} />
        <Button label="Edit match preferences" onPress={onEditMatchPreferences} tone="secondary" />
      </Band>
      <Band>
        <Text style={styles.label}>Foster preferences</Text>
        <InfoRow label="Can foster" value={matchSpeciesLabel(fosterPreferences.species)} />
        <InfoRow label="Preferred size" value={fosterPreferences.sizeLabels.map(sizeLabel).join(', ')} />
        <InfoRow label="Available duration" value={durationLabel(fosterPreferences.duration)} />
        <InfoRow label="Can transport" value={nullableYesNo(fosterPreferences.canTransport)} />
        <InfoRow label="Can handle medical needs" value={nullableYesNo(fosterPreferences.canHandleMedicalNeeds)} />
        <InfoRow label="Other pets at home" value={fosterPreferences.otherPets ?? 'Not set'} />
        <InfoRow label="Children at home" value={fosterPreferences.childrenInHome ?? 'Not set'} />
        <Button label="Edit foster preferences" onPress={onEditFosterPreferences} tone="secondary" />
      </Band>
      <Band>
        <Text style={styles.label}>Notification preferences</Text>
        <InfoRow label="Matches" value="On for mutual matches" />
        <InfoRow label="Foster requests" value="On for accepted requests" />
        <InfoRow label="Safety updates" value="Always on" />
        <Button label="Edit notifications" onPress={onEditNotifications} tone="quiet" />
      </Band>
    </View>
  );
}

function matchSpeciesLabel(species: Species[]) {
  if (!species.length) return 'Not set';
  return species.map((item) => (item === 'DOG' ? 'Dogs' : 'Cats')).join(', ');
}

function locationLabel(city: string | null, area: string | null) {
  if (!city && !area) return 'Not set';
  return `${city ?? 'Any city'}${area ? ` / ${area}` : ''}`;
}

function yesNo(value: boolean) {
  return value ? 'Yes' : 'No';
}

function nullableYesNo(value: boolean | null) {
  if (value === null) return 'Not set';
  return yesNo(value);
}

function sizeLabel(size: FosterPreferences['sizeLabels'][number]) {
  if (size === 'SMALL') return 'Small';
  if (size === 'MEDIUM') return 'Medium';
  return 'Large';
}

function durationLabel(duration: FosterPreferences['duration']) {
  const labels: Record<FosterPreferences['duration'], string> = {
    FEW_DAYS: 'Few days',
    ONE_TWO_WEEKS: '1-2 weeks',
    ONE_MONTH: '1 month',
    UNTIL_ADOPTION: 'Until adoption',
    UNKNOWN: 'Unknown yet',
  };
  return labels[duration];
}

const styles = StyleSheet.create({
  label: {
    color: colors.ink,
    fontSize: typography.caption,
    fontWeight: '900',
    textTransform: 'uppercase',
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
