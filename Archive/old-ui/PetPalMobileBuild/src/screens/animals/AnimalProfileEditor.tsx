import { StyleSheet, Text, View } from 'react-native';

import { Band, Button, SectionHeader, TextField } from '../../components/ui';
import { colors, spacing, typography } from '../../design/tokens';
import { AnimalProfileDraft } from '../../types/petpal';

export function AnimalProfileEditor({
  form,
  isEditing,
  onBack,
  onChange,
  onSave,
}: {
  form: AnimalProfileDraft;
  isEditing: boolean;
  onBack: () => void;
  onChange: (form: AnimalProfileDraft) => void;
  onSave: () => void;
}) {
  return (
    <View style={styles.stack}>
      <Button label="Back" onPress={onBack} tone="quiet" />
      <SectionHeader
        eyebrow="Animal profile"
        title={isEditing ? 'Edit animal profile' : 'Create animal profile'}
        detail="Local demo for species, breed, age, sex, size, health, temperament, coarse location, and goals."
      />
      <Band>
        <TextField label="Name" onChangeText={(name) => onChange({ ...form, name })} placeholder="Max" value={form.name} />
        <TextField label="Breed" onChangeText={(breed) => onChange({ ...form, breed })} placeholder="Labrador" value={form.breed} />
        <TextField label="City" onChangeText={(city) => onChange({ ...form, city })} placeholder="Bucharest" value={form.city} />
        <TextField
          label="Area"
          onChangeText={(coarseArea) => onChange({ ...form, coarseArea })}
          placeholder="Sector 3"
          value={form.coarseArea}
        />
        <Text style={styles.muted}>
          Fields included in demo: species, mixed breed, age, sex, size, weight, sterilization, vaccines,
          temperament, energy, good with dogs/cats/children, photos, and active goals.
        </Text>
      </Band>
      <Button label={isEditing ? 'Save changes' : 'Save animal profile'} onPress={onSave} tone="primary" />
    </View>
  );
}

const styles = StyleSheet.create({
  muted: {
    color: colors.inkMuted,
    fontSize: typography.small,
    fontWeight: '600',
    lineHeight: 20,
  },
  stack: {
    gap: spacing.md,
  },
});
