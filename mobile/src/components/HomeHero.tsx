import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ProductPreviewBanner } from '@/components/ProductPreviewBanner'
import { colors, fonts, radii, spacing } from '@/constants/theme'

interface HomeHeroProps {
  isAuthenticated: boolean
  onPrimaryPress: () => void
  onSecondaryPress: () => void
}

export function HomeHero({ isAuthenticated, onPrimaryPress, onSecondaryPress }: HomeHeroProps) {
  const insets = useSafeAreaInsets()

  if (isAuthenticated) {
    return (
      <View style={[styles.hero, styles.heroCompact, { paddingTop: insets.top + spacing.sm }]}>
        <Text style={styles.brand}>Your Cook Mate</Text>
        <Text style={styles.compactTitle}>What are we cooking today?</Text>
        <Text style={styles.compactSubtitle}>Paste a link — get clear steps.</Text>
        <Pressable onPress={onPrimaryPress} style={styles.primaryCta} accessibilityRole="button">
          <Text style={styles.primaryCtaText}>Add a recipe</Text>
        </Pressable>
      </View>
    )
  }

  return (
    <View style={[styles.hero, { paddingTop: insets.top + spacing.md }]}>
      <Text style={styles.brand}>Your Cook Mate</Text>

      <Text style={styles.headline}>Turn any recipe into easy, step-by-step cards</Text>
      <Text style={styles.subtitle}>
        Paste a cooking video or recipe site. Cook one clear step at a time — no more pausing on
        repeat.
      </Text>

      <View style={styles.ctaRow}>
        <Pressable
          onPress={onPrimaryPress}
          style={styles.primaryCta}
          accessibilityRole="button"
          accessibilityLabel="Create account"
        >
          <Text style={styles.primaryCtaText}>Create account</Text>
        </Pressable>
        <Pressable
          onPress={onSecondaryPress}
          style={styles.secondaryCta}
          accessibilityRole="button"
          accessibilityLabel="Sign in"
        >
          <Text style={styles.secondaryCtaText}>Sign in</Text>
        </Pressable>
      </View>

      <ProductPreviewBanner />
    </View>
  )
}

const styles = StyleSheet.create({
  hero: {
    position: 'relative',
    overflow: 'hidden',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(231,229,228,0.9)',
    backgroundColor: colors.surface,
    paddingBottom: spacing.section,
    marginHorizontal: -spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  heroCompact: {
    paddingBottom: spacing.xxl,
  },
  brand: {
    fontFamily: fonts.displaySemiBold,
    fontSize: 22,
    lineHeight: 28,
    color: colors.brand700,
    marginBottom: spacing.lg,
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
  headline: {
    fontFamily: fonts.displayBold,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.3,
    color: colors.stone900,
  },
  subtitle: {
    marginTop: spacing.md,
    maxWidth: 360,
    fontFamily: fonts.sans,
    fontSize: 16,
    lineHeight: 24,
    color: colors.stone600,
  },
  ctaRow: {
    marginTop: spacing.xxl,
    gap: spacing.sm,
  },
  primaryCta: {
    minHeight: 48,
    borderRadius: radii.lg,
    backgroundColor: colors.brand700,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xxl,
  },
  primaryCtaText: {
    fontFamily: fonts.displaySemiBold,
    fontSize: 16,
    color: colors.white,
  },
  secondaryCta: {
    minHeight: 48,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.stone200,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xxl,
  },
  secondaryCtaText: {
    fontFamily: fonts.displaySemiBold,
    fontSize: 16,
    color: colors.stone700,
  },
})
