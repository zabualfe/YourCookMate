import { GoogleLogin, GoogleOAuthProvider } from '@react-oauth/google'
import { useSearchParams } from 'react-router-dom'
import { useState } from 'react'
import { loginWithGoogle } from '../api/client'

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined

function isAllowedReturnUri(uri: string): boolean {
  try {
    const parsed = new URL(uri)
    // Standalone / dev builds
    if (parsed.protocol === 'yourcookmate:') return true
    // Expo Go during local development
    if (parsed.protocol === 'exp:') return true
    return false
  } catch {
    return false
  }
}

export function AuthMobilePage() {
  const [params] = useSearchParams()
  const returnUri = params.get('return') ?? ''
  const [error, setError] = useState('')

  if (!googleClientId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50 px-6">
        <p className="text-center text-stone-600">Google sign-in is not configured.</p>
      </div>
    )
  }

  if (!returnUri || !isAllowedReturnUri(returnUri)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50 px-6">
        <p className="text-center text-stone-600">Invalid mobile sign-in request.</p>
      </div>
    )
  }

  const redirectToApp = (token: string) => {
    const separator = returnUri.includes('?') ? '&' : '?'
    window.location.href = `${returnUri}${separator}token=${encodeURIComponent(token)}`
  }

  return (
    <GoogleOAuthProvider clientId={googleClientId}>
      <div className="flex min-h-screen flex-col items-center justify-center bg-stone-50 px-6">
        <div className="w-full max-w-sm space-y-6 text-center">
          <div>
            <h1 className="text-2xl font-bold text-stone-900">Your Cook Mate</h1>
            <p className="mt-2 text-stone-600">Sign in with Google to continue in the app.</p>
          </div>

          {error ? (
            <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
          ) : null}

          <div className="flex justify-center">
            <GoogleLogin
              onSuccess={async (response) => {
                if (!response.credential) {
                  setError('Google sign-in failed')
                  return
                }
                try {
                  const data = await loginWithGoogle(response.credential)
                  redirectToApp(data.access_token)
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Google sign-in failed')
                }
              }}
              onError={() => setError('Google sign-in was cancelled')}
              theme="outline"
              size="large"
              width="320"
              text="continue_with"
            />
          </div>
        </div>
      </div>
    </GoogleOAuthProvider>
  )
}
