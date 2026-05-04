import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button, Chip, EmptyState } from '../../components/ui';
import { colors, spacing, typography } from '../../design/tokens';
import { FosterCase, Species } from '../../types/petpal';
import { FosterCaseCard } from './FosterCaseCard';

type FosterFilterState = {
  species: Species | 'ALL';
  size: FosterCase['sizeLabel'] | 'ALL';
  age: 'ALL' | 'YOUNG' | 'ADULT' | 'SENIOR';
  urgency: FosterCase['urgency'] | 'ALL';
  duration: FosterCase['duration'] | 'ALL';
  area: 'ALL' | 'Bucharest' | 'Sector 1' | 'Sector 4';
  goodWithChildren: boolean | null;
  goodWithOtherAnimals: boolean | null;
  medicalNeeds: boolean | null;
  transportAvailable: boolean;
  foodCovered: boolean;
  vetCovered: boolean;
  verifiedRescuerOnly: boolean;
};

const defaultFilters: FosterFilterState = {
  species: 'ALL',
  size: 'ALL',
  age: 'ALL',
  urgency: 'ALL',
  duration: 'ALL',
  area: 'ALL',
  goodWithChildren: null,
  goodWithOtherAnimals: null,
  medicalNeeds: null,
  transportAvailable: false,
  foodCovered: false,
  vetCovered: false,
  verifiedRescuerOnly: false,
};

export function FosterFindSection({
  fosterCases,
  onOpenCase,
}: {
  fosterCases: FosterCase[];
  onOpenCase: (fosterCase: FosterCase) => void;
}) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<FosterFilterState>(defaultFilters);
  const [coveredOnly, setCoveredOnly] = useState(false);

  const visibleCases = useMemo(
    () =>
      fosterCases.filter((fosterCase) => {
        const speciesMatches = filters.species === 'ALL' || fosterCase.species === filters.species;
        const sizeMatches = filters.size === 'ALL' || fosterCase.sizeLabel === filters.size;
        const ageMatches = matchesAge(fosterCase.ageMonths, filters.age);
        const urgencyMatches = filters.urgency === 'ALL' || fosterCase.urgency === filters.urgency;
        const durationMatches = filters.duration === 'ALL' || fosterCase.duration === filters.duration;
        const areaMatches =
          filters.area === 'ALL' || fosterCase.city === filters.area || fosterCase.coarseArea === filters.area;
        const childrenMatches =
          filters.goodWithChildren === null || fosterCase.goodWithChildren === filters.goodWithChildren;
        const animalMatches =
          filters.goodWithOtherAnimals === null || fosterCase.goodWithOtherAnimals === filters.goodWithOtherAnimals;
        const medicalMatches = filters.medicalNeeds === null || Boolean(fosterCase.medicalNeeds) === filters.medicalNeeds;
        const transportMatches = !filters.transportAvailable || fosterCase.transportAvailable;
        const foodMatches = !filters.foodCovered || fosterCase.foodCovered;
        const vetMatches = !filters.vetCovered || fosterCase.vetCovered;
        const verifiedMatches = !filters.verifiedRescuerOnly || fosterCase.rescuerVerified;
        const coveredMatches =
          !coveredOnly || (fosterCase.foodCovered && fosterCase.vetCovered && fosterCase.transportAvailable);

        return (
          speciesMatches &&
          sizeMatches &&
          ageMatches &&
          urgencyMatches &&
          durationMatches &&
          areaMatches &&
          childrenMatches &&
          animalMatches &&
          medicalMatches &&
          transportMatches &&
          foodMatches &&
          vetMatches &&
          verifiedMatches &&
          coveredMatches
        );
      }),
    [coveredOnly, filters, fosterCases],
  );

  return (
    <View style={styles.stack}>
      <View style={styles.header}>
        <Text style={styles.title}>Find Foster</Text>
        <Text style={styles.detail}>Animals needing temporary homes.</Text>
      </View>

      <View style={styles.wrapRow}>
        <Chip label="Dogs" onPress={() => setFilters({ ...filters, species: 'DOG' })} selected={filters.species === 'DOG'} />
        <Chip label="Cats" onPress={() => setFilters({ ...filters, species: 'CAT' })} selected={filters.species === 'CAT'} />
        <Chip
          label="Urgent"
          onPress={() => setFilters({ ...filters, urgency: filters.urgency === 'HIGH' ? 'ALL' : 'HIGH' })}
          selected={filters.urgency === 'HIGH'}
        />
        <Chip label="Duration" onPress={() => setFiltersOpen(true)} selected={filters.duration !== 'ALL'} />
        <Chip label="Size" onPress={() => setFiltersOpen(true)} selected={filters.size !== 'ALL'} />
        <Chip label="Area" onPress={() => setFiltersOpen(true)} selected={filters.area !== 'ALL'} />
        <Chip label="Covered" onPress={() => setCoveredOnly(!coveredOnly)} selected={coveredOnly} />
        <Chip label="Filters" onPress={() => setFiltersOpen(!filtersOpen)} selected={filtersOpen} />
      </View>

      {filtersOpen ? (
        <FilterSheet
          filters={filters}
          onReset={() => {
            setFilters(defaultFilters);
            setCoveredOnly(false);
          }}
          onSetFilters={setFilters}
        />
      ) : null}

      <Text style={styles.label}>Recommended cases</Text>
      {visibleCases.length ? (
        visibleCases.map((fosterCase) => (
          <FosterCaseCard key={fosterCase.id} fosterCase={fosterCase} onView={() => onOpenCase(fosterCase)} />
        ))
      ) : (
        <EmptyState
          body="Try changing filters or checking cases with partial coverage."
          title="No foster cases match these filters"
        />
      )}
    </View>
  );
}

