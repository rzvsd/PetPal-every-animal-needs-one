import { ImageBackground, ImageSourcePropType, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing, typography } from '../design/tokens';

declare const require: (path: string) => ImageSourcePropType;

const welcomeImage = require('../../assets/petpal/app-background-v1.png');
const appIcon = require('../../assets/petpal/app-icon-v1.png');

export function WelcomeScreen({ onStart }: { onStart: () => void }) {
  return (
    <ImageBackground resizeMode="cover" source={welcomeImage} style={styles.background}>
      <View style={styles.scrim} />
      <View style={styles.content}>
        <View style={styles.brandRow}>
          <ImageBackground source={appIcon} style={styles.logo} imageStyle={styles.logoImage} />
          <View>
            <Text style={styles.brand}>PetPal</Text>
            <Text style={styles.promise}>Every animal needs one.</Text>
          </View>
        </View>

        <View style={styles.story}>
          <Text style={styles.kicker}>Bucharest / Ilfov pilot</Text>
          <Text style={styles.title}>Rescue profiles with a safer next step.</Text>
          <Text style={styles.copy}>
            Browse verified dogs and cats, apply privately, and let shelters decide when a conversation should open.
          </Text>
        </View>
      </View>

      <View style={styles.footer}>
        <View style={styles.trustStrip}>
          <TrustItem title="Verified" body="Rescue-led profiles" />
          <TrustItem title="Private" body="No public addresses" />
          <TrustItem title="Gated" body="Chat after review" />
        </View>
        <Pressable
          accessibilityHint="Opens PetPal discovery"
          accessibilityLabel="Enter PetPal"
          accessibilityRole="button"
          onPress={onStart}
          style={({ pressed }) => [styles.startButton, pressed && styles.pressed]}
        >
          <Text style={styles.startText}>Enter PetPal</Text>
        </Pressable>
      </View>
    </ImageBackground>
  );
}

function TrustItem({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.trustItem}>
      <Text style={styles.trustTitle}>{title}</Text>
      <Text style={styles.trustBody}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    justifyContent: 'space-between',
    paddingBottom: 34,
    paddingHorizontal: spacing.md,
    paddingTop: 58,
  },
  scrim: {
    backgroundColor: 'rgba(16, 37, 31, 0.46)',
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
  },
  brandRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  logo: {
    height: 56,
    width: 56,
  },
  logoImage: {
    borderRadius: radii.md,
  },
  brand: {
    color: colors.cream,
    fontSize: 44,
    fontWeight: '900',
    lineHeight: 48,
  },
  promise: {
    color: colors.butter,
    fontSize: typography.body,
    fontWeight: '900',
  },
  story: {
    gap: spacing.sm,
    marginBottom: spacing.xl,
    maxWidth: 560,
  },
  kicker: {
    alignSelf: 'flex-start',
    backgroundColor: colors.butter,
    borderRadius: radii.sm,
    color: colors.ink,
    fontSize: typography.caption,
    fontWeight: '900',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.cream,
    fontSize: 32,
    fontWeight: '900',
    lineHeight: 37,
  },
  copy: {
    color: colors.sky,
    fontSize: typography.bodyLarge,
    fontWeight: '700',
    lineHeight: 25,
  },
  footer: {
    gap: spacing.md,
  },
  trustStrip: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  trustItem: {
    backgroundColor: 'rgba(16, 42, 35, 0.74)',
    borderColor: 'rgba(248, 230, 201, 0.22)',
    borderRadius: radii.md,
    borderWidth: 1,
    flex: 1,
    minHeight: 76,
    padding: spacing.sm,
  },
  trustTitle: {
    color: colors.cream,
    fontSize: typography.caption,
    fontWeight: '900',
  },
  trustBody: {
    color: colors.sky,
    fontSize: typography.micro,
    fontWeight: '800',
    lineHeight: 14,
    marginTop: spacing.xxs,
  },
  startButton: {
    alignItems: 'center',
    backgroundColor: colors.cream,
    borderColor: colors.butter,
    borderRadius: radii.md,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 58,
  },
  startText: {
    color: colors.forest,
    fontSize: typography.bodyLarge,
    fontWeight: '900',
  },
  pressed: {
    opacity: 0.72,
  },
});
