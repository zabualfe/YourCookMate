import { Navigate, useLocation } from 'react-router-dom'
import { useFeatures } from '../context/FeaturesContext'

interface FeatureGateProps {
  flag: keyof ReturnType<typeof useFeatures>
  children: React.ReactNode
  fallbackTo?: string
}

export function FeatureGate({ flag, children, fallbackTo = '/' }: FeatureGateProps) {
  const features = useFeatures()
  const location = useLocation()

  if (!features[flag]) {
    return <Navigate to={fallbackTo} replace state={{ from: location.pathname, featureDisabled: flag }} />
  }

  return children
}