function FilterSheet({
  filters,
  onSetFilters,
  onReset,
}: {
  filters: FosterFilterState;
  onSetFilters: (filters: FosterFilterState) => void;
  onReset: () => void;
}) {
  return (
    <View style={styles.sheet}>
      <FilterGroup title="Species">
        <Chip label="All" onPress={() => onSetFilters({ ...filters, species: 'ALL' })} selected={filters.species === 'ALL'} />
        <Chip label="Dogs" onPress={() => onSetFilters({ ...filters, species: 'DOG' })} selected={filters.species === 'DOG'} />
        <Chip label="Cats" onPress={() => onSetFilters({ ...filters, species: 'CAT' })} selected={filters.species === 'CAT'} />
      </FilterGroup>
      <FilterGroup title="Size">
        {(['ALL', 'SMALL', 'MEDIUM', 'LARGE'] as const).map((size) => (
          <Chip
            key={size}
            label={size === 'ALL' ? 'Any' : sizeLabel(size)}
            onPress={() => onSetFilters({ ...filters, size })}
            selected={filters.size === size}
          />
        ))}
      </FilterGroup>
      <FilterGroup title="Age">
        {([
          ['ALL', 'Any'],
          ['YOUNG', '0-1 years'],
          ['ADULT', '1-5 years'],
          ['SENIOR', '5+ years'],
        ] as const).map(([age, label]) => (
          <Chip key={age} label={label} onPress={() => onSetFilters({ ...filters, age })} selected={filters.age === age} />
        ))}
      </FilterGroup>
      <FilterGroup title="Urgency">
        {([
          ['ALL', 'Any'],
          ['HIGH', 'Urgent'],
          ['MEDIUM', 'This week'],
          ['LOW', 'Low urgency'],
        ] as const).map(([urgency, label]) => (
          <Chip
            key={urgency}
            label={label}
            onPress={() => onSetFilters({ ...filters, urgency })}
            selected={filters.urgency === urgency}
          />
        ))}
      </FilterGroup>
      <FilterGroup title="Duration">
        {([
          ['ALL', 'Any'],
          ['FEW_DAYS', 'Few days'],
          ['ONE_TWO_WEEKS', '1-2 weeks'],
          ['ONE_MONTH', '1 month'],
          ['UNTIL_ADOPTION', 'Until adoption'],
        ] as const).map(([duration, label]) => (
          <Chip
            key={duration}
            label={label}
            onPress={() => onSetFilters({ ...filters, duration })}
            selected={filters.duration === duration}
          />
        ))}
      </FilterGroup>
      <FilterGroup title="City / area">
        {(['ALL', 'Bucharest', 'Sector 1', 'Sector 4'] as const).map((area) => (
          <Chip
            key={area}
            label={area === 'ALL' ? 'Any' : area}
            onPress={() => onSetFilters({ ...filters, area })}
            selected={filters.area === area}
          />
        ))}
      </FilterGroup>
      <FilterGroup title="Good with children">
        <BooleanFilter filters={filters} field="goodWithChildren" onSetFilters={onSetFilters} />
      </FilterGroup>
      <FilterGroup title="Good with other animals">
        <BooleanFilter filters={filters} field="goodWithOtherAnimals" onSetFilters={onSetFilters} />
      </FilterGroup>
      <FilterGroup title="Medical needs">
        <Chip
          label="Any"
          onPress={() => onSetFilters({ ...filters, medicalNeeds: null })}
          selected={filters.medicalNeeds === null}
        />
        <Chip
          label="Has needs"
          onPress={() => onSetFilters({ ...filters, medicalNeeds: true })}
          selected={filters.medicalNeeds === true}
        />
        <Chip
          label="No public needs"
          onPress={() => onSetFilters({ ...filters, medicalNeeds: false })}
          selected={filters.medicalNeeds === false}
        />
      </FilterGroup>
      <FilterGroup title="Support">
        <Chip
          label="Transport available"
          onPress={() => onSetFilters({ ...filters, transportAvailable: !filters.transportAvailable })}
          selected={filters.transportAvailable}
        />
        <Chip
          label="Food covered"
          onPress={() => onSetFilters({ ...filters, foodCovered: !filters.foodCovered })}
          selected={filters.foodCovered}
        />
        <Chip
          label="Vet covered"
          onPress={() => onSetFilters({ ...filters, vetCovered: !filters.vetCovered })}
          selected={filters.vetCovered}
        />
        <Chip
          label="Verified rescuer only"
          onPress={() => onSetFilters({ ...filters, verifiedRescuerOnly: !filters.verifiedRescuerOnly })}
          selected={filters.verifiedRescuerOnly}
        />
      </FilterGroup>
      <Button label="Reset filters" onPress={onReset} tone="quiet" />
    </View>
  );
}

