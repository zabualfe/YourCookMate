import { createContext, useContext, useEffect, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getFeatures, type AppFeatures } from '../api/client'
import { configureAwsIngestBase } from '../api/ingest'

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

  useEffect(() => {
    configureAwsIngestBase(data?.aws_api_url)
  }, [data?.aws_api_url])

  return (
    <FeaturesContext.Provider value={data ?? DEFAULT_FEATURES}>{children}</FeaturesContext.Provider>
  )
}

export function useFeatures() {
  return useContext(FeaturesContext)
}
