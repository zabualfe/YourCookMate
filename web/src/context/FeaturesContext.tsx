import { createContext, useContext, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getFeatures, type AppFeatures } from '../api/client'

const DEFAULT_FEATURES: AppFeatures = {
  auth: true,
  registration: true,
  ai: true,
  social_ingest: true,
  community: true,
  instacart: false,
  instacart_shopping: false,
  instacart_connect: false,
}

const FeaturesContext = createContext<AppFeatures>(DEFAULT_FEATURES)

export function FeaturesProvider({ children }: { children: ReactNode }) {
  const { data } = useQuery({
    queryKey: ['features'],
    queryFn: getFeatures,
    staleTime: 10_000,
    refetchInterval: 15_000,
  })

  return (
    <FeaturesContext.Provider value={data ?? DEFAULT_FEATURES}>{children}</FeaturesContext.Provider>
  )
}

export function useFeatures() {
  return useContext(FeaturesContext)
}
