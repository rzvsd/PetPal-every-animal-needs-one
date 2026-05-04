import { StyleSheet, View } from 'react-native';

import { Chip } from '../../components/ui';
import { spacing } from '../../design/tokens';

export type MessageFilter = 'all' | 'matches' | 'foster';

export function MessageFilters({
  filter,
  onFilter,
}: {
  filter: MessageFilter;
  onFilter: (filter: MessageFilter) => void;
}) {
  return (
    <View style={styles.wrapRow}>
      <Chip label="All" onPress={() => onFilter('all')} selected={filter === 'all'} />
      <Chip label="Matches" onPress={() => onFilter('matches')} selected={filter === 'matches'} />
      <Chip label="Foster" onPress={() => onFilter('foster')} selected={filter === 'foster'} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
});
