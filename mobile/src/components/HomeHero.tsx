import { MaterialCommunityIcons } from '@expo/vector-icons'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { BrandLogo } from '@/components/BrandLogo'
import { ProductPreviewBanner } from '@/components/ProductPreviewBanner'
import { colors, fonts, radii, spacing } from '@/constants/theme'

const PLATFORMS = ['TikTok', 'YouTube', 'Instagram', 'Recipe blogs']

interface HomeHeroProps {
  isAuthenticated: boolean
  onPrimaryPress: () => void
  onSecondaryPress: () => void
}

export function HomeHero({ isAuthenticated, onPrimaryPress, onSecondaryPress }: HomeHeroProps) {
  const insets = useSafeAreaInsets()
  const primaryLabel = isAuthenticated ? 'Add a recipe' : 'Get started free'

  if (isAuthenticated) {
    return (
      <View style={[styles.hero, styles.heroCompact, { paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.blobTop} pointerEvents="none" />
        <Text style={styles.compactTitle}>What are we cooking today?</Text>
        <Text style={styles.compactSubtitle}>
          Paste a link from TikTok, YouTube, or anywhere — we&apos;ll turn it into steps.
        </Text>
        <Pressable onPress={onPrimaryPress} style={styles.primaryCta} accessibilityRole="button">
          <Text style={styles.primaryCtaText}>{primaryLabel}</Text>
        </Pressable>
      </View>
    )
  }

  return (
    <View style={[styles.hero, { paddingTop: insets.top + spacing.sm }]}>
      <BrandLogo style={styles.logo} />
      <View style={styles.blobTop} pointerEvents="none" />
      <View style={styles.blobRight} pointerEvents="none" />
      <View style={styles.blobLeft} pointerEvents="none" />

      <View style={styles.badge}>
        <MaterialCommunityIcons name="star-four-points" size={16} color={colors.accent500} />
        <Text style={styles.badgeText}>From video to step cards in seconds</Text>
      </View>

      <Text style={styles.headline}>Turn any recipe into easy, step-by-step cards</Text>
      <Text style={styles.subtitle}>
        Drop in a cooking video or recipe site and Your Cook Mate breaks it into clear,
        one-at-a-time steps you can flip through while you cook.
      </Text>

      <View style={styles.ctaRow}>
        <Pressable
          onPress={onPrimaryPress}
          style={styles.primaryCta}
          accessibilityRole="button"
        >
          <Text style={styles.primaryCtaText}>{primaryLabel}</Text>
        </Pressable>
        <Pressable
          onPress={onSecondaryPress}
          style={styles.secondaryCta}
          accessibilityRole="button"
        >
          <Text style={styles.secondaryCtaText}>I have an account</Text>
        </Pressable>
      </View>

      <View style={styles.platformRow}>
        {PLATFORMS.map((name) => (
          <View key={name} style={styles.platformChip}>
            <Text style={styles.platformText}>{name}</Text>
          </View>
        ))}
      </View>

      <ProductPreviewBanner />
    </View>
  )
}

const styles = StyleSheet.create({
  hero: {
    position: 'relative',
    overflow: 'hidden',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(167,243,208,0.4)',
    paddingBottom: spacing.section,
    marginHorizontal: -spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  heroCompact: {
    paddingBottom: spacing.xxl,
  },
  logo: {
    marginBottom: spacing.xxl,
  },
  compactTitle: {
    fontFamily: fonts.displayBold,
    fontSize: 24,
    lineHeight: 30,
    color: colors.stone900,
  },
  compactSubtitle: {
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
    fontFamily: fonts.sans,
    fontSize: 15,
    lineHeight: 22,
    color: colors.stone600,
  },
  blobTop: {
    position: 'absolute',
    top: -80,
    left: '10%',
    right: '10%',
    height: 200,
    borderRadius: 999,
    backgroundColor: 'rgba(5,150,105,0.12)',
  },
  blobRight: {
    position: 'absolute',
    top: 40,
    right: -60,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(254,243,199,0.6)',
  },
  blobLeft: {
    position: 'absolute',
    bottom: 80,
    left: -40,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(209,250,229,0.8)',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.sm,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(167,243,208,0.8)',
    backgroundColor: 'rgba(255,255,255,0.85)',
    paddingHorizontal: spacing.lg,
    paddingVertical: 6,
    marginBottom: spacing.lg,
  },
  badgeText: {
    fontFamily: fonts.displaySemiBold,
    fontSize: 13,
    color: colors.brand700,
  },
  headline: {
    fontFamily: fonts.displayBold,
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -0.5,
    color: colors.stone900,
  },
  subtitle: {
    marginTop: spacing.lg,
    fontFamily: fonts.sans,
    fontSize: 17,
    lineHeight: 26,
    color: colors.stone600,
  },
  ctaRow: {
    marginTop: spacing.xxl,
    gap: spacing.md,
  },
  primaryCta: {
    minHeight: 48,
    borderRadius: radii.xxl,
    backgroundColor: colors.brand600,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xxl,
    shadowColor: colors.brand600,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
    elevation: 4,
  },
  primaryCtaText: {
    fontFamily: fonts.displaySemiBold,
    fontSize: 16,
    color: colors.white,
  },
  secondaryCta: {
    minHeight: 48,
    borderRadius: radii.xxl,
    borderWidth: 1,
    borderColor: colors.stone200,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xxl,
  },
  secondaryCtaText: {
    fontFamily: fonts.displaySemiBold,
    fontSize: 16,
    color: colors.stone700,
  },
  platformRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.xxl,
  },
  platformChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(231,229,228,0.8)',
    backgroundColor: 'rgba(255,255,255,0.7)',
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
  },
  platformText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 12,
    color: colors.stone600,
  },
})
