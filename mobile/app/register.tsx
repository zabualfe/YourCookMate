import { Link, router } from 'expo-router'
import { useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { register } from '@/api/client'
import { AppleSignInButton } from '@/components/AppleSignInButton'
import { GoogleSignInButton } from '@/components/GoogleSignInButton'
import { OAuthDivider } from '@/components/OAuthDivider'
import { BrandLogo } from '@/components/BrandLogo'
import { useAuth } from '@/context/AuthContext'
import { colors, commonStyles, fonts, spacing } from '@/constants/theme'

export default function RegisterScreen() {
  const { setSession } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleRegister = async () => {
    setError('')
    setLoading(true)
    try {
      const res = await register(email.trim(), password, displayName.trim() || undefined)
      await setSession(res.access_token, res.user)
      router.back()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.brandWrap}>
        <BrandLogo />
      </View>
      <Text style={styles.title}>Create account</Text>
      <Text style={styles.subtitle}>Start saving recipes and cooking step by step.</Text>

      <TextInput
        value={displayName}
        onChangeText={setDisplayName}
        placeholder="Display name (optional)"
        placeholderTextColor={colors.stone400}
        style={commonStyles.input}
      />
      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="Email"
        placeholderTextColor={colors.stone400}
        autoCapitalize="none"
        keyboardType="email-address"
        style={[commonStyles.input, { marginTop: spacing.md }]}
      />
      <TextInput
        value={password}
        onChangeText={setPassword}
        placeholder="Password"
        placeholderTextColor={colors.stone400}
        secureTextEntry
        style={[commonStyles.input, { marginTop: spacing.md }]}
      />
      {error ? (
        <View style={[commonStyles.errorBanner, { marginTop: spacing.md }]}>
          <Text style={commonStyles.errorBannerText}>{error}</Text>
        </View>
      ) : null}
      <Pressable
        style={[commonStyles.primaryBtn, { marginTop: spacing.lg }, loading && { opacity: 0.7 }]}
        onPress={handleRegister}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Text style={commonStyles.primaryBtnText}>Sign up</Text>
        )}
      </Pressable>
      <OAuthDivider />
      <GoogleSignInButton onError={setError} onSuccess={() => router.back()} />
      <View style={{ height: spacing.md }} />
      <AppleSignInButton onError={setError} onSuccess={() => router.back()} />
      <Link href="/login" asChild>
        <Pressable style={styles.linkBtn}>
          <Text style={styles.linkText}>Already have an account?</Text>
        </Pressable>
      </Link>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.xxl,
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  brandWrap: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  title: {
    fontFamily: fonts.displayBold,
    fontSize: 28,
    color: colors.stone900,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontFamily: fonts.sans,
    fontSize: 15,
    color: colors.stone600,
    marginBottom: spacing.xxl,
  },
  linkBtn: {
    marginTop: spacing.lg,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  linkText: {
    fontFamily: fonts.displaySemiBold,
    color: colors.brand600,
    fontSize: 15,
  },
})
