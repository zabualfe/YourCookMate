import * as AppleAuthentication from 'expo-apple-authentication'

export function formatAppleDisplayName(
  fullName: AppleAuthentication.AppleAuthenticationFullName | null,
): string | undefined {
  if (!fullName) return undefined
  const parts = [fullName.givenName, fullName.familyName].filter(Boolean)
  const name = parts.join(' ').trim()
  return name || undefined
}

export async function signInWithApple(): Promise<{
  identityToken: string
  displayName?: string
}> {
  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
  })

  if (!credential.identityToken) {
    throw new Error('Apple sign-in did not return an identity token')
  }

  return {
    identityToken: credential.identityToken,
    displayName: formatAppleDisplayName(credential.fullName),
  }
}
