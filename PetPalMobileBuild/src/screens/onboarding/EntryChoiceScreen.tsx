import { StyleSheet, Text, View } from 'react-native';

import { Button } from '../../components/ui';
import { colors, spacing, typography } from '../../design/tokens';
import { EntryChoice } from '../../types/petpal';

export function EntryChoiceScreen({
  onChoose,
}: {
  onChoose: (choice: Exclude<EntryChoice, null>) => void;
}) {
  return (
    <View style={styles.entry}>
      <Text style={styles.entryBrand}>PetPal</Text>
      <Text style={styles.entryTitle}>Every animal deserves their person.</Text>
      <Text style={styles.entryBody}>What do you want to do?</Text>
      <Button label="I have an animal and want matches" onPress={() => onChoose('animal')} tone="primary" />
      <Button label="I want to offer foster" onPress={() => onChoose('foster')} tone="secondary" />
      <Button label="I am a rescuer / shelter" onPress={() => onChoose('rescuer')} tone="quiet" />
    </View>
  );
}

const styles = StyleSheet.create({
  entry: {
    flex: 1,
    gap: spacing.md,
    justifyContent: 'center',
    minHeight: 620,
    padding: spacing.xl,
  },
  entryBody: {
    color: colors.inkMuted,
    fontSize: typography.bodyLarge,
    fontWeight: '700',
  },
  entryBrand: {
    color: colors.forest,
    fontFamily: 'serif',
    fontSize: 44,
    fontWeight: '900',
  },
  entryTitle: {
    color: colors.ink,
    fontSize: typography.headline,
    fontWeight: '900',
    lineHeight: 32,
  },
});
