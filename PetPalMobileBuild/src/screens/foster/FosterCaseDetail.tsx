import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Band, Button, InfoRow, SectionHeader } from '../../components/ui';
import { colors, spacing, typography } from '../../design/tokens';
import { FosterCase } from '../../types/petpal';
import {
  ageLabel,
  coverageText,
  durationLabel,
  formatLocation,
  sizeLabel,
  speciesLabel,
  urgencyLabel,
} from './FosterCaseCard';

export function FosterCaseDetail({
  fosterCase,
  onApply,
  onBack,
  onReport,
  onSave,
}: {
  fosterCase: FosterCase;
  onApply: () => void;
  onBack: () => void;
  onReport?: () => void;
  onSave?: () => void;
}) {
  const [notice, setNotice] = useState<string | null>(null);

  function handleSave() {
    if (onSave) {
      onSave();
      return;
    }
    setNotice('Saved foster cases will appear in a dedicated list in the full app.');
  }

  function handleReport() {
    if (onReport) {
      onReport();
      return;
    }
    setNotice('Reports will open a protected safety form in the full app.');
  }

  return (
    <View style={styles.stack}>
      <Button label="Back" onPress={onBack} tone="quiet" />
      <SectionHeader
        eyebrow="Foster case"
        title={fosterCase.animalName}
        detail={`${speciesLabel(fosterCase.species)} / ${ageLabel(fosterCase.ageMonths)} / ${sizeLabel(fosterCase.sizeLabel)}`}
      />
      <Band>
        <InfoRow label="Foster needed" value={durationLabel(fosterCase.duration)} />
        <InfoRow label="Urgency" value={urgencyLabel(fosterCase.urgency)} />
        <InfoRow label="What is covered" value={coverageText(fosterCase)} />
        <InfoRow label="Home fit" value={fosterCase.homeFit} />
        <InfoRow label="Health" value={fosterCase.medicalNeeds ?? 'No public medical needs.'} />
        <InfoRow label="Location" value={`${formatLocation(fosterCase)}. Exact location stays private.`} />
        <InfoRow
          label="Rescuer"
          value={`${fosterCase.rescuerName} / ${fosterCase.rescuerVerified ? 'Verified' : 'Unverified'}`}
        />
      </Band>
      <Band tone="sky">
        <Text style={styles.label}>What happens after applying</Text>
        <Text style={styles.bodyText}>1. The rescuer reviews your request.</Text>
        <Text style={styles.bodyText}>2. If accepted, chat opens.</Text>
        <Text style={styles.bodyText}>3. Handover details are arranged privately.</Text>
      </Band>
      <View style={styles.actions}>
        <Button label="Apply to foster" onPress={onApply} tone="primary" style={styles.actionButton} />
        <Button label="Save" onPress={handleSave} tone="secondary" style={styles.actionButton} />
        <Button label="Report" onPress={handleReport} tone="danger" style={styles.actionButton} />
      </View>
      {notice ? (
        <Band tone="sky">
          <Text style={styles.bodyText}>{notice}</Text>
        </Band>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  actionButton: {
    flex: 1,
    minWidth: 110,
  },
  bodyText: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: '700',
    lineHeight: 23,
  },
  label: {
    color: colors.ink,
    fontSize: typography.caption,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  stack: {
    gap: spacing.md,
  },
});
