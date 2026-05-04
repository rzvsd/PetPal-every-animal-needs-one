import {
  Image,
  ImageSourcePropType,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';

import { colors, radii, spacing, typography } from '../design/tokens';
import { DiscoveryListing, ListingMode } from '../types/petpal';
import { formatAge, modeLabels } from '../utils/petpalFormat';

declare const require: (path: string) => ImageSourcePropType;

const portraitImages = {
  dog: require('../../assets/petpal/dog-portrait.png'),
  cat: require('../../assets/petpal/cat-portrait.png'),
  foster: require('../../assets/petpal/foster-portrait.png'),
  shelter: require('../../assets/petpal/shelter-scene.png'),
};

type ButtonTone = 'primary' | 'secondary' | 'danger' | 'quiet' | 'ink';
type BandTone = 'canvas' | 'forest' | 'sage' | 'sky' | 'clay' | 'surface';

export function Button({
  label,
  onPress,
  tone = 'primary',
  disabled = false,
  style,
}: {
  label: string;
  onPress: () => void;
  tone?: ButtonTone;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const isDark = tone === 'primary' || tone === 'ink';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        buttonToneStyles[tone],
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}
    >
      <Text style={[styles.buttonText, isDark ? styles.buttonTextLight : styles.buttonTextDark]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
}) {
  const content = (
    <Text style={[styles.chipText, selected && styles.chipTextSelected]} numberOfLines={1}>
      {label}
    </Text>
  );

  if (!onPress) {
    return <View style={[styles.chip, selected && styles.chipSelected]}>{content}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.chip, selected && styles.chipSelected, pressed && styles.pressed]}
    >
      {content}
    </Pressable>
  );
}

export function StatusBadge({
  label,
  tone = 'sage',
}: {
  label: string;
  tone?: 'sage' | 'clay' | 'sky' | 'rose' | 'butter';
}) {
  return (
    <View style={[styles.badge, badgeToneStyles[tone]]}>
      <Text style={styles.badgeText} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  helper,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  multiline?: boolean;
  helper?: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        multiline={multiline}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.inkSoft}
        style={[styles.input, multiline && styles.textarea]}
        value={value}
      />
      {helper ? <Text style={styles.fieldHelper}>{helper}</Text> : null}
    </View>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  detail,
  align = 'left',
}: {
  eyebrow?: string;
  title: string;
  detail?: string;
  align?: 'left' | 'center';
}) {
  const textAlign: TextStyle['textAlign'] = align === 'center' ? 'center' : 'left';

  return (
    <View style={[styles.sectionHeader, align === 'center' && styles.sectionHeaderCenter]}>
      {eyebrow ? <Text style={[styles.eyebrow, { textAlign }]}>{eyebrow}</Text> : null}
      <Text style={[styles.sectionTitle, { textAlign }]}>{title}</Text>
      {detail ? <Text style={[styles.sectionDetail, { textAlign }]}>{detail}</Text> : null}
    </View>
  );
}

export function Band({
  children,
  tone = 'surface',
  style,
}: {
  children: React.ReactNode;
  tone?: BandTone;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.band, bandToneStyles[tone], style]}>{children}</View>;
}

export function Panel({ children, tone = 'surface' }: { children: React.ReactNode; tone?: BandTone | 'warm' | 'deep' }) {
  const mappedTone: BandTone = tone === 'warm' ? 'surface' : tone === 'deep' ? 'sage' : tone;
  return <Band tone={mappedTone}>{children}</Band>;
}

export function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

