import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Layout } from '../components/Layout'
import { InstacartConnectCard } from '../components/InstacartConnectCard'
import { UpgradePaywall } from '../components/UpgradePaywall'
import { useAuth } from '../context/AuthContext'
import { getBillingPlans } from '../api/client'
import { ProBillingActions } from '../components/ProBillingActions'
import { uploadsLeftLabel, videoLimitLabel } from '../types/billing'

export function ProfilePage() {
  const { user, isAuthenticated, loading } = useAuth()
  const { data: billing } = useQuery({
    queryKey: ['billing-plans'],
    queryFn: getBillingPlans,
    enabled: isAuthenticated,
  })

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
        <div className="mx-auto max-w-lg px-4 py-16 text-center">
          <p className="text-stone-600">Please sign in to view your profile.</p>
          <Link to="/login" className="mt-4 inline-block font-medium text-brand-600">
            Sign in
          </Link>
        </div>
      </Layout>
    )
  }

  const usage = billing?.usage
  const isPro = billing?.is_pro ?? user.is_pro

  return (
    <Layout>
      <div className="mx-auto max-w-lg px-4 py-10">
        <h1 className="text-2xl font-bold text-stone-900">Profile</h1>

        <div className="mt-8 flex items-center gap-4 rounded-2xl border border-stone-200 bg-white p-6">
          {user.avatar_url ? (
            <img
              src={user.avatar_url}
              alt=""
              className="h-16 w-16 rounded-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-100 text-lg font-semibold text-brand-800">
              {(user.display_name ?? user.email).slice(0, 2).toUpperCase()}
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold text-stone-900">
              {user.display_name ?? user.email.split('@')[0]}
            </p>
            <p className="truncate text-sm text-stone-500">{user.email}</p>
            <p className="mt-1 text-xs text-stone-500">
              {isPro ? (
                <span className="font-medium text-brand-700">
                  {billing?.cancel_at_period_end ? 'Pro · canceling' : 'Pro'}
                </span>
              ) : (
                <span>Free plan</span>
              )}
              {' · '}
              {user.email_verified ? (
                <span className="text-green-700">Email verified</span>
              ) : (
                <span>
                  Email not verified —{' '}
                  <Link to="/verify-email" className="font-medium text-brand-600">
                    verify now
                  </Link>
                </span>
              )}
            </p>
          </div>
        </div>

        <section className="mt-6 rounded-2xl border border-stone-200 bg-white p-6">
          <h2 className="text-base font-semibold text-stone-900">Plan</h2>
          {usage && (
            <p className="mt-1 text-sm text-stone-600">
              {uploadsLeftLabel(usage)} · videos up to {videoLimitLabel(usage.max_video_seconds)}
              {usage.visibility_days ? ` · ${usage.visibility_days}-day viewing window` : ' · recipes stay in your library'}
            </p>
          )}
          <ul className="mt-4 space-y-2 text-sm text-stone-600">
            <li>
              <span className="font-medium text-stone-800">Free:</span> 2 uploads/day, 1-minute videos,
              14-day recipe access
            </li>
            <li>
              <span className="font-medium text-stone-800">Pro:</span> 10 uploads/day, 3-minute videos,
              unlimited viewing
              {billing?.plans.find((p) => p.id === 'pro')?.price_display
                ? ` (${billing.plans.find((p) => p.id === 'pro')?.price_display})`
                : ''}
            </li>
          </ul>
          <div className="mt-4">
            {isPro && billing ? (
              <ProBillingActions billing={billing} />
            ) : (
              <UpgradePaywall reason="upgrade" usage={usage} compact />
            )}
          </div>
        </section>

        <InstacartConnectCard />

        <Link
          to="/recipes"
          className="mt-6 inline-flex text-sm font-medium text-brand-600 hover:text-brand-700"
        >
          View my recipes →
        </Link>
      </div>
    </Layout>
  )
}
