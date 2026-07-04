import { View, Text, StyleSheet } from 'react-native'
import { colors } from '@/constants/theme'
import { isAnyOAuthConfigured } from '@/lib/oauthConfig'

export function OAuthDivider() {
  if (!isAnyOAuthConfigured()) return null

  return (
    <View style={styles.dividerRow}>
      <View style={styles.dividerLine} />
      <Text style={styles.dividerText}>or continue with</Text>
      <View style={styles.dividerLine} />
    </View>
  )
}

const styles = StyleSheet.create({
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 20,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.stone200 },
  dividerText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.stone500,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
})
