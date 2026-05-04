import type { ReactNode } from 'react';
import { Image, ImageSourcePropType, Pressable, StyleSheet, Text, View } from 'react-native';
import { useMemo, useState } from 'react';

import { Band, Button, Chip, EmptyState, InfoRow, SectionHeader, StatusBadge } from '../../components/ui';
import { colors, radii, spacing, typography } from '../../design/tokens';
import { AnimalProfile, MatchCandidate, MatchMode, Species } from '../../types/petpal';

declare const require: (path: string) => ImageSourcePropType;

const dogPlaceholder = require('../../../assets/petpal/dog-portrait.png');
const catPlaceholder = require('../../../assets/petpal/cat-portrait.png');

type FilterState = {
  breed: 'ALL' | 'Labrador' | 'Golden Retriever' | 'Metis';
  mixedBreedAccepted: boolean;
  sex: 'ALL' | 'MALE' | 'FEMALE';
  ageRange: 'ALL' | 'YOUNG' | 'ADULT' | 'SENIOR';
  size: 'ALL' | 'SMALL' | 'MEDIUM' | 'LARGE';
  area: 'ALL' | 'Bucharest' | 'Ilfov';
  vaccinesConfirmed: boolean;
  healthDocuments: boolean;
  energyLevel: 'ALL' | 'LOW' | 'MEDIUM' | 'HIGH';
  temperament: 'ALL' | 'calm' | 'social' | 'playful';
};

const defaultFilters: FilterState = {
  breed: 'ALL',
  mixedBreedAccepted: true,
  sex: 'ALL',
  ageRange: 'ALL',
  size: 'ALL',
  area: 'ALL',
  vaccinesConfirmed: false,
  healthDocuments: false,
  energyLevel: 'ALL',
  temperament: 'ALL',
};

