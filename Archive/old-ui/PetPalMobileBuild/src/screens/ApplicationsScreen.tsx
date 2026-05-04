import { StyleSheet, Text, View } from 'react-native';

import { Band, Button, EmptyState, SectionHeader, StatusBadge } from '../components/ui';
import { MyApplicationSummary } from '../api/petpalApi';
import { colors, radii, spacing, typography } from '../design/tokens';
import { statusLabels } from '../utils/petpalFormat';

export function ApplicationsScreen({
  applications,
  onOpenChat,
}: {
  applications: MyApplicationSummary[];
  onOpenChat: (applicationId: string) => void;
}) {
  return (
    <View style={styles.screen}>
      <Band tone="surface">
        <SectionHeader
          eyebrow="Application ledger"
          title="My requests"
          detail="Every request has a status. Chat appears only after a rescue accepts the application."
        />
      </Band>

      <View style={styles.listStack}>
        {applications.length > 0 ? (
          applications.map((application) => (
            <ApplicationCard
              application={application}
              key={application.applicationId}
              onOpenChat={application.status === 'ACCEPTED' ? () => onOpenChat(application.applicationId) : undefined}
            />
          ))
        ) : (
          <EmptyState
            body="Start from a verified animal profile, complete the guided application, and the request will appear here."
            title="No submitted applications"
          />
        )}
      </View>
    </View>
  );
}

function ApplicationCard({
  application,
  onOpenChat,
}: {
  application: MyApplicationSummary;
  onOpenChat?: () => void;
}) {
  const accepted = application.status === 'ACCEPTED';

  return (
    <Band tone={accepted ? 'sage' : 'surface'}>
      <View style={styles.cardTopline}>
        <StatusBadge label={statusLabels[application.status]} tone={accepted ? 'sage' : 'sky'} />
        <Text style={styles.organization}>{application.organizationName}</Text>
      </View>
      <Text style={styles.animalName}>{application.animalName}</Text>
      <Text style={styles.cardTitle}>{application.title}</Text>
      <Text style={styles.cardBody}>
        {application.reviewNote || 'The rescue can review this request and open chat only if the fit looks realistic.'}
      </Text>
      {onOpenChat ? <Button label="Open protected chat" onPress={onOpenChat} tone="ink" /> : null}
    </Band>
  );
}

const styles = StyleSheet.create({
  screen: {
    gap: spacing.md,
  },
  listStack: {
    gap: spacing.md,
  },
  cardTopline: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  organization: {
    color: colors.inkMuted,
    flex: 1,
    fontSize: typography.caption,
    fontWeight: '900',
    textAlign: 'right',
  },
  animalName: {
    color: colors.ink,
    fontSize: typography.title,
    fontWeight: '900',
    lineHeight: 27,
  },
  cardTitle: {
    color: colors.ink,
    fontSize: typography.bodyLarge,
    fontWeight: '800',
    lineHeight: 24,
  },
  cardBody: {
    color: colors.inkMuted,
    fontSize: typography.body,
    lineHeight: 22,
  },
});
