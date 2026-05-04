import { StyleSheet, Text, View } from 'react-native';

import { Band, Button, EmptyState, StatusBadge } from '../../components/ui';
import { colors, spacing, typography } from '../../design/tokens';
import { FosterApplication, FosterApplicationStatus, FosterCase } from '../../types/petpal';

export function FosterRequestsSection({
  applications,
  fosterCases,
  isRescuer,
  onAcceptApplication,
  onOpenCase,
  onOpenMessages,
  onRejectApplication,
}: {
  applications: FosterApplication[];
  fosterCases: FosterCase[];
  isRescuer: boolean;
  onAcceptApplication: (application: FosterApplication) => void;
  onOpenCase: (fosterCase: FosterCase) => void;
  onOpenMessages: (application: FosterApplication) => void;
  onRejectApplication: (application: FosterApplication) => void;
}) {
  if (!applications.length) {
    return (
      <EmptyState
        body={
          isRescuer
            ? 'Incoming foster requests will appear here.'
            : 'Requests you send to rescuers will appear here.'
        }
        title={isRescuer ? 'No received requests yet' : 'No foster requests yet'}
      />
    );
  }

  return (
    <View style={styles.stack}>
      <Text style={styles.title}>{isRescuer ? 'Received Requests' : 'My Requests'}</Text>
      {applications.map((application) => {
        const fosterCase = fosterCases.find((item) => item.id === application.fosterCaseId);
        const accepted = application.status === 'ACCEPTED';

        return (
          <Band key={application.id}>
            <View style={styles.rowBetween}>
              <View style={styles.flex}>
                <Text style={styles.cardName}>{fosterCase?.animalName ?? 'Foster case'}</Text>
                <Text style={styles.meta}>
                  {applicationStatusLabel(application.status)} / {fosterCase?.rescuerName ?? 'Rescuer'}
                </Text>
              </View>
              <StatusBadge label={applicationStatusLabel(application.status)} tone={accepted ? 'sage' : 'sky'} />
            </View>
            {isRescuer ? (
              <>
                <Text style={styles.bodyText}>Experience: {application.experience}</Text>
                <Text style={styles.bodyText}>Availability: {application.availability}</Text>
                <Text style={styles.muted}>Transport: {booleanLabel(application.canTransport)}</Text>
                <Text style={styles.muted}>Medical needs: {booleanLabel(application.canHandleMedicalNeeds)}</Text>
              </>
            ) : (
              <Text style={styles.muted}>
                {accepted ? 'Chat is open.' : 'Next step: wait for rescuer review.'}
              </Text>
            )}
            <View style={styles.actions}>
              {fosterCase ? (
                <Button
                  label={isRescuer ? 'View case' : 'View request'}
                  onPress={() => onOpenCase(fosterCase)}
                  tone="secondary"
                  style={styles.actionButton}
                />
              ) : null}
              {!isRescuer && accepted ? (
                <Button
                  label="Open messages"
                  onPress={() => onOpenMessages(application)}
                  tone="primary"
                  style={styles.actionButton}
                />
              ) : null}
              {isRescuer && application.status !== 'ACCEPTED' && application.status !== 'REJECTED' ? (
                <>
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
                </>
              ) : null}
            </View>
          </Band>
        );
      })}
    </View>
  );
}

export function applicationStatusLabel(status: FosterApplicationStatus) {
  const labels: Record<FosterApplicationStatus, string> = {
    DRAFT: 'Draft',
    SUBMITTED: 'Sent',
    IN_REVIEW: 'In review',
    ACCEPTED: 'Accepted',
    REJECTED: 'Rejected',
    WITHDRAWN: 'Withdrawn',
    COMPLETED: 'Completed',
  };
  return labels[status];
}

function booleanLabel(value: boolean | null) {
  if (value === null) return 'Not answered';
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
    minWidth: 106,
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
  flex: {
    flex: 1,
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
