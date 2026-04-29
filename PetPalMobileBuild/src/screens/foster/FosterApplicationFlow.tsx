import { StyleSheet, Text, View } from 'react-native';

import { Band, Button, Chip, InfoRow, SectionHeader, TextField } from '../../components/ui';
import { colors, spacing, typography } from '../../design/tokens';
import { FosterApplicationDraft, FosterCase } from '../../types/petpal';

export const emptyFosterApplicationDraft: FosterApplicationDraft = {
  housingType: '',
  experience: '',
  availability: '',
  otherPets: '',
  childrenInHome: '',
  canTransport: null,
  canHandleMedicalNeeds: null,
  motivation: '',
};

const steps = ['Home', 'Experience', 'Availability', 'Household', 'Review'];

export function FosterApplicationFlow({
  draft,
  fosterCase,
  onBack,
  onChange,
  onStepChange,
  onSubmit,
  step,
}: {
  draft: FosterApplicationDraft;
  fosterCase: FosterCase;
  onBack: () => void;
  onChange: (draft: FosterApplicationDraft) => void;
  onStepChange: (step: number) => void;
  onSubmit: () => void;
  step: number;
}) {
  const ready = isFosterApplicationReady(draft);

  return (
    <View style={styles.stack}>
      <Button label="Back" onPress={onBack} tone="quiet" />
      <SectionHeader
        eyebrow="Foster application"
        title={fosterCase.animalName}
        detail="Tell the rescuer what your home can safely support."
      />
      <Band>
        <View style={styles.wrapRow}>
          {steps.map((label, index) => (
            <Chip key={label} label={label} onPress={() => onStepChange(index)} selected={index === step} />
          ))}
        </View>
        {step === 0 ? <HomeStep draft={draft} onChange={onChange} /> : null}
        {step === 1 ? <ExperienceStep draft={draft} onChange={onChange} /> : null}
        {step === 2 ? <AvailabilityStep draft={draft} onChange={onChange} /> : null}
        {step === 3 ? <HouseholdStep draft={draft} onChange={onChange} /> : null}
        {step === 4 ? <ReviewStep draft={draft} onChange={onChange} /> : null}
      </Band>
      <View style={styles.actions}>
        <Button
          label="Previous step"
          onPress={() => onStepChange(Math.max(0, step - 1))}
          tone="quiet"
          style={styles.actionButton}
        />
        {step < steps.length - 1 ? (
          <Button
            label="Continue"
            onPress={() => onStepChange(Math.min(steps.length - 1, step + 1))}
            tone="primary"
            style={styles.actionButton}
          />
        ) : (
          <Button
            disabled={!ready}
            label="Send foster request"
            onPress={onSubmit}
            tone="primary"
            style={styles.actionButton}
          />
        )}
      </View>
      <Text style={styles.muted}>
        Your request is sent first. Chat opens only if the rescuer accepts it.
      </Text>
    </View>
  );
}

function HomeStep({
  draft,
  onChange,
}: {
  draft: FosterApplicationDraft;
  onChange: (draft: FosterApplicationDraft) => void;
}) {
  return (
    <TextField
      helper="Example: apartment, house, yard access, landlord approval."
      label="Housing type"
      multiline
      onChangeText={(housingType) => onChange({ ...draft, housingType })}
      placeholder="Where would the animal stay?"
      value={draft.housingType}
    />
  );
}

function ExperienceStep({
  draft,
  onChange,
}: {
  draft: FosterApplicationDraft;
  onChange: (draft: FosterApplicationDraft) => void;
}) {
  return (
    <View style={styles.stack}>
      <TextField
        label="Experience"
        multiline
        onChangeText={(experience) => onChange({ ...draft, experience })}
        placeholder="Have you cared for animals before?"
        value={draft.experience}
      />
      <BooleanChoice
        label="Can handle medical needs"
        onChange={(canHandleMedicalNeeds) => onChange({ ...draft, canHandleMedicalNeeds })}
        value={draft.canHandleMedicalNeeds}
      />
    </View>
  );
}

function AvailabilityStep({
  draft,
  onChange,
}: {
  draft: FosterApplicationDraft;
  onChange: (draft: FosterApplicationDraft) => void;
}) {
  return (
    <View style={styles.stack}>
      <TextField
        label="Availability"
        multiline
        onChangeText={(availability) => onChange({ ...draft, availability })}
        placeholder="How long can you foster?"
        value={draft.availability}
      />
      <BooleanChoice
        label="Can help with transport"
        onChange={(canTransport) => onChange({ ...draft, canTransport })}
        value={draft.canTransport}
      />
    </View>
  );
}

function HouseholdStep({
  draft,
  onChange,
}: {
  draft: FosterApplicationDraft;
  onChange: (draft: FosterApplicationDraft) => void;
}) {
  return (
    <View style={styles.stack}>
      <TextField
        label="Other pets"
        multiline
        onChangeText={(otherPets) => onChange({ ...draft, otherPets })}
        placeholder="List pets at home, or write none."
        value={draft.otherPets}
      />
      <TextField
        label="Children in home"
        multiline
        onChangeText={(childrenInHome) => onChange({ ...draft, childrenInHome })}
        placeholder="Ages, routines, or write none."
        value={draft.childrenInHome}
      />
    </View>
  );
}

function ReviewStep({
  draft,
  onChange,
}: {
  draft: FosterApplicationDraft;
  onChange: (draft: FosterApplicationDraft) => void;
}) {
  return (
    <View style={styles.stack}>
      <InfoRow label="Housing" value={draft.housingType || 'Missing'} />
      <InfoRow label="Experience" value={draft.experience || 'Missing'} />
      <InfoRow label="Availability" value={draft.availability || 'Missing'} />
      <InfoRow label="Other pets" value={draft.otherPets || 'Missing'} />
      <InfoRow label="Children" value={draft.childrenInHome || 'Missing'} />
      <InfoRow label="Transport" value={booleanLabel(draft.canTransport)} />
      <InfoRow label="Medical needs" value={booleanLabel(draft.canHandleMedicalNeeds)} />
      <TextField
        label="Motivation"
        multiline
        onChangeText={(motivation) => onChange({ ...draft, motivation })}
        placeholder="Why do you want to help this animal?"
        value={draft.motivation}
      />
    </View>
  );
}

function BooleanChoice({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: boolean) => void;
  value: boolean | null;
}) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.wrapRow}>
        <Chip label="Yes" onPress={() => onChange(true)} selected={value === true} />
        <Chip label="No" onPress={() => onChange(false)} selected={value === false} />
      </View>
    </View>
  );
}

export function isFosterApplicationReady(draft: FosterApplicationDraft) {
  return (
    draft.housingType.trim().length >= 3 &&
    draft.experience.trim().length >= 3 &&
    draft.availability.trim().length >= 3 &&
    draft.otherPets.trim().length >= 2 &&
    draft.childrenInHome.trim().length >= 2 &&
    draft.canTransport !== null &&
    draft.canHandleMedicalNeeds !== null &&
    draft.motivation.trim().length >= 3
  );
}

function booleanLabel(value: boolean | null) {
  if (value === null) return 'Missing';
  return value ? 'Yes' : 'No';
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
  fieldGroup: {
    gap: spacing.xs,
  },
  label: {
    color: colors.ink,
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
  stack: {
    gap: spacing.md,
  },
  wrapRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
});
