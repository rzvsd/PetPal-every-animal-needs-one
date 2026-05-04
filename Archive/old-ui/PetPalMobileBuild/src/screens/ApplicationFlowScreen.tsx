import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Band, Button, InfoRow, StatusBadge, TextField } from '../components/ui';
import { colors, radii, spacing, typography } from '../design/tokens';
import { DiscoveryListing } from '../types/petpal';
import { modeLabels } from '../utils/petpalFormat';

export type ApplicationStep = 'home' | 'experience' | 'motivation' | 'review';

export const applicationSteps: { id: ApplicationStep; label: string }[] = [
  { id: 'home', label: 'Home' },
  { id: 'experience', label: 'Care' },
  { id: 'motivation', label: 'Reason' },
  { id: 'review', label: 'Review' },
];

export function nextStep(current: ApplicationStep): ApplicationStep {
  const index = applicationSteps.findIndex((step) => step.id === current);
  return applicationSteps[Math.min(index + 1, applicationSteps.length - 1)].id;
}

export function previousStep(current: ApplicationStep): ApplicationStep {
  const index = applicationSteps.findIndex((step) => step.id === current);
  return applicationSteps[Math.max(index - 1, 0)].id;
}

export function ApplicationFlowScreen({
  animalExperience,
  applicationReady,
  applicationStep,
  housingType,
  isSubmitting,
  motivation,
  onBack,
  onBackStep,
  onNextStep,
  onSetAnimalExperience,
  onSetApplicationStep,
  onSetHousingType,
  onSetMotivation,
  onSubmit,
  selectedListing,
  submitMessage,
}: {
  animalExperience: string;
  applicationReady: boolean;
  applicationStep: ApplicationStep;
  housingType: string;
  isSubmitting: boolean;
  motivation: string;
  onBack: () => void;
  onBackStep: () => void;
  onNextStep: () => void;
  onSetAnimalExperience: (value: string) => void;
  onSetApplicationStep: (step: ApplicationStep) => void;
  onSetHousingType: (value: string) => void;
  onSetMotivation: (value: string) => void;
  onSubmit: () => void;
  selectedListing: DiscoveryListing;
  submitMessage: string;
}) {
  return (
    <View style={styles.screen}>
      <Band tone="forest">
        <View style={styles.formHero}>
          <Text style={styles.kicker}>{modeLabels[selectedListing.mode]} request</Text>
          <Text style={styles.title}>Apply for {selectedListing.animalName}</Text>
          <Text style={styles.copy}>A rescue reviews your answers before chat opens. Keep it specific and practical.</Text>
        </View>
      </Band>

      <View style={styles.cancelRow}>
        <Button label="Cancel" onPress={onBack} tone="quiet" />
      </View>

      <Band tone="surface">
        <View style={styles.stepRow}>
          {applicationSteps.map((step, index) => (
            <Pressable
              accessibilityRole="button"
              key={step.id}
              onPress={() => onSetApplicationStep(step.id)}
              style={[styles.step, applicationStep === step.id && styles.stepActive]}
            >
              <Text style={[styles.stepNumber, applicationStep === step.id && styles.stepNumberActive]}>
                {index + 1}
              </Text>
              <Text style={[styles.stepLabel, applicationStep === step.id && styles.stepLabelActive]}>
                {step.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {applicationStep === 'home' ? (
          <View style={styles.formBlock}>
            <Text style={styles.formTitle}>The home setup</Text>
            <TextField
              helper="Mention space, daily routine, nearby park, transport limits, and quiet recovery area."
              label="Housing type"
              onChangeText={onSetHousingType}
              placeholder="Apartment near park, quiet room available..."
              value={housingType}
            />
            <Button label="Continue to care experience" onPress={onNextStep} />
          </View>
        ) : null}

        {applicationStep === 'experience' ? (
          <View style={styles.formBlock}>
            <Text style={styles.formTitle}>Care experience</Text>
            <TextField
              helper="Previous pets, fostering, training, medication, and how a normal day works."
              label="Animal experience"
              multiline
              onChangeText={onSetAnimalExperience}
              placeholder="Previous pets, fostering, training, medication, daily routines..."
              value={animalExperience}
            />
            <View style={styles.actionRow}>
              <Button label="Back" onPress={onBackStep} tone="secondary" style={styles.actionSmall} />
              <Button label="Continue to reason" onPress={onNextStep} style={styles.actionLarge} />
            </View>
          </View>
        ) : null}

        {applicationStep === 'motivation' ? (
          <View style={styles.formBlock}>
            <Text style={styles.formTitle}>Why this match works</Text>
            <TextField
              helper="Explain why this animal fits your home right now."
              label="Reason for applying"
              multiline
              onChangeText={onSetMotivation}
              placeholder="I can support recovery now because..."
              value={motivation}
            />
            <View style={styles.actionRow}>
              <Button label="Back" onPress={onBackStep} tone="secondary" style={styles.actionSmall} />
              <Button label="Review request" onPress={onNextStep} style={styles.actionLarge} />
            </View>
          </View>
        ) : null}

        {applicationStep === 'review' ? (
          <View style={styles.formBlock}>
            <Text style={styles.formTitle}>Final check</Text>
            <InfoRow label="Animal" value={`${selectedListing.animalName} / ${modeLabels[selectedListing.mode]}`} />
            <InfoRow label="Housing" value={housingType || 'Missing'} />
            <InfoRow label="Experience" value={animalExperience || 'Missing'} />
            <InfoRow label="Reason" value={motivation || 'Missing'} />
            <StatusBadge label={applicationReady ? 'Ready to submit' : 'Needs required fields'} tone={applicationReady ? 'sage' : 'rose'} />
            <View style={styles.actionRow}>
              <Button label="Back" onPress={onBackStep} tone="secondary" style={styles.actionSmall} />
              <Button
                disabled={!applicationReady || isSubmitting}
                label={isSubmitting ? 'Submitting' : 'Submit request'}
                onPress={onSubmit}
                style={styles.actionLarge}
              />
            </View>
          </View>
        ) : null}
        <Text style={styles.submitMessage}>{submitMessage}</Text>
      </Band>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    gap: spacing.md,
  },
  formHero: {
    gap: spacing.sm,
  },
  kicker: {
    alignSelf: 'flex-start',
    backgroundColor: colors.butter,
    borderRadius: radii.sm,
    color: colors.ink,
    fontSize: typography.caption,
    fontWeight: '900',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.cream,
    fontSize: typography.title,
    fontWeight: '900',
    lineHeight: 28,
  },
  copy: {
    color: colors.sky,
    fontSize: typography.body,
    fontWeight: '700',
    lineHeight: 22,
  },
  cancelRow: {
    alignItems: 'flex-start',
  },
  stepRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  step: {
    backgroundColor: colors.canvas,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flex: 1,
    gap: spacing.xxs,
    minHeight: 56,
    padding: spacing.xs,
  },
  stepActive: {
    backgroundColor: colors.forest,
    borderColor: colors.forest,
  },
  stepNumber: {
    color: colors.inkSoft,
    fontSize: typography.micro,
    fontWeight: '900',
  },
  stepNumberActive: {
    color: colors.butter,
  },
  stepLabel: {
    color: colors.ink,
    fontSize: typography.micro,
    fontWeight: '900',
  },
  stepLabelActive: {
    color: colors.cream,
  },
  formBlock: {
    gap: spacing.md,
  },
  formTitle: {
    color: colors.ink,
    fontSize: typography.title,
    fontWeight: '900',
    lineHeight: 27,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionSmall: {
    flex: 0.46,
  },
  actionLarge: {
    flex: 1,
  },
  submitMessage: {
    color: colors.inkMuted,
    fontSize: typography.small,
    fontWeight: '700',
    lineHeight: 19,
  },
});
