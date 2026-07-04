import { useState } from 'react'
import { Platform, Pressable, StyleSheet, Text } from 'react-native'
import * as AppleAuthentication from 'expo-apple-authentication'
import { fetchMe, loginWithApple, setToken } from '@/api/client'
import { useAuth } from '@/context/AuthContext'
import { colors } from '@/constants/theme'
import { isAppleSignInConfigured } from '@/lib/oauthConfig'
import { signInWithApple } from '@/lib/appleAuth'

interface AppleSignInButtonProps {
  onError: (message: string) => void
  onSuccess?: () => void
}

export function AppleSignInButton({ onError, onSuccess }: AppleSignInButtonProps) {
  const { setSession } = useAuth()
  const [busy, setBusy] = useState(false)

  if (!isAppleSignInConfigured()) return null

  const handlePress = async () => {
    if (busy) return
    setBusy(true)
    try {
      const { identityToken, displayName } = await signInWithApple()
      const res = await loginWithApple(identityToken, displayName)
      await setToken(res.access_token)
      const user = await fetchMe()
      await setSession(res.access_token, user)
      onSuccess?.()
    } catch (err) {
      if (
        err &&
        typeof err === 'object' &&
        'code' in err &&
        err.code === AppleAuthentication.AppleAuthenticationErrorCode.CANCELED
      ) {
        return
      }
      onError(err instanceof Error ? err.message : 'Apple sign-in failed')
    } finally {
      setBusy(false)
    }
  }

  if (Platform.OS === 'ios') {
    return (
      <AppleAuthentication.AppleAuthenticationButton
        buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
        buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
        cornerRadius={16}
        style={styles.appleNative}
        onPress={() => void handlePress()}
      />
    )
  }

  return (
    <Pressable style={styles.button} onPress={() => void handlePress()} disabled={busy}>
      <Text style={styles.label}>Continue with Apple</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  appleNative: {
    width: '100%',
    height: 52,
  },
  button: {
    backgroundColor: colors.stone900,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  label: { fontSize: 16, fontWeight: '600', color: colors.white },
})
