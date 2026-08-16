import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Layout } from '../components/Layout'
import { getBillingPlans } from '../api/client'
import { useAuth } from '../context/AuthContext'

export function BillingSuccessPage() {
  const { isAuthenticated, refreshUser } = useAuth()
  const { data, refetch } = useQuery({
    queryKey: ['billing-plans'],
    queryFn: getBillingPlans,
    enabled: isAuthenticated,
    refetchInterval: (query) => (query.state.data?.is_pro ? false : 2000),
  })

  useEffect(() => {
    void refreshUser()
    const timer = window.setTimeout(() => {
      void refreshUser()
      void refetch()
    }, 1500)
    return () => window.clearTimeout(timer)
  }, [refreshUser, refetch])

  const isPro = data?.is_pro

  return (
    <Layout>
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-stone-900">
          {isPro ? 'You’re on Pro' : 'Activating Pro…'}
        </h1>
        <p className="mt-3 text-stone-600">
          {isPro
            ? 'You now get 10 uploads a day, 3-minute videos, and recipes that stay in your library.'
            : 'Stripe is confirming your subscription. This page will update in a few seconds.'}
        </p>
        <div className="mt-8 flex justify-center gap-4">
          <Link
            to="/new"
            className="rounded-xl bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-800"
          >
            Add a recipe
          </Link>
          <Link to="/recipes" className="rounded-xl px-5 py-2.5 text-sm font-semibold text-stone-700 hover:bg-stone-100">
            My recipes
          </Link>
        </div>
      </div>
    </Layout>
  )
}
