import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { verifyEmail } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { postAuthPath } from '../lib/authRedirect'

export function VerifyEmailConfirmPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const token = params.get('token')
  const redirect = params.get('redirect') ?? '/recipes'
  const { setSession } = useAuth()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setError('Missing verification token.')
      return
    }

    let cancelled = false

    verifyEmail(token)
      .then((data) => {
        if (cancelled) return
        setSession(data.access_token, data.user)
        setStatus('success')
        navigate(postAuthPath(data.user, redirect), { replace: true })
      })
      .catch((err) => {
        if (cancelled) return
        setStatus('error')
        setError(err instanceof Error ? err.message : 'Verification failed')
      })

    return () => {
      cancelled = true
    }
  }, [token, redirect, setSession, navigate])

  if (status === 'loading') {
    return (
      <Layout>
        <div className="px-4 py-16 text-center text-stone-500">Verifying your email…</div>
      </Layout>
    )
  }

  if (status === 'success') {
    return (
      <Layout>
        <div className="px-4 py-16 text-center text-stone-500">Redirecting…</div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="mx-auto max-w-md px-4 py-12 text-center">
        <h1 className="text-2xl font-bold text-stone-900">Verification failed</h1>
        <p className="mt-2 text-stone-600">{error}</p>
        <Link
          to={`/verify-email?redirect=${encodeURIComponent(redirect)}`}
          className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-brand-600 px-6 font-semibold text-white hover:bg-brand-700"
        >
          Request a new link
        </Link>
      </div>
    </Layout>
  )
}
