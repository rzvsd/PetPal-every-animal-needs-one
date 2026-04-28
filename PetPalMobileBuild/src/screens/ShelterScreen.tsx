import { StyleSheet, Text, View } from 'react-native';

import { Band, Button, Chip, Metric, SectionHeader, StatusBadge, formatLocation } from '../components/ui';
import { MyApplicationSummary } from '../api/petpalApi';
import { colors, spacing, typography } from '../design/tokens';
import { ApplicationStatus, DiscoveryListing } from '../types/petpal';
import { modeLabels, statusLabels } from '../utils/petpalFormat';

export function ShelterScreen({
  applications,
  latestApplication,
  listings,
  onAccept,
  onSetReviewStatus,
  reviewStatus,
  selectedListing,
}: {
  applications: MyApplicationSummary[];
  latestApplication: MyApplicationSummary | null;
  listings: DiscoveryListing[];
  onAccept: () => void;
  onSetReviewStatus: (status: ApplicationStatus) => void;
  reviewStatus: ApplicationStatus;
  selectedListing: DiscoveryListing;
}) {
  const pendingApplications = applications.filter((application) => application.status !== 'ACCEPTED').length;
  const fosterListings = listings.filter((listing) => listing.mode === 'FOSTER').length;

  return (
    <View style={styles.screen}>
      <Band tone="surface">
        <SectionHeader
          eyebrow="Rescue operations"
          title="Shelter command"
          detail="Review applicants, keep listings fresh, and open chat only when a handoff is ready."
        />
        <View style={styles.metricsRow}>
          <Metric label="active listings" value={String(listings.length)} tone="forest" />
          <Metric label="pending apps" value={String(pendingApplications)} tone="forest" />
          <Metric label="foster needs" value={String(fosterListings)} tone="forest" />
        </View>
      </Band>

      <Band tone="sage">
        <SectionHeader
          eyebrow="Latest applicant"
          title={latestApplication ? `${latestApplication.animalName} request` : `${selectedListing.animalName} preview`}
          detail="Use status internally, then accept only when the conversation should open."
        />
        <StatusBadge label={statusLabels[latestApplication?.status ?? reviewStatus]} tone="sky" />
        <Text style={styles.reviewMeta}>{latestApplication?.organizationName ?? selectedListing.organizationName}</Text>
        <View style={styles.chipRow}>
          {(['IN_REVIEW', 'ACCEPTED', 'REJECTED'] as const).map((status) => (
            <Chip
              key={status}
              label={statusLabels[status]}
              onPress={() => onSetReviewStatus(status)}
              selected={reviewStatus === status}
            />
          ))}
        </View>
        <Button label="Accept latest and open chat" onPress={onAccept} />
      </Band>

      <View style={styles.listSection}>
        <SectionHeader
          eyebrow="Listing health"
          title="Fresh public profiles"
          detail="The pilot should feel current. Old or unclear animal posts destroy trust quickly."
        />
        <View style={styles.listStack}>
          {listings.map((listing) => (
            <Band key={listing.listingId} tone={listing.mode === 'FOSTER' ? 'clay' : 'sage'}>
              <View style={styles.listingRow}>
                <View style={styles.listingCopy}>
                  <Text style={styles.listingName}>{listing.animalName}</Text>
                  <Text style={styles.listingMeta}>
                    {modeLabels[listing.mode]} / {formatLocation(listing)}
                  </Text>
                </View>
                <StatusBadge label="Active" tone="sage" />
              </View>
            </Band>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    gap: spacing.md,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  reviewMeta: {
    color: colors.inkMuted,
    fontSize: typography.body,
    fontWeight: '700',
    lineHeight: 22,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  listSection: {
    gap: spacing.md,
  },
  listStack: {
    gap: spacing.md,
  },
  listingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  listingCopy: {
    flex: 1,
    gap: spacing.xxs,
  },
  listingName: {
    color: colors.ink,
    fontSize: typography.title,
    fontWeight: '900',
  },
  listingMeta: {
    color: colors.inkMuted,
    fontSize: typography.small,
    fontWeight: '800',
    lineHeight: 19,
  },
});