export function MatchesScreen({
  animals,
  selectedAnimal,
  candidates,
  candidateIndex,
  matchMode,
  speciesFilter,
  verifiedOnly,
  canUseVerifiedMate,
  eligibility,
  likeNotice,
  onAddAnimal,
  onSelectAnimal,
  onSetMatchMode,
  onSetSpeciesFilter,
  onSetVerifiedOnly,
  onSeeVerifiedMateRequirements,
  onOpenDetail,
  onAction,
}: {
  animals: AnimalProfile[];
  selectedAnimal: AnimalProfile | null;
  candidates: MatchCandidate[];
  candidateIndex: number;
  matchMode: MatchMode;
  speciesFilter: Species | 'ALL';
  verifiedOnly: boolean;
  canUseVerifiedMate: boolean;
  eligibility: { label: string; done: boolean }[];
  likeNotice: string | null;
  onAddAnimal: () => void;
  onSelectAnimal: (id: string) => void;
  onSetMatchMode: (mode: MatchMode) => void;
  onSetSpeciesFilter: (species: Species | 'ALL') => void;
  onSetVerifiedOnly: (value: boolean) => void;
  onSeeVerifiedMateRequirements: () => void;
  onOpenDetail: (candidate: MatchCandidate) => void;
  onAction: (candidate: MatchCandidate, action: 'like' | 'pass' | 'save') => void;
}) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<FilterState>(defaultFilters);

  const visibleCandidates = useMemo(
    () =>
      candidates.filter((candidate) => {
        const animal = candidate.animal;
        const modeMatches = candidate.mode === matchMode;
        const speciesMatches = speciesFilter === 'ALL' || animal.species === speciesFilter;
        const verifiedMatches = !verifiedOnly || candidate.ownerVerificationStatus === 'VERIFIED';
        const breedMatches =
          filters.breed === 'ALL' ||
          animal.breed === filters.breed ||
          (filters.breed === 'Metis' && animal.isMixedBreed && filters.mixedBreedAccepted);
        const mixedBreedMatches = filters.mixedBreedAccepted || !animal.isMixedBreed;
        const sexMatches = filters.sex === 'ALL' || animal.sex === filters.sex;
        const ageMatches = matchesAgeRange(animal.ageMonths, filters.ageRange);
        const sizeMatches = filters.size === 'ALL' || animal.sizeLabel === filters.size;
        const areaMatches = filters.area === 'ALL' || animal.city === filters.area;
        const vaccineMatches = !filters.vaccinesConfirmed || animal.vaccineStatus === 'UP_TO_DATE';
        const healthMatches = !filters.healthDocuments || candidate.healthDocumentStatus === 'VERIFIED';
        const energyMatches = filters.energyLevel === 'ALL' || animal.energyLevel === filters.energyLevel;
        const temperamentMatches =
          filters.temperament === 'ALL' || animal.temperamentTags.includes(filters.temperament);
        const verifiedMateGate =
          matchMode !== 'VERIFIED_MATE' ||
          (canUseVerifiedMate &&
            candidate.ownerVerificationStatus === 'VERIFIED' &&
            candidate.healthDocumentStatus === 'VERIFIED' &&
            animal.profileCompleteness >= 85);

        return (
          modeMatches &&
          speciesMatches &&
          verifiedMatches &&
          breedMatches &&
          mixedBreedMatches &&
          sexMatches &&
          ageMatches &&
          sizeMatches &&
          areaMatches &&
          vaccineMatches &&
          healthMatches &&
          energyMatches &&
          temperamentMatches &&
          verifiedMateGate
        );
      }),
    [canUseVerifiedMate, candidates, filters, matchMode, speciesFilter, verifiedOnly],
  );

  const activeCandidate = visibleCandidates[candidateIndex % Math.max(visibleCandidates.length, 1)] ?? null;

  if (!selectedAnimal) {
    return (
      <EmptyState
        action="Create animal profile"
        body="For good matches, PetPal needs species, breed, age, sex, photos, temperament, and match goal."
        onAction={onAddAnimal}
        title="Create your animal profile"
      />
    );
  }

  const verifiedMateLocked = matchMode === 'VERIFIED_MATE' && !canUseVerifiedMate;

  return (
    <View style={styles.stack}>
      <View style={styles.header}>
        <Text style={styles.title}>Matches</Text>
        <Text style={styles.subtitle}>Find compatible animals for {selectedAnimal.name}.</Text>
        <Text style={styles.privacy}>Exact location stays private.</Text>
      </View>

      <Band tone="sage">
        <Text style={styles.label}>My animal</Text>
        <View style={styles.wrapRow}>
          {animals.map((animal) => (
            <Chip
              key={animal.id}
              label={animal.name}
              onPress={() => onSelectAnimal(animal.id)}
              selected={animal.id === selectedAnimal.id}
            />
          ))}
          <Chip label="+ Animal" onPress={onAddAnimal} />
        </View>
      </Band>

      <Band>
        <Text style={styles.label}>What are you looking for, {selectedAnimal.name}?</Text>
        <View style={styles.wrapRow}>
          <Chip label="Play" onPress={() => onSetMatchMode('PLAY')} selected={matchMode === 'PLAY'} />
          <Chip label="Social" onPress={() => onSetMatchMode('SOCIAL')} selected={matchMode === 'SOCIAL'} />
          <Chip
            label="Verified Mate"
            onPress={() => onSetMatchMode('VERIFIED_MATE')}
            selected={matchMode === 'VERIFIED_MATE'}
          />
        </View>
      </Band>

      <Band>
        <View style={styles.rowBetween}>
          <Text style={styles.label}>Filters</Text>
          <Pressable onPress={() => setFiltersOpen((open) => !open)}>
            <Text style={styles.sheetToggle}>{filtersOpen ? 'Close' : 'Open'}</Text>
          </Pressable>
        </View>
        <View style={styles.wrapRow}>
          <Chip label="Dogs" onPress={() => onSetSpeciesFilter('DOG')} selected={speciesFilter === 'DOG'} />
          <Chip label="Cats" onPress={() => onSetSpeciesFilter('CAT')} selected={speciesFilter === 'CAT'} />
          <Chip label="Breed" onPress={() => setFiltersOpen(true)} selected={filters.breed !== 'ALL'} />
          <Chip label="Sex" onPress={() => setFiltersOpen(true)} selected={filters.sex !== 'ALL'} />
          <Chip label="Age" onPress={() => setFiltersOpen(true)} selected={filters.ageRange !== 'ALL'} />
          <Chip label="Size" onPress={() => setFiltersOpen(true)} selected={filters.size !== 'ALL'} />
          <Chip label="Area" onPress={() => setFiltersOpen(true)} selected={filters.area !== 'ALL'} />
          <Chip label="Verified" onPress={() => onSetVerifiedOnly(!verifiedOnly)} selected={verifiedOnly} />
        </View>
        {filtersOpen ? (
          <FilterSheet
            filters={filters}
            onSetSpeciesFilter={onSetSpeciesFilter}
            onSetVerifiedOnly={onSetVerifiedOnly}
            onReset={() => {
              setFilters(defaultFilters);
              onSetSpeciesFilter('ALL');
              onSetVerifiedOnly(false);
            }}
            onSetFilters={setFilters}
            speciesFilter={speciesFilter}
            verifiedOnly={verifiedOnly}
          />
        ) : null}
      </Band>

      {likeNotice ? (
        <Band tone="sky">
          <Text style={styles.notice}>{likeNotice}</Text>
        </Band>
      ) : null}

      {verifiedMateLocked ? (
        <VerifiedMateLocked eligibility={eligibility} onSeeMissing={onSeeVerifiedMateRequirements} />
      ) : activeCandidate ? (
        <AnimalMatchCard
          candidate={activeCandidate}
          onDetails={() => onOpenDetail(activeCandidate)}
          onLike={() => onAction(activeCandidate, 'like')}
          onPass={() => onAction(activeCandidate, 'pass')}
          onSave={() => onAction(activeCandidate, 'save')}
          selectedAnimalName={selectedAnimal.name}
        />
      ) : (
        <EmptyState
          body="Change filters or choose another goal. Verified Mate shows only complete and verified profiles."
          title="No matches for the current filters"
        />
      )}
    </View>
  );
}

