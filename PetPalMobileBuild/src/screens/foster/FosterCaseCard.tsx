import { StyleSheet, Text, View } from 'react-native';

import { Band, Button, StatusBadge } from '../../components/ui';
import { colors, spacing, typography } from '../../design/tokens';
import { FosterCase } from '../../types/petpal';

export function FosterCaseCard({
  fosterCase,
  onSave,
  onView,
}: {
  fosterCase: FosterCase;
  onSave?: () => void;
  onView: () => void;
}) {
  return (
    <Band>
      <View style={styles.rowBetween}>
        <View style={styles.flex}>
          <Text style={styles.cardName}>{fosterCase.animalName}</Text>
          <Text style={styles.meta}>
            {speciesLabel(fosterCase.species)} / {ageLabel(fosterCase.ageMonths)} / {sizeLabel(fosterCase.sizeLabel)}
          </Text>
        </View>
        <StatusBadge label={urgencyLabel(fosterCase.urgency)} tone={fosterCase.urgency === 'HIGH' ? 'clay' : 'sky'} />
      </View>
      <Text style={styles.bodyText}>
        {fosterCase.urgency === 'HIGH' ? 'Urgent foster' : 'Foster need'} / {durationLabel(fosterCase.duration)}
      </Text>
      <Text style={styles.muted}>{formatLocation(fosterCase)}</Text>
      <Text style={styles.check}>
        {fosterCase.rescuerVerified ? `${fosterCase.rescuerName} verified` : `${fosterCase.rescuerName} not verified`}
      </Text>
      <View style={styles.coverage}>
        <Text style={styles.label}>Covered</Text>
        <Text style={styles.bodyText}>{coverageText(fosterCase)}</Text>
      </View>
      <Text style={styles.muted}>{fosterCase.homeFit}</Text>
      <View style={styles.actions}>
        <Button label="View case" onPress={onView} tone="primary" style={styles.actionButton} />
        {onSave ? <Button label="Save" onPress={onSave} tone="quiet" style={styles.actionButton} /> : null}
      </View>
    </Band>
  );
}

export function speciesLabel(species: FosterCase['species']) {
  return species === 'DOG' ? 'Dog' : 'Cat';
}

export function sizeLabel(size: FosterCase['sizeLabel']) {
  if (size === 'SMALL') return 'Small size';
  if (size === 'MEDIUM') return 'Medium size';
  if (size === 'LARGE') return 'Large size';
  return 'Unknown size';
}

export function ageLabel(months: number | null) {
  if (!months) return 'unknown age';
  if (months < 12) return `${months} months`;
  const years = Math.floor(months / 12);
  return years === 1 ? '1 year' : `${years} years`;
}

export function durationLabel(duration: FosterCase['duration']) {
  const labels: Record<FosterCase['duration'], string> = {
    FEW_DAYS: 'Few days',
    ONE_TWO_WEEKS: '1-2 weeks',
    ONE_MONTH: '1 month',
    UNTIL_ADOPTION: 'Until adoption',
    UNKNOWN: 'Unknown yet',
  };
  return labels[duration];
}

export function urgencyLabel(urgency: FosterCase['urgency']) {
  if (urgency === 'HIGH') return 'Urgent';
  if (urgency === 'MEDIUM') return 'This week';
  return 'Low urgency';
}

export function formatLocation(fosterCase: FosterCase) {
  return `${fosterCase.city}${fosterCase.coarseArea ? ` / ${fosterCase.coarseArea}` : ''}`;
}

export function coverageText(fosterCase: FosterCase) {
  return [
    fosterCase.foodCovered ? 'Food covered' : 'Food not covered',
    fosterCase.vetCovered ? 'Vet care covered' : 'Vet care not covered',
    fosterCase.transportAvailable ? 'Transport available' : 'Transport not available',
  ].join(' / ');
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
  cardName: {
    color: colors.ink,
    fontSize: 24,
    fontWeight: '900',
    lineHeight: 28,
  },
  check: {
    color: colors.forest,
    fontSize: typography.small,
    fontWeight: '900',
    lineHeight: 20,
  },
  coverage: {
    gap: spacing.xxs,
  },
  flex: {
    flex: 1,
  },
  label: {
    color: colors.inkSoft,
    fontSize: typography.caption,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  meta: {
    color: colors.inkMuted,
    fontSize: typography.body,
    fontWeight: '800',
    lineHeight: 22,
  },
  muted: {
    color: colors.inkMuted,
    fontSize: typography.body,
    fontWeight: '600',
    lineHeight: 23,
  },
  rowBetween: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
});
