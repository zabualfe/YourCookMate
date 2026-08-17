import { useQuery } from '@tanstack/react-query'
import { getBillingPlans } from '../api/client'
import { useAuth } from '../context/AuthContext'

/** Ads are shown to guests and free-plan users, never to Pro. */
export function useShowAds() {
  const { user, loading, isAuthenticated } = useAuth()
  const { data: billing } = useQuery({
    queryKey: ['billing-plans'],
    queryFn: getBillingPlans,
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
  })

  if (loading) return false
  const isPro = billing?.is_pro ?? user?.is_pro ?? false
  return !isPro
}
