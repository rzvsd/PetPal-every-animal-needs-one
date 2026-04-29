import { StyleSheet, Text, View } from 'react-native';

import { Band, Button, Chip, SectionHeader } from '../../components/ui';
import { colors, spacing, typography } from '../../design/tokens';
import { FosterApplication, FosterCase } from '../../types/petpal';
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
  onRejectApplication,
  onRequestAccess,
  onSection,
  section,
}: {
  applications: FosterApplication[];
  fosterCases: FosterCase[];
  isRescuer: boolean;
  onAcceptApplication: (application: FosterApplication) => void;
  onActiveCases: () => void;
  onAddCase: () => void;
  onArchiveCase: (fosterCase: FosterCase) => void;
  onMarkFosterFound: (fosterCase: FosterCase) => void;
  onOpenCase: (fosterCase: FosterCase) => void;
  onOpenMessages: (application: FosterApplication) => void;
  onRejectApplication: (application: FosterApplication) => void;
  onRequestAccess: () => void;
  onSection: (section: FosterSection) => void;
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
        <Band tone="sky">
          <Text style={styles.ctaTitle}>Are you a rescuer or shelter?</Text>
          <Text style={styles.ctaText}>Request access to manage foster cases.</Text>
          <Button label="Request access to manage foster cases" onPress={onRequestAccess} tone="secondary" />
        </Band>
      ) : null}
    </View>
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
