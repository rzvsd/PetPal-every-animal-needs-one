import { ImageBackground, ImageSourcePropType, StyleSheet, Text, View } from 'react-native';

import { Chip, EmptyState, ListingCard, SectionHeader } from '../components/ui';
import { colors, radii, spacing, typography } from '../design/tokens';
import { DataSource } from '../hooks/useDiscovery';
import { DiscoveryListing, ListingMode, Species } from '../types/petpal';
import { modeLabels } from '../utils/petpalFormat';

declare const require: (path: string) => ImageSourcePropType;

const heroImage = require('../../assets/petpal/rescue-editorial-hero.png');

export function DiscoverScreen({
  dataSource,
  filteredListings,
  isLoadingListings,
  loadMessage,
  modeFilter,
  onRefresh,
  onSelectListing,
  onSetModeFilter,
  onSetSpeciesFilter,
  speciesFilter,
}: {
  dataSource: DataSource;
  filteredListings: DiscoveryListing[];
  isLoadingListings: boolean;
  loadMessage: string;
  modeFilter: ListingMode | 'ALL';
  onRefresh: () => void;
  onSelectListing: (listingId: string) => void;
  onSetModeFilter: (mode: ListingMode | 'ALL') => void;
  onSetSpeciesFilter: (species: Species | 'ALL') => void;
  speciesFilter: Species | 'ALL';
}) {
  const fosterCount = filteredListings.filter((listing) => listing.mode === 'FOSTER').length;

  return (
    <View style={styles.screen}>
      <ImageBackground imageStyle={styles.heroImage} source={heroImage} style={styles.hero}>
        <View style={styles.heroWash} />
        <View style={styles.heroCopyBlock}>
          <Text style={styles.heroTitle}>Find a dog or cat with a verified rescue behind them.</Text>
        </View>
      </ImageBackground>

      <View style={styles.metricsPanel}>
        <MetricCell icon="✓" label="Approved" value={String(filteredListings.length)} tone="green" />
        <View style={styles.metricDivider} />
        <MetricCell icon="♡" label="Foster need" value={String(fosterCount)} tone="clay" />
        <View style={styles.metricDivider} />
        <MetricCell icon="♢" label="Sales" value="0" tone="blue" />
      </View>

      <View style={styles.filtersSection}>
        <SectionHeader
          title="Choose your lane"
        />
        <View style={styles.chipRow}>
          {(['ALL', 'ADOPT', 'FOSTER'] as const).map((mode) => (
            <Chip
              key={mode}
              label={mode === 'ALL' ? 'All' : modeLabels[mode]}
              onPress={() => onSetModeFilter(mode)}
              selected={modeFilter === mode}
            />
          ))}
          {(['ALL', 'DOG', 'CAT'] as const).map((species) => (
            <Chip
              key={species}
              label={species === 'ALL' ? 'Dogs + cats' : titleCase(species)}
              onPress={() => onSetSpeciesFilter(species)}
              selected={speciesFilter === species}
            />
          ))}
        </View>
      </View>

      <View style={styles.listSection}>
        <View style={styles.listHeadingRow}>
          <Text style={styles.listTitle}>Verified animals</Text>
          <Text style={styles.viewAll}>View all ›</Text>
        </View>
        <View style={styles.listStack}>
          {filteredListings.length > 0 ? (
            filteredListings.map((listing) => (
              <ListingCard
                key={listing.listingId}
                listing={listing}
                onPress={() => onSelectListing(listing.listingId)}
              />
            ))
          ) : (
            <EmptyState
              action="Reset filters"
              body="Show all dogs and cats across adoption and foster to widen the search."
              onAction={() => {
                onSetModeFilter('ALL');
                onSetSpeciesFilter('ALL');
              }}
              title="No animals match this filter"
            />
          )}
          {isLoadingListings ? <Text style={styles.loadMessage}>{loadMessage}</Text> : null}
        </View>
      </View>
    </View>
  );
}

function titleCase(value: string) {
  return value.slice(0, 1).toUpperCase() + value.slice(1).toLowerCase();
}

function MetricCell({
  icon,
  label,
  tone,
  value,
}: {
  icon: string;
  label: string;
  tone: 'green' | 'clay' | 'blue';
  value: string;
}) {
  return (
    <View style={styles.metricCell}>
      <Text style={[styles.metricIcon, metricToneStyles[tone]]}>{icon}</Text>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

const metricToneStyles = StyleSheet.create({
  green: {
    color: colors.sage,
  },
  clay: {
    color: colors.clay,
  },
  blue: {
    color: colors.skyDeep,
  },
});

const styles = StyleSheet.create({
  screen: {
    gap: spacing.md,
  },
  hero: {
    aspectRatio: 2.15,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.md,
    justifyContent: 'center',
    overflow: 'hidden',
    padding: spacing.lg,
    shadowColor: colors.ink,
    shadowOffset: { height: 2, width: 0 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 1,
  },
  heroImage: {
    borderRadius: radii.md,
  },
  heroWash: {
    backgroundColor: 'rgba(255, 248, 236, 0.42)',
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: '44%',
    top: 0,
  },
  heroCopyBlock: {
    maxWidth: '55%',
  },
  heroTitle: {
    color: colors.forest,
    fontFamily: 'serif',
    fontSize: 23,
    fontWeight: '900',
    lineHeight: 28,
  },
  metricsPanel: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 68,
    paddingVertical: spacing.xs,
  },
  metricCell: {
    alignItems: 'center',
    flex: 1,
    gap: 2,
  },
  metricDivider: {
    backgroundColor: colors.border,
    height: 48,
    width: 1,
  },
  metricIcon: {
    fontSize: 20,
    fontWeight: '900',
    lineHeight: 26,
  },
  metricValue: {
    color: colors.forest,
    fontFamily: 'serif',
    fontSize: 20,
    fontWeight: '900',
    lineHeight: 22,
  },
  metricLabel: {
    color: colors.ink,
    fontSize: typography.caption,
    fontWeight: '600',
  },
  filtersSection: {
    gap: spacing.xs,
  },
  filterLabel: {
    color: colors.inkSoft,
    fontSize: typography.caption,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  statusRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  statusTextBlock: {
    flex: 1,
    gap: spacing.xxs,
  },
  statusKicker: {
    color: colors.clay,
    fontSize: typography.caption,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  statusText: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: '700',
    lineHeight: 21,
  },
  listSection: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    gap: spacing.md,
    paddingTop: spacing.md,
  },
  listHeadingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  listTitle: {
    color: colors.forest,
    fontSize: typography.title,
    fontWeight: '900',
  },
  viewAll: {
    color: colors.sage,
    fontSize: typography.body,
    fontWeight: '900',
  },
  loadMessage: {
    color: colors.inkMuted,
    fontSize: typography.caption,
    fontWeight: '700',
  },
  listStack: {
    gap: spacing.md,
  },
});
