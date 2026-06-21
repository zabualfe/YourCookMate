import { useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { fetchMe, setToken } from '@/api/client'
import { useAuth } from '@/context/AuthContext'
import { colors } from '@/constants/theme'
import { isGoogleSignInConfigured, signInWithGoogle } from '@/lib/googleAuth'

interface GoogleSignInButtonProps {
  onError: (message: string) => void
  onSuccess?: () => void
}

export function GoogleSignInButton({ onError, onSuccess }: GoogleSignInButtonProps) {
  const { setSession } = useAuth()
  const [loading, setLoading] = useState(false)

  if (!isGoogleSignInConfigured()) return null

  const handlePress = async () => {
    setLoading(true)
    try {
      const token = await signInWithGoogle()
      await setToken(token)
      const user = await fetchMe()
      await setSession(token, user)
      onSuccess?.()
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Google sign-in failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Pressable style={styles.button} onPress={() => void handlePress()} disabled={loading}>
      {loading ? (
        <ActivityIndicator color={colors.stone800} />
      ) : (
        <View style={styles.content}>
          <Text style={styles.icon}>G</Text>
          <Text style={styles.label}>Continue with Google</Text>
        </View>
      )}
    </Pressable>
  )
}

export function OAuthDivider() {
  if (!isGoogleSignInConfigured()) return null

  return (
    <View style={styles.dividerRow}>
      <View style={styles.dividerLine} />
      <Text style={styles.dividerText}>or continue with</Text>
      <View style={styles.dividerLine} />
    </View>
  )
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.stone200,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  content: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.stone100,
    textAlign: 'center',
    lineHeight: 22,
    fontWeight: '700',
    color: colors.stone700,
    overflow: 'hidden',
  },
  label: { fontSize: 16, fontWeight: '600', color: colors.stone800 },
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
