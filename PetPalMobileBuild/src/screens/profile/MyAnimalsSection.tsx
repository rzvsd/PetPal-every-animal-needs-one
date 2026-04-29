import { StyleSheet, Text, View } from 'react-native';

import { Band, Button } from '../../components/ui';
import { colors, spacing, typography } from '../../design/tokens';
import { AnimalProfile } from '../../types/petpal';
import { AnimalProfileCard } from './AnimalProfileCard';

export function MyAnimalsSection({
  animals,
  onAddAnimal,
  onEditAnimal,
  onMatchSettings,
}: {
  animals: AnimalProfile[];
  onAddAnimal: () => void;
  onEditAnimal: (animal: AnimalProfile) => void;
  onMatchSettings: (animal: AnimalProfile) => void;
}) {
  return (
    <View style={styles.stack}>
      <Text style={styles.title}>My animals</Text>
      {animals.length ? (
        animals.map((animal) => (
          <AnimalProfileCard
            animal={animal}
            key={animal.id}
            onEdit={() => onEditAnimal(animal)}
            onMatchSettings={() => onMatchSettings(animal)}
          />
        ))
      ) : (
        <Band>
          <Text style={styles.emptyTitle}>No animal profile yet</Text>
          <Text style={styles.muted}>Create your first animal profile to start matching.</Text>
        </Band>
      )}
      <Button label="+ Add animal" onPress={onAddAnimal} tone="primary" />
    </View>
  );
}

const styles = StyleSheet.create({
  emptyTitle: {
    color: colors.ink,
    fontSize: typography.bodyLarge,
    fontWeight: '900',
    lineHeight: 24,
  },
  muted: {
    color: colors.inkMuted,
    fontSize: typography.body,
    fontWeight: '600',
    lineHeight: 23,
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
