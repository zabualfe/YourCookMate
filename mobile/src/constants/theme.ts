import { StyleSheet, type TextStyle, type ViewStyle } from 'react-native'

/** Fresh kitchen — emerald primary, amber accent, mint surfaces (matches web) */
export const colors = {
  brand50: '#ecfdf5',
  brand100: '#d1fae5',
  brand200: '#a7f3d0',
  brand400: '#34d399',
  brand: '#059669',
  brand600: '#059669',
  brand700: '#047857',
  brand800: '#065f46',
  accent50: '#fffbeb',
  accent100: '#fef3c7',
  accent500: '#d97706',
  accent600: '#b45309',
  accent700: '#92400e',
  surface: '#f0fdf4',
  surfaceAlt: '#ecfdf5',
  stone50: '#fafaf9',
  stone100: '#f5f5f4',
  stone200: '#e7e5e4',
  stone300: '#d6d3d1',
  stone400: '#a8a29e',
  stone500: '#78716c',
  stone600: '#57534e',
  stone700: '#44403c',
  stone800: '#292524',
  stone900: '#1c1917',
  white: '#ffffff',
  red50: '#fef2f2',
  red700: '#b91c1c',
  green700: '#15803d',
  // Legacy aliases
  brandDark: '#047857',
  accent: '#d97706',
} as const

export const fonts = {
  sans: 'NunitoSans_400Regular',
  sansSemiBold: 'NunitoSans_600SemiBold',
  display: 'Nunito_400Regular',
  displaySemiBold: 'Nunito_600SemiBold',
  displayBold: 'Nunito_700Bold',
} as const

export const radii = {
  sm: 12,
  md: 14,
  lg: 16,
  xl: 20,
  xxl: 24,
} as const

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  section: 32,
} as const

export const commonStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  screenContent: {
    padding: spacing.lg,
    paddingBottom: 40,
  },
  pageTitle: {
    fontFamily: fonts.displayBold,
    fontSize: 24,
    color: colors.stone900,
  },
  pageSubtitle: {
    marginTop: spacing.xs,
    fontFamily: fonts.sans,
    fontSize: 15,
    lineHeight: 22,
    color: colors.stone600,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radii.xxl,
    borderWidth: 1,
    borderColor: colors.stone200,
    padding: spacing.lg,
  },
  input: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.stone200,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: 16,
    fontFamily: fonts.sans,
    color: colors.stone900,
  },
  primaryBtn: {
    minHeight: 48,
    backgroundColor: colors.brand600,
    borderRadius: radii.xxl,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    color: colors.white,
    fontSize: 16,
    fontFamily: fonts.displaySemiBold,
  },
  secondaryBtn: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.stone200,
    borderRadius: radii.xxl,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
  },
  secondaryBtnText: {
    color: colors.stone700,
    fontFamily: fonts.displaySemiBold,
    fontSize: 15,
  },
  brandChip: {
    backgroundColor: colors.brand50,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  brandChipText: {
    color: colors.brand700,
    fontFamily: fonts.displaySemiBold,
    fontSize: 14,
  },
  amberBanner: {
    backgroundColor: colors.accent50,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  amberBannerText: {
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 20,
    color: colors.accent700,
  },
  errorBanner: {
    backgroundColor: colors.red50,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  errorBannerText: {
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.red700,
  },
  brandPanel: {
    borderRadius: radii.xxl,
    borderWidth: 1,
    borderColor: colors.brand200,
    backgroundColor: 'rgba(236, 253, 245, 0.6)',
    padding: spacing.lg,
  },
  emptyState: {
    marginTop: spacing.section,
    borderRadius: radii.xxl,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.stone300,
    padding: spacing.section,
    alignItems: 'center',
  },
  emptyStateText: {
    fontFamily: fonts.sans,
    fontSize: 15,
    color: colors.stone600,
    textAlign: 'center',
  },
  linkText: {
    marginTop: spacing.md,
    fontFamily: fonts.displaySemiBold,
    fontSize: 15,
    color: colors.brand600,
  },
})

export function disabledStyle(disabled: boolean): ViewStyle {
  return disabled ? { opacity: 0.5 } : {}
}

export function labelStyle(): TextStyle {
  return {
    fontSize: 14,
    fontFamily: fonts.displaySemiBold,
    color: colors.stone700,
    marginBottom: spacing.xs,
  }
}
