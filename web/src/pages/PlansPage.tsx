import { Link } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Layout } from '../components/Layout'
import { useAuth } from '../context/AuthContext'
import { getBillingPlans, startCheckout } from '../api/client'
import { ProBillingActions } from '../components/ProBillingActions'
import { videoLimitLabel, type PlanLimits } from '../types/billing'

const FALLBACK_PLANS: PlanLimits[] = [
  {
    id: 'free',
    name: 'Free',
    uploads_per_day: 2,
    max_video_seconds: 60,
    visibility_days: 14,
    price_display: 'Free',
  },
  {
    id: 'pro',
    name: 'Pro',
    uploads_per_day: 10,
    max_video_seconds: 180,
    visibility_days: null,
    price_display: '$7.99/month',
  },
]

function planFeatures(plan: PlanLimits): string[] {
  const features = [
    `${plan.uploads_per_day} uploads a day`,
    `Videos up to ${videoLimitLabel(plan.max_video_seconds)}`,
  ]
  if (plan.visibility_days) {
    features.push(`${plan.visibility_days}-day recipe viewing window`)
  } else {
    features.push('Recipes stay in your library')
  }
  return features
}

export function PlansPage() {
  const { user, isAuthenticated, loading } = useAuth()
  const { data: billing } = useQuery({
    queryKey: ['billing-plans'],
    queryFn: getBillingPlans,
    enabled: isAuthenticated,
  })
  const checkout = useMutation({
    mutationFn: () => startCheckout('/billing/success', '/plans'),
    onSuccess: (data) => {
      window.location.href = data.url
    },
  })

  const isPro = billing?.is_pro ?? user?.is_pro ?? false
  const configured = billing?.billing_configured ?? false
  const plans = billing?.plans?.length ? billing.plans : FALLBACK_PLANS

  return (
    <Layout>
      <div className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-2xl font-bold text-stone-900">Plans</h1>
        <p className="mt-2 text-sm text-stone-600">
          Free is enough to try Your Cook Mate. Pro keeps your recipes and raises the daily limits.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {plans.map((plan) => {
            const current = plan.id === 'pro' ? isPro : !isPro
            const isProPlan = plan.id === 'pro'
            return (
              <section
                key={plan.id}
                className={[
                  'flex flex-col rounded-2xl border bg-white p-6',
                  isProPlan ? 'border-brand-200 shadow-sm shadow-brand-100/60' : 'border-stone-200',
                ].join(' ')}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-stone-900">{plan.name}</h2>
                    <p className="mt-1 text-sm font-medium text-stone-700">
                      {plan.price_display ?? (isProPlan ? '$7.99/month' : 'Free')}
                    </p>
                  </div>
                  {current && (
                    <span
                      className={[
                        'rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide',
                        isProPlan && billing?.cancel_at_period_end
                          ? 'bg-amber-50 text-amber-800'
                          : 'bg-stone-100 text-stone-600',
                      ].join(' ')}
                    >
                      {isProPlan && billing?.cancel_at_period_end ? 'Cancels soon' : 'Current'}
                    </span>
                  )}
                </div>
                <ul className="mt-4 flex-1 space-y-2 text-sm text-stone-600">
                  {planFeatures(plan).map((feature) => (
                    <li key={feature}>{feature}</li>
                  ))}
                </ul>
                <div className="mt-6">
                  {isProPlan ? (
                    isPro && billing ? (
                      <ProBillingActions billing={billing} />
                    ) : !isAuthenticated ? (
                      <Link
                        to="/login?redirect=/plans"
                        className="block w-full rounded-full bg-brand-700 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-brand-800"
                      >
                        Sign in to upgrade
                      </Link>
                    ) : (
                      <button
                        type="button"
                        disabled={checkout.isPending || !configured}
                        onClick={() => checkout.mutate()}
                        className="w-full rounded-full bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
                      >
                        {checkout.isPending ? 'Redirecting…' : configured ? 'Upgrade to Pro' : 'Checkout unavailable'}
                      </button>
                    )
                  ) : (
                    <p className="text-center text-sm text-stone-500">
                      {current ? 'You’re on Free' : 'Included with every account'}
                    </p>
                  )}
                </div>
              </section>
            )
          })}
        </div>

        {checkout.error && (
          <p className="mt-4 text-sm text-red-700">
            {checkout.error instanceof Error ? checkout.error.message : 'Something went wrong'}
          </p>
        )}

        {loading && <p className="mt-4 text-sm text-stone-500">Loading your plan…</p>}
      </div>
    </Layout>
  )
}