export function ListingCard({
  listing,
  selected,
  onPress,
}: {
  listing: DiscoveryListing;
  selected?: boolean;
  onPress: () => void;
}) {
  const tone = modeTone(listing.mode);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${modeLabels[listing.mode]}, ${listing.animalName}, ${listing.city}`}
      onPress={onPress}
      style={({ pressed }) => [styles.listingCard, selected && styles.selectedCard, pressed && styles.pressed]}
    >
      <View style={styles.listingImageColumn}>
        <AnimalPortrait listing={listing} />
      </View>
      <View style={styles.listingBody}>
        <View style={styles.listingTopline}>
          <Text style={styles.cardTitle}>{listing.animalName}</Text>
          <StatusBadge label={modeLabels[listing.mode]} tone={tone} />
          <Text style={styles.cardTrust}>✓ Verified</Text>
        </View>
        <Text style={styles.cardMeta}>
          {titleCase(listing.species)} • {formatAge(listing.approximateAgeMonths)} • {listing.sizeLabel ?? titleCase(listing.sex)}
        </Text>
        <Text style={styles.cardLocation}>⌖ {formatLocation(listing)}</Text>
        <Text style={styles.cardSubtitle}>{listing.title}</Text>
      </View>
    </Pressable>
  );
}

export function AnimalPortrait({
  listing,
  variant = 'card',
}: {
  listing: DiscoveryListing;
  variant?: 'card' | 'hero';
}) {
  const source =
    listing.mode === 'FOSTER'
      ? portraitImages.foster
      : listing.species === 'DOG'
        ? portraitImages.dog
        : portraitImages.cat;

  return (
    <View style={[styles.portrait, variant === 'hero' && styles.portraitHero]}>
      <Image resizeMode="cover" source={source} style={styles.portraitImage} />
      <View style={styles.portraitOverlay} />
      {variant === 'hero' ? (
        <View style={styles.speciesBadge}>
          <Text style={styles.speciesText}>{listing.species}</Text>
        </View>
      ) : null}
    </View>
  );
}

export function EmptyState({
  title,
  body,
  action,
  onAction,
}: {
  title: string;
  body: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyKicker}>Nothing here yet</Text>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
      {action && onAction ? <Button label={action} onPress={onAction} tone="secondary" /> : null}
    </View>
  );
}

export function Metric({
  label,
  value,
  tone = 'surface',
}: {
  label: string;
  value: string;
  tone?: 'surface' | 'forest';
}) {
  return (
    <View style={[styles.metric, tone === 'forest' && styles.metricDark]}>
      <Text style={[styles.metricValue, tone === 'forest' && styles.metricValueDark]}>{value}</Text>
      <Text style={[styles.metricLabel, tone === 'forest' && styles.metricLabelDark]}>{label}</Text>
    </View>
  );
}

export function modeTone(mode: ListingMode): 'sage' | 'clay' {
  return mode === 'FOSTER' ? 'clay' : 'sage';
}

export function formatLocation(listing: DiscoveryListing) {
  return `${listing.city}${listing.coarseArea ? ` / ${listing.coarseArea}` : ''}`;
}

function titleCase(value: string) {
  return value.slice(0, 1).toUpperCase() + value.slice(1).toLowerCase();
}

const buttonToneStyles = StyleSheet.create({
  primary: {
    backgroundColor: colors.sage,
    borderColor: colors.sageDeep,
  },
  secondary: {
    backgroundColor: colors.butter,
    borderColor: colors.border,
  },
  danger: {
    backgroundColor: colors.roseMist,
    borderColor: colors.rose,
  },
  quiet: {
    backgroundColor: 'transparent',
    borderColor: colors.border,
  },
  ink: {
    backgroundColor: colors.forest,
    borderColor: colors.forest,
  },
});

const badgeToneStyles = StyleSheet.create({
  sage: {
    backgroundColor: colors.sageMist,
    borderColor: 'rgba(40, 91, 76, 0.25)',
  },
  clay: {
    backgroundColor: colors.clayMist,
    borderColor: 'rgba(184, 102, 66, 0.30)',
  },
  sky: {
    backgroundColor: colors.sky,
    borderColor: 'rgba(109, 154, 175, 0.34)',
  },
  rose: {
    backgroundColor: colors.roseMist,
    borderColor: 'rgba(184, 100, 109, 0.32)',
  },
  butter: {
    backgroundColor: colors.butter,
    borderColor: 'rgba(169, 130, 91, 0.30)',
  },
});

const bandToneStyles = StyleSheet.create({
  canvas: {
    backgroundColor: colors.canvas,
    borderColor: 'rgba(23, 35, 31, 0.12)',
  },
  forest: {
    backgroundColor: colors.forest,
    borderColor: 'rgba(248, 230, 201, 0.16)',
  },
  sage: {
    backgroundColor: colors.sageMist,
    borderColor: 'rgba(40, 91, 76, 0.22)',
  },
  sky: {
    backgroundColor: colors.sky,
    borderColor: 'rgba(109, 154, 175, 0.28)',
  },
  clay: {
    backgroundColor: colors.clayMist,
    borderColor: 'rgba(184, 102, 66, 0.24)',
  },
  surface: {
    backgroundColor: colors.surface,
    borderColor: 'rgba(169, 130, 91, 0.34)',
  },
});

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    borderRadius: radii.md,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  buttonText: {
    fontSize: typography.small,
    fontWeight: '900',
    lineHeight: 20,
  },
  buttonTextLight: {
    color: colors.cream,
  },
  buttonTextDark: {
    color: colors.ink,
  },
  disabled: {
    opacity: 0.45,
  },
  pressed: {
    opacity: 0.72,
    transform: [{ scale: 0.99 }],
  },
  chip: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 34,
    paddingHorizontal: spacing.sm,
  },
  chipSelected: {
    backgroundColor: colors.forest,
    borderColor: colors.forest,
  },
  chipText: {
    color: colors.ink,
    fontSize: typography.caption,
    fontWeight: '900',
  },
  chipTextSelected: {
    color: colors.cream,
  },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: radii.sm,
    borderWidth: 1,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xxs,
  },
  badgeText: {
    color: colors.ink,
    fontSize: typography.micro,
    fontWeight: '900',
    lineHeight: 14,
    textTransform: 'uppercase',
  },
  field: {
    gap: spacing.xs,
  },
  fieldLabel: {
    color: colors.ink,
    fontSize: typography.caption,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    color: colors.ink,
    fontSize: typography.body,
    minHeight: 52,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  textarea: {
    minHeight: 124,
    textAlignVertical: 'top',
  },
  fieldHelper: {
    color: colors.inkMuted,
    fontSize: typography.small,
    lineHeight: 18,
  },
  sectionHeader: {
    gap: spacing.xs,
  },
  sectionHeaderCenter: {
    alignItems: 'center',
  },
  eyebrow: {
    color: colors.clay,
    fontSize: typography.caption,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: typography.title,
    fontWeight: '900',
    lineHeight: 27,
  },
  sectionDetail: {
    color: colors.inkMuted,
    fontSize: typography.body,
    fontWeight: '500',
    lineHeight: 22,
  },
  band: {
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.md,
    shadowColor: colors.ink,
    shadowOffset: { height: 2, width: 0 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 1,
  },
  infoRow: {
    borderTopColor: colors.borderSoft,
    borderTopWidth: 1,
    gap: spacing.xxs,
    paddingVertical: spacing.sm,
  },
  infoLabel: {
    color: colors.inkSoft,
    fontSize: typography.caption,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  infoValue: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: '600',
    lineHeight: 22,
  },
  listingCard: {
    alignItems: 'stretch',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    height: 146,
    overflow: 'hidden',
    shadowColor: colors.ink,
    shadowOffset: { height: 2, width: 0 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 1,
  },
  selectedCard: {
    borderColor: colors.sageDeep,
    borderWidth: 2,
  },
  listingBody: {
    flex: 1,
    gap: spacing.xs,
    justifyContent: 'center',
    padding: spacing.sm,
  },
  listingImageColumn: {
    height: '100%',
    width: 124,
  },
  listingTopline: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    justifyContent: 'space-between',
  },
  cardTrust: {
    color: colors.butter,
    fontSize: typography.caption,
    fontWeight: '900',
  },
  cardTitle: {
    color: colors.ink,
    flex: 1,
    fontFamily: 'serif',
    fontSize: 20,
    fontWeight: '900',
    lineHeight: 23,
  },
  cardSubtitle: {
    color: colors.ink,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    fontSize: typography.caption,
    fontWeight: '600',
    lineHeight: 17,
    paddingTop: spacing.xs,
  },
  cardMeta: {
    color: colors.ink,
    fontSize: typography.small,
    fontWeight: '800',
  },
  cardDetail: {
    color: colors.inkMuted,
    fontSize: typography.small,
    fontWeight: '700',
    lineHeight: 18,
    textTransform: 'uppercase',
  },
  cardLocation: {
    color: colors.inkMuted,
    fontSize: typography.small,
    fontWeight: '600',
  },
  portrait: {
    backgroundColor: colors.forest,
    height: '100%',
    overflow: 'hidden',
    width: '100%',
  },
  portraitHero: {
    aspectRatio: 1.18,
    borderRadius: radii.md,
    height: undefined,
  },
  portraitImage: {
    height: '100%',
    position: 'absolute',
    width: '100%',
  },
  portraitOverlay: {
    backgroundColor: 'rgba(16, 37, 31, 0.08)',
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  speciesBadge: {
    alignSelf: 'center',
    backgroundColor: 'rgba(255, 248, 236, 0.94)',
    borderRadius: radii.sm,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  speciesText: {
    color: colors.ink,
    fontSize: typography.caption,
    fontWeight: '900',
  },
  emptyState: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.lg,
  },
  emptyKicker: {
    color: colors.clay,
    fontSize: typography.caption,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  emptyTitle: {
    color: colors.ink,
    fontSize: typography.bodyLarge,
    fontWeight: '900',
  },
  emptyBody: {
    color: colors.inkMuted,
    fontSize: typography.body,
    lineHeight: 22,
  },
  metric: {
    backgroundColor: colors.surface,
    borderColor: colors.borderSoft,
    borderRadius: radii.md,
    borderWidth: 1,
    flex: 1,
    minWidth: 92,
    padding: spacing.sm,
  },
  metricDark: {
    backgroundColor: 'rgba(248, 230, 201, 0.09)',
    borderColor: 'rgba(248, 230, 201, 0.18)',
  },
  metricValue: {
    color: colors.forest,
    fontSize: typography.title,
    fontWeight: '900',
  },
  metricValueDark: {
    color: colors.cream,
  },
  metricLabel: {
    color: colors.inkMuted,
    fontSize: typography.micro,
    fontWeight: '900',
    lineHeight: 14,
    textTransform: 'uppercase',
  },
  metricLabelDark: {
    color: colors.sky,
  },
});
