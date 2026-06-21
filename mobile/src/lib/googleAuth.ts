import Constants from 'expo-constants'
import * as Linking from 'expo-linking'
import * as WebBrowser from 'expo-web-browser'
import { API_URL } from '@/constants/api'

WebBrowser.maybeCompleteAuthSession()

export function isGoogleSignInConfigured(): boolean {
  return !!process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID
}

function assertCanSignInWithGoogle(): void {
  if (Constants.appOwnership === 'expo' && Constants.isDevice) {
    throw new Error(
      'Google sign-in in Expo Go only works in the iOS Simulator. Use email sign-in on a physical device.',
    )
  }
}

export async function signInWithGoogle(): Promise<string> {
  assertCanSignInWithGoogle()

  const returnUri = Linking.createURL('auth')
  const startUrl = `${API_URL}/auth/google/mobile/start?return_uri=${encodeURIComponent(returnUri)}`

  let result: WebBrowser.WebBrowserAuthSessionResult
  try {
    result = await WebBrowser.openAuthSessionAsync(startUrl, returnUri)
  } catch {
    throw new Error(
      `Could not reach the API at ${API_URL}. Make sure npm run dev is running.`,
    )
  }

  if (result.type === 'cancel' || result.type === 'dismiss') {
    throw new Error('Google sign-in was cancelled')
  }
  if (result.type !== 'success' || !result.url) {
    throw new Error('Google sign-in failed. Check backend/.env has GOOGLE_CLIENT_SECRET set.')
  }

  const { queryParams } = Linking.parse(result.url)
  const token = queryParams?.token
  if (typeof token !== 'string' || !token) {
    throw new Error('Google sign-in failed — no token returned')
  }

  return token
}
