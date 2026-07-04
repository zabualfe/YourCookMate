import { Platform } from 'react-native'
import { isGoogleSignInConfigured } from '@/lib/googleAuth'

export function isAppleSignInConfigured(): boolean {
  return Platform.OS === 'ios'
}

export function isAnyOAuthConfigured(): boolean {
  return isGoogleSignInConfigured() || isAppleSignInConfigured()
}