export function MatchDetailScreen({
  candidate,
  selectedAnimalName,
  onBack,
  onLike,
}: {
  candidate: MatchCandidate;
  selectedAnimalName: string;
  onBack: () => void;
  onLike: () => void;
}) {
  return (
    <View style={styles.stack}>
      <Button label="Back" onPress={onBack} tone="quiet" />
      <SectionHeader
        eyebrow="Details"
        title={candidate.animal.name}
        detail={`${displayBreed(candidate.animal.breed)} / ${sexLabel(candidate.animal.sex)} / ${ageLabel(candidate.animal.ageMonths)}`}
      />
      <Band>
        <InfoRow label="Goal" value={modeLabel(candidate.mode)} />
        <InfoRow label={`Compatibility with ${selectedAnimalName}`} value={`${candidate.compatibilityScore}%`} />
        <InfoRow label="Location" value={`${formatLocation(candidate.animal)}. Exact location stays private.`} />
        <Text style={styles.label}>Why it matches</Text>
        {candidate.compatibilityReasons.map((reason) => (
          <Text key={reason} style={styles.check}>
            Match: {reason}
          </Text>
        ))}
      </Band>
      <Band tone="sky">
        <InfoRow label="Temperament" value={candidate.animal.temperamentTags.join(', ')} />
        <InfoRow label="Health" value="Vaccines confirmed. Health documents uploaded." />
      </Band>
      <View style={styles.actions}>
        <Button label="Like" onPress={onLike} tone="primary" style={styles.actionButton} />
        <Button label="Not now" onPress={onBack} tone="quiet" style={styles.actionButton} />
        <Button label="Report" onPress={onBack} tone="danger" style={styles.actionButton} />
      </View>
    </View>
  );
}

export function MatchSuccessScreen({
  candidate,
  selectedAnimalName,
  onOpenMessages,
}: {
  candidate: MatchCandidate;
  selectedAnimalName: string;
  onOpenMessages: () => void;
}) {
  return (
    <Band tone="sage" style={styles.success}>
      <Text style={styles.successTitle}>New match!</Text>
      <Text style={styles.bodyText}>
        {selectedAnimalName} and {candidate.animal.name} matched.
      </Text>
      <Button label="Open messages" onPress={onOpenMessages} tone="primary" />
    </Band>
  );
}