function BooleanFilter({
  filters,
  field,
  onSetFilters,
}: {
  filters: FosterFilterState;
  field: 'goodWithChildren' | 'goodWithOtherAnimals';
  onSetFilters: (filters: FosterFilterState) => void;
}) {
  return (
    <>
      <Chip label="Any" onPress={() => onSetFilters({ ...filters, [field]: null })} selected={filters[field] === null} />
      <Chip label="Yes" onPress={() => onSetFilters({ ...filters, [field]: true })} selected={filters[field] === true} />
      <Chip label="No" onPress={() => onSetFilters({ ...filters, [field]: false })} selected={filters[field] === false} />
    </>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.filterGroup}>
      <Text style={styles.filterTitle}>{title}</Text>
      <View style={styles.wrapRow}>{children}</View>
    </View>
  );
}

function matchesAge(months: number | null, age: FosterFilterState['age']) {
  if (age === 'ALL') return true;
  if (!months) return false;
  if (age === 'YOUNG') return months <= 12;
  if (age === 'ADULT') return months > 12 && months <= 60;
  return months > 60;
}

function sizeLabel(size: Exclude<FosterFilterState['size'], 'ALL' | 'UNKNOWN'>) {
  if (size === 'SMALL') return 'Small';
  if (size === 'MEDIUM') return 'Medium';
  return 'Large';
}

const styles = StyleSheet.create({
  detail: {
    color: colors.inkMuted,
    fontSize: typography.body,
    fontWeight: '600',
    lineHeight: 22,
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
  header: {
    gap: spacing.xs,
  },
  label: {
    color: colors.ink,
    fontSize: typography.caption,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  sheet: {
    borderTopColor: colors.borderSoft,
    borderTopWidth: 1,
    gap: spacing.md,
    paddingTop: spacing.md,
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
  wrapRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
});
