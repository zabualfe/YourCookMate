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
} from 'react-native'
import { register } from '@/api/client'
import { GoogleSignInButton, OAuthDivider } from '@/components/GoogleSignInButton'
import { useAuth } from '@/context/AuthContext'
import { colors } from '@/constants/theme'

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
      <Text style={styles.title}>Create account</Text>
      <TextInput
        value={displayName}
        onChangeText={setDisplayName}
        placeholder="Display name (optional)"
        style={styles.input}
      />
      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        style={styles.input}
      />
      <TextInput
        value={password}
        onChangeText={setPassword}
        placeholder="Password"
        secureTextEntry
        style={styles.input}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable style={styles.primaryBtn} onPress={handleRegister} disabled={loading}>
        {loading ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Text style={styles.primaryBtnText}>Sign up</Text>
        )}
      </Pressable>
      <OAuthDivider />
      <GoogleSignInButton onError={setError} onSuccess={() => router.back()} />
      <Link href="/login" asChild>
        <Pressable style={styles.linkBtn}>
          <Text style={styles.linkText}>Already have an account?</Text>
        </Pressable>
      </Link>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center', backgroundColor: colors.stone50 },
  title: { fontSize: 28, fontWeight: '800', color: colors.stone900, marginBottom: 24 },
  input: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.stone200,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
    marginBottom: 12,
  },
  primaryBtn: {
    backgroundColor: colors.brand,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryBtnText: { color: colors.white, fontWeight: '700', fontSize: 16 },
  linkBtn: { marginTop: 16, alignItems: 'center' },
  linkText: { color: colors.brand, fontWeight: '600' },
  error: { color: colors.red700, marginBottom: 8 },
})
