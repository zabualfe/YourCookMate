import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { useAuth } from '../context/AuthContext'
import { resendVerification } from '../api/client'
import { peekDevVerifyUrl, storeDevVerifyUrl } from '../lib/authRedirect'

export function VerifyEmailPage() {
  const [params] = useSearchParams()
  const redirect = params.get('redirect') ?? '/recipes'
  const { user, isAuthenticated, loading, refreshUser } = useAuth()
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)
  const [devLink, setDevLink] = useState<string | null>(null)

  useEffect(() => {
    setDevLink(peekDevVerifyUrl())
  }, [])

  const handleResend = async () => {
    setError('')
    setMessage('')
    setSending(true)
    try {
      const res = await resendVerification()
      setMessage(res.message)
      if (res.verification_url) {
        storeDevVerifyUrl(res.verification_url)
        setDevLink(res.verification_url)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send email')
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return (
      <Layout>
        <div className="px-4 py-16 text-center text-stone-500">Loading…</div>
      </Layout>
    )
  }

  if (!isAuthenticated || !user) {
    return (
      <Layout>
        <div className="mx-auto max-w-md px-4 py-16 text-center">
          <p className="text-stone-600">Sign in to verify your email.</p>
          <Link to="/login" className="mt-4 inline-block font-medium text-brand-600">
            Sign in
          </Link>
        </div>
      </Layout>
    )
  }

  if (user.email_verified) {
    return (
      <Layout>
        <div className="mx-auto max-w-md px-4 py-16 text-center">
          <h1 className="text-2xl font-bold text-stone-900">Email verified</h1>
          <p className="mt-2 text-stone-600">You&apos;re all set.</p>
          <Link
            to={redirect}
            className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-brand-600 px-6 font-semibold text-white hover:bg-brand-700"
          >
            Continue
          </Link>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="mx-auto max-w-md px-4 py-12">
        <h1 className="text-2xl font-bold text-stone-900">Verify your email</h1>
        <p className="mt-2 text-stone-600">
          We sent a verification link to <strong className="text-stone-800">{user.email}</strong>.
          Open it to save recipes to your library.
        </p>

        {devLink && (
          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-medium text-amber-950">Email couldn&apos;t be delivered</p>
            <p className="mt-1 text-sm text-amber-900">
              Resend&apos;s free tier only sends to your Resend account email until you verify a domain.
              Use this link instead:
            </p>
            <a
              href={devLink}
              className="mt-3 block break-all text-sm font-semibold text-brand-700 underline hover:text-brand-800"
            >
              Verify my email
            </a>
          </div>
        )}

        <div className="mt-8 rounded-2xl border border-stone-200 bg-white p-6">
          <p className="text-sm text-stone-600">
            Didn&apos;t get it? Check spam, or resend the link below.
          </p>
          <button
            type="button"
            onClick={handleResend}
            disabled={sending}
            className="mt-4 flex min-h-11 w-full items-center justify-center rounded-xl bg-brand-600 font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
          >
            {sending ? 'Sending…' : 'Resend verification email'}
          </button>
          <button
            type="button"
            onClick={() => refreshUser()}
            className="mt-3 w-full text-sm font-medium text-brand-600 hover:text-brand-700"
          >
            I verified — refresh status
          </button>
        </div>

        {message && (
          <p className="mt-4 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-800">{message}</p>
        )}
        {error && (
          <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
        )}

        <p className="mt-8 text-center text-sm text-stone-500">
          You can still{' '}
          <Link to="/new" className="font-medium text-brand-600">
            parse and cook recipes
          </Link>{' '}
          without verifying — saving to your library requires verification.
        </p>
      </div>
    </Layout>
  )
}
