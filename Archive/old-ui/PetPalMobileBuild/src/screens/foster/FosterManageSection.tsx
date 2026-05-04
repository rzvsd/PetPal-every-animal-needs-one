import { StyleSheet, Text, View } from 'react-native';

import { Band, Button, EmptyState, Metric, StatusBadge } from '../../components/ui';
import { colors, spacing, typography } from '../../design/tokens';
import { FosterApplication, FosterCase } from '../../types/petpal';
import { durationLabel, formatLocation, urgencyLabel } from './FosterCaseCard';

export function FosterManageSection({
  applications,
  fosterCases,
  onAcceptApplication,
  onActiveCases,
  onAddCase,
  onArchiveCase,
  onMarkFosterFound,
  onRejectApplication,
  onReviewRequests,
}: {
  applications: FosterApplication[];
  fosterCases: FosterCase[];
  onAcceptApplication: (application: FosterApplication) => void;
  onActiveCases: () => void;
  onAddCase: () => void;
  onArchiveCase: (fosterCase: FosterCase) => void;
  onMarkFosterFound: (fosterCase: FosterCase) => void;
  onRejectApplication: (application: FosterApplication) => void;
  onReviewRequests: () => void;
}) {
  const activeCases = fosterCases.filter((item) => item.status === 'ACTIVE');
  const newRequests = applications.filter((item) => item.status === 'SUBMITTED' || item.status === 'IN_REVIEW');
  const urgentCases = activeCases.filter((item) => item.urgency === 'HIGH');
  const casesWithNoRequests = activeCases.filter(
    (fosterCase) => !applications.some((application) => application.fosterCaseId === fosterCase.id),
  );
  const foundCases = fosterCases.filter((item) => item.status === 'FOSTER_FOUND');
  const archivedCases = fosterCases.filter((item) => item.status === 'ARCHIVED');

  return (
    <View style={styles.stack}>
      <Band tone="forest">
        <Text style={styles.darkTitle}>Manage Foster</Text>
        <View style={styles.metrics}>
          <Metric value={String(activeCases.length)} label="Active cases" tone="forest" />
          <Metric value={String(newRequests.length)} label="New requests" tone="forest" />
          <Metric value={String(urgentCases.length)} label="Urgent cases" tone="forest" />
          <Metric value={String(casesWithNoRequests.length)} label="Cases with no requests" tone="forest" />
        </View>
        <View style={styles.actions}>
          <Button label="Add foster case" onPress={onAddCase} tone="secondary" style={styles.actionButton} />
          <Button label="Review requests" onPress={onReviewRequests} tone="secondary" style={styles.actionButton} />
          <Button label="Active cases" onPress={onActiveCases} tone="quiet" style={styles.actionButton} />
        </View>
      </Band>

      <ManageGroup title="New requests">
        {newRequests.length ? (
          newRequests.map((application) => (
            <Band key={application.id}>
              <Text style={styles.cardName}>New request</Text>
              <Text style={styles.bodyText}>Experience: {application.experience}</Text>
              <Text style={styles.bodyText}>Availability: {application.availability}</Text>
              <View style={styles.actions}>
                <Button
                  label="Accept"
                  onPress={() => onAcceptApplication(application)}
                  tone="primary"
                  style={styles.actionButton}
                />
                <Button
                  label="Reject"
                  onPress={() => onRejectApplication(application)}
                  tone="danger"
                  style={styles.actionButton}
                />
              </View>
            </Band>
          ))
        ) : (
          <EmptyState body="New foster requests will appear here." title="No new requests" />
        )}
      </ManageGroup>

      <ManageGroup title="Urgent cases">
        {urgentCases.map((fosterCase) => (
          <CaseOpsCard
            fosterCase={fosterCase}
            key={fosterCase.id}
            onArchiveCase={onArchiveCase}
            onMarkFosterFound={onMarkFosterFound}
          />
        ))}
      </ManageGroup>

      <ManageGroup title="Active cases">
        {activeCases.map((fosterCase) => (
          <CaseOpsCard
            fosterCase={fosterCase}
            key={fosterCase.id}
            onArchiveCase={onArchiveCase}
            onMarkFosterFound={onMarkFosterFound}
          />
        ))}
      </ManageGroup>

      <ManageGroup title="Foster found">
        {foundCases.length ? (
          foundCases.map((fosterCase) => <StatusCase fosterCase={fosterCase} key={fosterCase.id} />)
        ) : (
          <Text style={styles.muted}>No cases marked foster found yet.</Text>
        )}
      </ManageGroup>

      <ManageGroup title="Archived">
        {archivedCases.length ? (
          archivedCases.map((fosterCase) => <StatusCase fosterCase={fosterCase} key={fosterCase.id} />)
        ) : (
          <Text style={styles.muted}>No archived cases yet.</Text>
        )}
      </ManageGroup>
    </View>
  );
}

function ManageGroup({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <View style={styles.stack}>
      <Text style={styles.title}>{title}</Text>
      {children}
    </View>
  );
}

function CaseOpsCard({
  fosterCase,
  onArchiveCase,
  onMarkFosterFound,
}: {
  fosterCase: FosterCase;
  onArchiveCase: (fosterCase: FosterCase) => void;
  onMarkFosterFound: (fosterCase: FosterCase) => void;
}) {
  return (
    <Band>
      <View style={styles.rowBetween}>
        <View style={styles.flex}>
          <Text style={styles.cardName}>{fosterCase.animalName}</Text>
          <Text style={styles.meta}>
            {urgencyLabel(fosterCase.urgency)} / {durationLabel(fosterCase.duration)}
          </Text>
        </View>
        <StatusBadge label={caseStatusLabel(fosterCase.status)} tone="sky" />
      </View>
      <Text style={styles.muted}>{formatLocation(fosterCase)}</Text>
      <View style={styles.actions}>
        <Button
          label="Mark foster found"
          onPress={() => onMarkFosterFound(fosterCase)}
          tone="primary"
          style={styles.actionButton}
        />
        <Button label="Archive case" onPress={() => onArchiveCase(fosterCase)} tone="quiet" style={styles.actionButton} />
      </View>
    </Band>
  );
}

function StatusCase({ fosterCase }: { fosterCase: FosterCase }) {
  return (
    <Band>
      <Text style={styles.cardName}>{fosterCase.animalName}</Text>
      <Text style={styles.muted}>{formatLocation(fosterCase)}</Text>
    </Band>
  );
}

function caseStatusLabel(status: FosterCase['status']) {
  const labels: Record<FosterCase['status'], string> = {
    DRAFT: 'Draft',
    PENDING_REVIEW: 'Pending review',
    ACTIVE: 'Active',
    PAUSED: 'Paused',
    FOSTER_FOUND: 'Foster found',
    ADOPTED: 'Adopted',
    ARCHIVED: 'Archived',
  };
  return labels[status];
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  actionButton: {
    flex: 1,
    minWidth: 118,
  },
  bodyText: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: '700',
    lineHeight: 23,
  },
  cardName: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 26,
  },
  darkTitle: {
    color: colors.cream,
    fontSize: typography.title,
    fontWeight: '900',
    lineHeight: 27,
  },
  flex: {
    flex: 1,
  },
  meta: {
    color: colors.inkMuted,
    fontSize: typography.body,
    fontWeight: '800',
    lineHeight: 22,
  },
  metrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
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
