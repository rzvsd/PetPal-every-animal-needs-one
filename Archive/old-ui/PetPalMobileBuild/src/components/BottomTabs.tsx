import { Pressable, StyleSheet, Text, View } from 'react-native';

import { MainTab, tabs } from '../app/navigation';
import { colors, radii, spacing, typography } from '../design/tokens';

export function BottomTabs({
  activeTab,
  onTabPress,
}: {
  activeTab: MainTab;
  onTabPress: (tab: MainTab) => void;
}) {
  return (
    <View style={styles.wrap}>
      <View style={styles.bar}>
        {tabs.map((tab) => (
          <Pressable
            accessibilityLabel={tab.label}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === tab.id }}
            key={tab.id}
            onPress={() => onTabPress(tab.id)}
            style={({ pressed }) => [
              styles.tab,
              activeTab === tab.id && styles.tabActive,
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.mark, activeTab === tab.id && styles.markActive]} numberOfLines={1}>
              {tab.mark}
            </Text>
            <Text style={[styles.label, activeTab === tab.id && styles.labelActive]} numberOfLines={1}>
              {tab.shortLabel}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    paddingBottom: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
  },
  bar: {
    flexDirection: 'row',
    gap: spacing.xxs,
    minHeight: 68,
  },
  tab: {
    alignItems: 'center',
    borderRadius: radii.md,
    flex: 1,
    gap: 3,
    justifyContent: 'center',
    minHeight: 60,
    paddingHorizontal: spacing.xxs,
  },
  tabActive: {
    backgroundColor: colors.sageMist,
  },
  mark: {
    color: colors.inkMuted,
    fontSize: typography.caption,
    fontWeight: '900',
    lineHeight: 16,
  },
  markActive: {
    color: colors.forest,
  },
  label: {
    color: colors.inkMuted,
    fontSize: typography.caption,
    fontWeight: '800',
    lineHeight: 16,
  },
  labelActive: {
    color: colors.forest,
    fontWeight: '900',
  },
  pressed: {
    opacity: 0.72,
  },
});
