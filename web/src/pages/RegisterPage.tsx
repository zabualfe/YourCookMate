import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { OAuthButtons } from '../components/OAuthButtons'
import { useAuth } from '../context/AuthContext'
import { register } from '../api/client'
import { postAuthPath, storeDevVerifyUrl } from '../lib/authRedirect'

export function RegisterPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const redirect = params.get('redirect') ?? '/recipes'
  const { setSession } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await register(email, password, displayName || undefined)
      setSession(data.access_token, data.user)
      storeDevVerifyUrl(data.verification_url)
      navigate(postAuthPath(data.user, redirect))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Layout>
      <div className="mx-auto max-w-md px-4 py-12">
        <h1 className="text-2xl font-bold text-stone-900">Create your account</h1>
        <p className="mt-1 text-stone-600">Save recipes and pick up where you left off.</p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-stone-700">Display name (optional)</span>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-4 py-3 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-stone-700">Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-4 py-3 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-stone-700">Password (8+ characters)</span>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-4 py-3 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20"
            />
          </label>

          {error && (
            <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex min-h-12 w-full items-center justify-center rounded-xl bg-brand-600 font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
          >
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <div className="mt-6">
          <OAuthButtons onError={setError} redirect={redirect} />
        </div>

        <p className="mt-8 text-center text-sm text-stone-600">
          Already have an account?{' '}
          <Link to={`/login?redirect=${encodeURIComponent(redirect)}`} className="font-medium text-brand-600">
            Sign in
          </Link>
        </p>
      </div>
    </Layout>
  )
}
