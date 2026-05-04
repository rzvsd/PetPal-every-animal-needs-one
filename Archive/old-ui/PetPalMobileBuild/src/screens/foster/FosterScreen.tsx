import { StyleSheet, Text, View } from 'react-native';

import { Band, Button, Chip, SectionHeader } from '../../components/ui';
import { colors, spacing, typography } from '../../design/tokens';
import { FosterApplication, FosterCase, RescuerAccessState } from '../../types/petpal';
import { FosterFindSection } from './FosterFindSection';
import { FosterManageSection } from './FosterManageSection';
import { FosterRequestsSection } from './FosterRequestsSection';

export type FosterSection = 'find' | 'applications' | 'manage';

export function FosterScreen({
  applications,
  fosterCases,
  isRescuer,
  onAcceptApplication,
  onActiveCases,
  onAddCase,
  onArchiveCase,
  onMarkFosterFound,
  onOpenCase,
  onOpenMessages,
  onOpenDemoPreview,
  onRejectApplication,
  onRequestAccess,
  onSection,
  section,
  rescuerAccessState,
  isDemoRescuerPreview,
}: {
  applications: FosterApplication[];
  fosterCases: FosterCase[];
  isRescuer: boolean;
  isDemoRescuerPreview: boolean;
  onAcceptApplication: (application: FosterApplication) => void;
  onActiveCases: () => void;
  onAddCase: () => void;
  onArchiveCase: (fosterCase: FosterCase) => void;
  onMarkFosterFound: (fosterCase: FosterCase) => void;
  onOpenCase: (fosterCase: FosterCase) => void;
  onOpenDemoPreview: () => void;
  onOpenMessages: (application: FosterApplication) => void;
  onRejectApplication: (application: FosterApplication) => void;
  onRequestAccess: () => void;
  onSection: (section: FosterSection) => void;
  rescuerAccessState: RescuerAccessState;
  section: FosterSection;
}) {
  const activeSection = !isRescuer && section === 'manage' ? 'find' : section;

  return (
    <View style={styles.stack}>
      <SectionHeader
        title="Foster"
        detail={
          isRescuer
            ? 'Manage cases that need temporary homes.'
            : 'Temporarily help an animal until they find a home. See duration, urgency, and what support is covered.'
        }
      />
      {isDemoRescuerPreview ? (
        <Band tone="clay">
          <Text style={styles.ctaTitle}>Demo preview</Text>
          <Text style={styles.ctaText}>Rescuer tools are shown for product testing only.</Text>
        </Band>
      ) : null}
      <View style={styles.wrapRow}>
        {isRescuer ? (
          <>
            <Chip label="Find" onPress={() => onSection('find')} selected={activeSection === 'find'} />
            <Chip
              label="Received Requests"
              onPress={() => onSection('applications')}
              selected={activeSection === 'applications'}
            />
            <Chip label="Manage" onPress={() => onSection('manage')} selected={activeSection === 'manage'} />
          </>
        ) : (
          <>
            <Chip label="Find Foster" onPress={() => onSection('find')} selected={activeSection === 'find'} />
            <Chip label="My Requests" onPress={() => onSection('applications')} selected={activeSection === 'applications'} />
          </>
        )}
      </View>

      {activeSection === 'find' ? <FosterFindSection fosterCases={fosterCases} onOpenCase={onOpenCase} /> : null}
      {activeSection === 'applications' ? (
        <FosterRequestsSection
          applications={applications}
          fosterCases={fosterCases}
          isRescuer={isRescuer}
          onAcceptApplication={onAcceptApplication}
          onOpenCase={onOpenCase}
          onOpenMessages={onOpenMessages}
          onRejectApplication={onRejectApplication}
        />
      ) : null}
      {isRescuer && activeSection === 'manage' ? (
        <FosterManageSection
          applications={applications}
          fosterCases={fosterCases}
          onAcceptApplication={onAcceptApplication}
          onActiveCases={onActiveCases}
          onAddCase={onAddCase}
          onArchiveCase={onArchiveCase}
          onMarkFosterFound={onMarkFosterFound}
          onRejectApplication={onRejectApplication}
          onReviewRequests={() => onSection('applications')}
        />
      ) : null}

      {!isRescuer ? (
        <RescuerAccessCard
          onOpenDemoPreview={onOpenDemoPreview}
          onRequestAccess={onRequestAccess}
          rescuerAccessState={rescuerAccessState}
        />
      ) : null}
    </View>
  );
}

function RescuerAccessCard({
  onOpenDemoPreview,
  onRequestAccess,
  rescuerAccessState,
}: {
  onOpenDemoPreview: () => void;
  onRequestAccess: () => void;
  rescuerAccessState: RescuerAccessState;
}) {
  if (rescuerAccessState === 'request_sent') {
    return (
      <Band tone="sky">
        <Text style={styles.ctaTitle}>Request sent</Text>
        <Text style={styles.ctaText}>
          Your request was received. In the real app, PetPal reviews rescuer or shelter access before management tools are enabled.
        </Text>
        <Button label="View rescuer demo preview" onPress={onOpenDemoPreview} tone="secondary" />
      </Band>
    );
  }

  return (
    <Band tone="sky">
      <Text style={styles.ctaTitle}>Are you a rescuer or shelter?</Text>
      <Text style={styles.ctaText}>Request access to manage foster cases.</Text>
      <Button label="Request access to manage foster cases" onPress={onRequestAccess} tone="secondary" />
    </Band>
  );
}

const styles = StyleSheet.create({
  ctaText: {
    color: colors.inkMuted,
    fontSize: typography.body,
    fontWeight: '600',
    lineHeight: 23,
  },
  ctaTitle: {
    color: colors.ink,
    fontSize: typography.bodyLarge,
    fontWeight: '900',
    lineHeight: 24,
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
