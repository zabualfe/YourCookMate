import Constants from 'expo-constants'
import { Platform } from 'react-native'

/** Host from Expo/Metro (e.g. 192.168.1.186) — same machine as the dev servers. */
function devHostFromExpo(): string | null {
  const hostUri =
    Constants.expoGoConfig?.debuggerHost ??
    Constants.expoConfig?.hostUri ??
    (Constants.manifest2 as { extra?: { expoClient?: { hostUri?: string } } } | null)?.extra
      ?.expoClient?.hostUri

  if (!hostUri) return null
  const host = hostUri.split(':')[0]
  if (!host || host === 'localhost' || host === '127.0.0.1') return null
  return host
}

function resolveDevUrl(envValue: string | undefined, port: number, fallback: string): string {
  // Explicit LAN URL in .env — always honor it (required for physical iPhone).
  if (envValue && !envValue.includes('127.0.0.1') && !envValue.includes('localhost')) {
    return envValue
  }

  // Physical device: 127.0.0.1 is the phone itself, not your Mac.
  if (Constants.isDevice) {
    const host = devHostFromExpo()
    if (host) {
      return `http://${host}:${port}`
    }
    return envValue ?? fallback
  }

  // iOS Simulator / Android emulator: localhost aliases to the dev machine.
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:8000'
  }
  return envValue ?? 'http://127.0.0.1:8000'
}

/** Default API base for local dev. Override with EXPO_PUBLIC_API_URL in .env */
export const API_URL = resolveDevUrl(
  process.env.EXPO_PUBLIC_API_URL,
  8000,
  Platform.OS === 'android' ? 'http://10.0.2.2:8000' : 'http://127.0.0.1:8000',
)
