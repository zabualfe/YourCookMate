import { GoogleLogin, GoogleOAuthProvider } from '@react-oauth/google'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { loginWithApple, loginWithGoogle } from '../api/client'
import { postAuthPath } from '../lib/authRedirect'
import { useState } from 'react'

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined
const appleClientId = import.meta.env.VITE_APPLE_CLIENT_ID as string | undefined

interface OAuthButtonsProps {
  onError: (message: string) => void
  redirect?: string
}

function GoogleButton({ onError, redirect = '/recipes' }: OAuthButtonsProps) {
  const { setSession } = useAuth()
  const navigate = useNavigate()

  if (!googleClientId) return null

  return (
    <GoogleOAuthProvider clientId={googleClientId}>
      <div className="flex justify-center">
        <GoogleLogin
          onSuccess={async (response) => {
            if (!response.credential) {
              onError('Google sign-in failed')
              return
            }
            try {
              const data = await loginWithGoogle(response.credential)
              setSession(data.access_token, data.user)
              navigate(postAuthPath(data.user, redirect))
            } catch (err) {
              onError(err instanceof Error ? err.message : 'Google sign-in failed')
            }
          }}
          onError={() => onError('Google sign-in was cancelled')}
          theme="outline"
          size="large"
          width="100%"
          text="continue_with"
        />
      </div>
    </GoogleOAuthProvider>
  )
}

declare global {
  interface Window {
    AppleID?: {
      auth: {
        init: (config: object) => void
        signIn: () => Promise<{ authorization: { id_token: string } }>
      }
    }
  }
}

function AppleButton({ onError, redirect = '/recipes' }: OAuthButtonsProps) {
  const { setSession } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)

  if (!appleClientId) return null

  const loadAppleScript = () =>
    new Promise<void>((resolve, reject) => {
      if (window.AppleID) {
        resolve()
        return
      }
      const script = document.createElement('script')
      script.src =
        'https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js'
      script.onload = () => resolve()
      script.onerror = () => reject(new Error('Failed to load Apple Sign In'))
      document.head.appendChild(script)
    })

  const handleApple = async () => {
    setLoading(true)
    try {
      await loadAppleScript()
      window.AppleID!.auth.init({
        clientId: appleClientId,
        scope: 'name email',
        redirectURI: window.location.origin,
        usePopup: true,
      })
      const res = await window.AppleID!.auth.signIn()
      const data = await loginWithApple(res.authorization.id_token)
      setSession(data.access_token, data.user)
      navigate(postAuthPath(data.user, redirect))
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Apple sign-in failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleApple}
      disabled={loading}
      className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-stone-300 bg-black px-4 py-2.5 text-sm font-medium text-white transition hover:bg-stone-900 disabled:opacity-50"
    >
      {loading ? 'Signing in…' : 'Continue with Apple'}
    </button>
  )
}

export function OAuthButtons({ onError, redirect = '/recipes' }: OAuthButtonsProps) {
  const showDivider = googleClientId || appleClientId

  if (!showDivider) return null

  return (
    <div className="space-y-3">
      <div className="relative py-2">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-stone-200" />
        </div>
        <div className="relative flex justify-center text-xs uppercase tracking-wide">
          <span className="bg-stone-50 px-2 text-stone-400">or continue with</span>
        </div>
      </div>
      <GoogleButton onError={onError} redirect={redirect} />
      <AppleButton onError={onError} redirect={redirect} />
    </div>
  )
}
