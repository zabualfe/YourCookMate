import { useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useShowAds } from '../hooks/useShowAds'
import { getAdsByGoogle } from '../lib/adsense'

/** Holds AdSense requests until we know the viewer is not Pro, then resumes for free users. */
export function AdSenseGate() {
  const { loading } = useAuth()
  const showAds = useShowAds()

  useEffect(() => {
    const ads = getAdsByGoogle()
    ads.pauseAdRequests = loading || !showAds ? 1 : 0
  }, [loading, showAds])

  return null
}