function AnimalMatchCard({
  candidate,
  selectedAnimalName,
  onPass,
  onDetails,
  onLike,
  onSave,
}: {
  candidate: MatchCandidate;
  selectedAnimalName: string;
  onPass: () => void;
  onDetails: () => void;
  onLike: () => void;
  onSave: () => void;
}) {
  const animal = candidate.animal;

  return (
    <Band style={styles.heroCard}>
      <Image resizeMode="cover" source={animalImageSource(animal)} style={styles.heroImage} />
      <View style={styles.cardBody}>
        <View style={styles.rowBetween}>
          <View style={styles.flex}>
            <Text style={styles.cardName}>{animal.name}</Text>
            <Text style={styles.meta}>
              {displayBreed(animal.breed)} / {sexLabel(animal.sex)} / {ageLabel(animal.ageMonths)}
            </Text>
          </View>
          <StatusBadge label={`${candidate.compatibilityScore}%`} tone="sage" />
        </View>
        <Text style={styles.mode}>{modeLabel(candidate.mode)}</Text>
        <Text style={styles.location}>{formatLocation(animal)}</Text>
        <Text style={styles.bodyText}>
          Compatibility with {selectedAnimalName}: {candidate.compatibilityScore}%
        </Text>
        <View style={styles.checks}>
          <Text style={styles.check}>Verified owner</Text>
          <Text style={styles.check}>Vaccines confirmed</Text>
          <Text style={styles.check}>Complete profile</Text>
        </View>
        <Text style={styles.muted}>{animal.temperamentTags.join(', ')}.</Text>
        <View style={styles.actions}>
          <Button label="Not now" onPress={onPass} tone="quiet" style={styles.actionButton} />
          <Button label="Details" onPress={onDetails} tone="secondary" style={styles.actionButton} />
          <Button label="Like" onPress={onLike} tone="primary" style={styles.actionButton} />
        </View>
        <Button label="Save" onPress={onSave} tone="quiet" />
      </View>
    </Band>
  );
}

