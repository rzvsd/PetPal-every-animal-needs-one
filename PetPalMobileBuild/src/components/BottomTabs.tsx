import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ActiveTab, tabs } from '../app/navigation';
import { colors, radii, spacing, typography } from '../design/tokens';

const tabMarks: Record<ActiveTab, string> = {
  discover: '●',
  applications: '▣',
  inbox: '○',
  shelter: '▥',
  profile: '◎',
};

const tabShortLabels: Record<ActiveTab, string> = {
  discover: 'Find',
  applications: 'Apply',
  inbox: 'Chat',
  shelter: 'Org',
  profile: 'Me',
};

export function BottomTabs({
  activeTab,
  onTabPress,
}: {
  activeTab: ActiveTab;
  onTabPress: (tab: ActiveTab) => void;
}) {
  return (
    <View style={styles.wrap}>
      <View style={styles.bar}>
        {tabs.map((tab) => (
          <TabButton
            active={activeTab === tab.id}
            key={tab.id}
            label={tab.label}
            mark={tabMarks[tab.id]}
            shortLabel={tabShortLabels[tab.id]}
            onPress={() => onTabPress(tab.id)}
          />
        ))}
      </View>
    </View>
  );
}

function TabButton({
  active,
  label,
  mark,
  shortLabel,
  onPress,
}: {
  active: boolean;
  label: string;
  mark: string;
  shortLabel: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [styles.tab, active && styles.tabActive, pressed && styles.pressed]}
    >
      <Text style={[styles.mark, active && styles.markActive]} numberOfLines={1}>
        {mark}
      </Text>
      <Text style={[styles.shortLabel, active && styles.shortLabelActive]} numberOfLines={1}>
        {shortLabel}
      </Text>
      <View style={[styles.rule, active && styles.ruleActive]} />
    </Pressable>
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
    backgroundColor: colors.surface,
    borderColor: 'transparent',
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.xxs,
    minHeight: 72,
    padding: 0,
  },
  tab: {
    alignItems: 'center',
    borderRadius: radii.sm,
    flex: 1,
    gap: 2,
    justifyContent: 'center',
    minHeight: 64,
    paddingHorizontal: spacing.xxs,
  },
  tabActive: {
    backgroundColor: 'transparent',
  },
  mark: {
    color: colors.inkMuted,
    fontSize: 25,
    fontWeight: '900',
    lineHeight: 28,
  },
  markActive: {
    color: colors.forest,
  },
  shortLabel: {
    color: colors.inkMuted,
    fontSize: typography.caption,
    fontWeight: '800',
    lineHeight: 16,
  },
  shortLabelActive: {
    color: colors.forest,
    fontWeight: '900',
  },
  rule: {
    backgroundColor: 'transparent',
    borderRadius: radii.sm,
    height: 4,
    width: 48,
  },
  ruleActive: {
    backgroundColor: colors.butter,
  },
  pressed: {
    opacity: 0.72,
  },
});
