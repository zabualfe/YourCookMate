import { Image, StyleSheet, Text, View, type ViewStyle } from 'react-native'
import { colors, fonts, radii } from '@/constants/theme'

interface BrandLogoProps {
  showWordmark?: boolean
  showBadge?: boolean
  size?: 'sm' | 'md'
  style?: ViewStyle
}

export function BrandLogo({
  showWordmark = true,
  showBadge = true,
  size = 'md',
  style,
}: BrandLogoProps) {
  const iconSize = size === 'sm' ? 24 : 28
  const tileSize = size === 'sm' ? 28 : 32

  const logo = (
    <Image
      source={require('../../assets/logo.png')}
      style={{ width: iconSize, height: iconSize }}
      resizeMode="contain"
      accessibilityLabel="Your Cook Mate"
    />
  )

  if (showBadge) {
    return (
      <View style={[styles.badge, size === 'sm' && styles.badgeSm, style]}>
        <View style={[styles.iconTile, { width: tileSize, height: tileSize }]}>
          {logo}
        </View>
        {showWordmark && <Text style={[styles.wordmarkBadge, size === 'sm' && styles.wordmarkSm]}>Your Cook Mate</Text>}
      </View>
    )
  }

  return (
    <View style={[styles.plain, style]}>
      {logo}
      {showWordmark && <Text style={styles.wordmarkPlain}>Your Cook Mate</Text>}
    </View>
  )
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.brand700,
    borderRadius: radii.md,
    paddingLeft: 4,
    paddingRight: 12,
    paddingVertical: 4,
  },
  badgeSm: {
    paddingRight: 10,
  },
  iconTile: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.sm,
    backgroundColor: colors.white,
  },
  wordmarkBadge: {
    fontFamily: fonts.displaySemiBold,
    fontSize: 16,
    color: colors.white,
    letterSpacing: -0.2,
  },
  wordmarkSm: {
    fontSize: 14,
  },
  plain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  wordmarkPlain: {
    fontFamily: fonts.displaySemiBold,
    fontSize: 16,
    color: colors.stone900,
    letterSpacing: -0.2,
  },
})