function FilterSheet({
  filters,
  speciesFilter,
  verifiedOnly,
  onSetFilters,
  onSetSpeciesFilter,
  onSetVerifiedOnly,
  onReset,
}: {
  filters: FilterState;
  speciesFilter: Species | 'ALL';
  verifiedOnly: boolean;
  onSetFilters: (filters: FilterState) => void;
  onSetSpeciesFilter: (species: Species | 'ALL') => void;
  onSetVerifiedOnly: (value: boolean) => void;
  onReset: () => void;
}) {
  return (
    <View style={styles.sheet}>
      <FilterGroup title="Species">
        <Chip label="All" onPress={() => onSetSpeciesFilter('ALL')} selected={speciesFilter === 'ALL'} />
        <Chip label="Dogs" onPress={() => onSetSpeciesFilter('DOG')} selected={speciesFilter === 'DOG'} />
        <Chip label="Cats" onPress={() => onSetSpeciesFilter('CAT')} selected={speciesFilter === 'CAT'} />
      </FilterGroup>
      <FilterGroup title="Breed">
        {(['ALL', 'Labrador', 'Golden Retriever', 'Metis'] as const).map((breed) => (
          <Chip
            key={breed}
            label={breed === 'ALL' ? 'All' : displayBreed(breed)}
            onPress={() => onSetFilters({ ...filters, breed })}
            selected={filters.breed === breed}
          />
        ))}
      </FilterGroup>
      <FilterGroup title="Accept mixed breed">
        <Chip
          label={filters.mixedBreedAccepted ? 'Yes' : 'No'}
          onPress={() => onSetFilters({ ...filters, mixedBreedAccepted: !filters.mixedBreedAccepted })}
          selected={filters.mixedBreedAccepted}
        />
      </FilterGroup>
      <FilterGroup title="Sex">
        {(['ALL', 'FEMALE', 'MALE'] as const).map((sex) => (
          <Chip
            key={sex}
            label={sex === 'ALL' ? 'Any' : sexLabel(sex)}
            onPress={() => onSetFilters({ ...filters, sex })}
            selected={filters.sex === sex}
          />
        ))}
      </FilterGroup>
      <FilterGroup title="Age">
        {([
          ['ALL', 'Any'],
          ['YOUNG', '0-1 years'],
          ['ADULT', '1-5 years'],
          ['SENIOR', '5+ years'],
        ] as const).map(([ageRange, label]) => (
          <Chip
            key={ageRange}
            label={label}
            onPress={() => onSetFilters({ ...filters, ageRange })}
            selected={filters.ageRange === ageRange}
          />
        ))}
      </FilterGroup>
      <FilterGroup title="Size">
        {([
          ['ALL', 'Any'],
          ['SMALL', 'Small'],
          ['MEDIUM', 'Medium'],
          ['LARGE', 'Large'],
        ] as const).map(([size, label]) => (
          <Chip
            key={size}
            label={label}
            onPress={() => onSetFilters({ ...filters, size })}
            selected={filters.size === size}
          />
        ))}
      </FilterGroup>
      <FilterGroup title="City / area">
        {(['ALL', 'Bucharest', 'Ilfov'] as const).map((area) => (
          <Chip
            key={area}
            label={area === 'ALL' ? 'All' : area}
            onPress={() => onSetFilters({ ...filters, area })}
            selected={filters.area === area}
          />
        ))}
      </FilterGroup>
      <FilterGroup title="Safety">
        <Chip
          label="Verified owners only"
          onPress={() => onSetVerifiedOnly(!verifiedOnly)}
          selected={verifiedOnly}
        />
        <Chip
          label="Vaccines confirmed"
          onPress={() => onSetFilters({ ...filters, vaccinesConfirmed: !filters.vaccinesConfirmed })}
          selected={filters.vaccinesConfirmed}
        />
        <Chip
          label="Health documents"
          onPress={() => onSetFilters({ ...filters, healthDocuments: !filters.healthDocuments })}
          selected={filters.healthDocuments}
        />
      </FilterGroup>
      <FilterGroup title="Energy">
        {(['ALL', 'LOW', 'MEDIUM', 'HIGH'] as const).map((energyLevel) => (
          <Chip
            key={energyLevel}
            label={energyLevel === 'ALL' ? 'Any' : energyLabel(energyLevel)}
            onPress={() => onSetFilters({ ...filters, energyLevel })}
            selected={filters.energyLevel === energyLevel}
          />
        ))}
      </FilterGroup>
      <FilterGroup title="Temperament">
        {(['ALL', 'calm', 'social', 'playful'] as const).map((temperament) => (
          <Chip
            key={temperament}
            label={temperament === 'ALL' ? 'Any' : temperamentLabel(temperament)}
            onPress={() => onSetFilters({ ...filters, temperament })}
            selected={filters.temperament === temperament}
          />
        ))}
      </FilterGroup>
      <Button label="Reset filters" onPress={onReset} tone="quiet" />
    </View>
  );
}

function FilterGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.filterGroup}>
      <Text style={styles.filterTitle}>{title}</Text>
      <View style={styles.wrapRow}>{children}</View>
    </View>
  );
}

function VerifiedMateLocked({
  eligibility,
  onSeeMissing,
}: {
  eligibility: { label: string; done: boolean }[];
  onSeeMissing: () => void;
}) {
  return (
    <Band tone="clay">
      <SectionHeader
        eyebrow="Verified Mate"
        title="Verified Mate is locked for now"
        detail="For safety, this mode requires extra checks. PetPal does not allow free or public breeding."
      />
      {eligibility.map((item) => (
        <Text key={item.label} style={item.done ? styles.check : styles.missing}>
          {item.done ? 'Done:' : 'Missing:'} {item.label}
        </Text>
      ))}
      <Button label="See what is missing" onPress={onSeeMissing} tone="secondary" />
    </Band>
  );
}

function animalImageSource(animal: AnimalProfile): ImageSourcePropType {
  const firstPhoto = animal.photoUrls[0];
  if (firstPhoto) return { uri: firstPhoto };
  return animal.species === 'DOG' ? dogPlaceholder : catPlaceholder;
}

function matchesAgeRange(months: number | null, range: FilterState['ageRange']) {
  if (range === 'ALL') return true;
  if (!months) return false;
  if (range === 'YOUNG') return months <= 12;
  if (range === 'ADULT') return months > 12 && months <= 60;
  return months > 60;
}

