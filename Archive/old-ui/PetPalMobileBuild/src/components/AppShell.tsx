import { StatusBar } from 'expo-status-bar';
import { Image, ImageSourcePropType, SafeAreaView, StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing, typography } from '../design/tokens';

declare const require: (path: string) => ImageSourcePropType;

const appIcon = require('../../assets/petpal/app-icon-v1.png');

export function AppShell({
  children,
  hideChrome = false,
  isLive,
}: {
  children: React.ReactNode;
  hideChrome?: boolean;
  isLive: boolean;
}) {
  return (
    <View style={styles.safeArea}>
      <StatusBar style="light" />
      {!hideChrome ? (
        <SafeAreaView style={styles.header}>
          <View style={styles.identity}>
            <Image source={appIcon} style={styles.logo} />
            <View style={styles.identityText}>
              <Text style={styles.brand}>PetPal</Text>
              <Text style={styles.subtitle}>safe animal matching and foster</Text>
            </View>
          </View>
          <View style={styles.livePill}>
            <Text style={styles.liveIcon}>◉</Text>
            <Text style={styles.liveText}>{isLive ? 'Live' : 'Demo'}</Text>
          </View>
        </SafeAreaView>
      ) : null}
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.canvas,
    flex: 1,
  },
  header: {
    alignItems: 'center',
    backgroundColor: colors.forest,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 126,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    shadowColor: colors.ink,
    shadowOffset: { height: 4, width: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 3,
  },
  identity: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minWidth: 0,
  },
  logo: {
    backgroundColor: colors.cream,
    borderRadius: 18,
    height: 54,
    width: 54,
  },
  identityText: {
    flex: 1,
    minWidth: 0,
  },
  brand: {
    color: colors.cream,
    fontFamily: 'serif',
    fontSize: 36,
    fontWeight: '900',
    lineHeight: 40,
  },
  subtitle: {
    color: colors.butter,
    fontSize: typography.caption,
    fontWeight: '900',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  livePill: {
    alignItems: 'center',
    borderColor: 'rgba(227, 184, 75, 0.46)',
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  liveIcon: {
    color: colors.butter,
    fontSize: typography.caption,
    fontWeight: '900',
  },
  liveText: {
    color: colors.butter,
    fontSize: typography.small,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  content: {
    backgroundColor: colors.canvas,
    flex: 1,
  },
});