function modeLabel(mode: MatchMode) {
  return mode === 'PLAY' ? 'Play' : mode === 'SOCIAL' ? 'Social' : 'Verified Mate';
}

function sexLabel(sex: AnimalProfile['sex']) {
  return sex === 'MALE' ? 'Male' : sex === 'FEMALE' ? 'Female' : 'Unknown sex';
}

function ageLabel(months: number | null) {
  if (!months) return 'unknown age';
  if (months < 12) return `${months} months`;
  const years = Math.floor(months / 12);
  return years === 1 ? '1 year' : `${years} years`;
}

function formatLocation(animal: AnimalProfile) {
  return `${animal.city}${animal.coarseArea ? ` / ${animal.coarseArea}` : ''}`;
}

function energyLabel(energy: Exclude<FilterState['energyLevel'], 'ALL'>) {
  return energy === 'LOW' ? 'Low' : energy === 'MEDIUM' ? 'Medium' : 'High';
}

function temperamentLabel(temperament: Exclude<FilterState['temperament'], 'ALL'>) {
  return temperament === 'calm' ? 'Calm' : temperament === 'social' ? 'Social' : 'Playful';
}

function displayBreed(breed: AnimalProfile['breed'] | FilterState['breed']) {
  return !breed || breed === 'Metis' ? 'Mixed breed' : breed;
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.md,
  },
  header: {
    gap: spacing.xs,
  },
  title: {
    color: colors.ink,
    fontSize: typography.headline,
    fontWeight: '900',
    lineHeight: 33,
  },
  subtitle: {
    color: colors.ink,
    fontSize: typography.bodyLarge,
    fontWeight: '800',
    lineHeight: 24,
  },
  privacy: {
    color: colors.inkMuted,
    fontSize: typography.small,
    fontWeight: '700',
    lineHeight: 20,
  },
  label: {
    color: colors.ink,
    fontSize: typography.caption,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  sheetToggle: {
    color: colors.forest,
    fontSize: typography.caption,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  wrapRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  rowBetween: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  flex: {
    flex: 1,
  },
  notice: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: '800',
    lineHeight: 22,
  },
  heroCard: {
    overflow: 'hidden',
    padding: 0,
  },
  heroImage: {
    aspectRatio: 0.96,
    backgroundColor: colors.forest,
    borderTopLeftRadius: radii.md,
    borderTopRightRadius: radii.md,
    width: '100%',
  },
  cardBody: {
    gap: spacing.md,
    padding: spacing.md,
  },
  cardName: {
    color: colors.ink,
    fontSize: 28,
    fontWeight: '900',
    lineHeight: 32,
  },
  meta: {
    color: colors.inkMuted,
    fontSize: typography.body,
    fontWeight: '800',
    lineHeight: 22,
  },
  mode: {
    color: colors.forest,
    fontSize: typography.body,
    fontWeight: '900',
    lineHeight: 22,
  },
  location: {
    color: colors.inkMuted,
    fontSize: typography.small,
    fontWeight: '800',
    lineHeight: 20,
  },
  bodyText: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: '700',
    lineHeight: 23,
  },
  muted: {
    color: colors.inkMuted,
    fontSize: typography.body,
    fontWeight: '600',
    lineHeight: 23,
  },
  checks: {
    gap: spacing.xxs,
  },
  check: {
    color: colors.forest,
    fontSize: typography.small,
    fontWeight: '800',
    lineHeight: 20,
  },
  missing: {
    color: colors.clay,
    fontSize: typography.small,
    fontWeight: '800',
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  actionButton: {
    flex: 1,
    minWidth: 96,
  },
  sheet: {
    borderTopColor: colors.borderSoft,
    borderTopWidth: 1,
    gap: spacing.md,
    paddingTop: spacing.md,
  },
  filterGroup: {
    gap: spacing.xs,
  },
  filterTitle: {
    color: colors.inkMuted,
    fontSize: typography.caption,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  success: {
    marginTop: spacing.xxl,
  },
  successTitle: {
    color: colors.forest,
    fontSize: typography.hero,
    fontWeight: '900',
    lineHeight: 39,
  },
});
