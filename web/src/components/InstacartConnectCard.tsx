import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  disconnectInstacart,
  getFeatures,
  getInstacartConnectStatus,
  startInstacartConnect,
} from '../api/client'

export function InstacartConnectCard() {
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const [banner, setBanner] = useState<string | null>(null)

  const { data: features } = useQuery({
    queryKey: ['features'],
    queryFn: getFeatures,
    staleTime: 60_000,
  })

  const { data, isLoading } = useQuery({
    queryKey: ['instacart-connect'],
    queryFn: getInstacartConnectStatus,
    enabled: !!features?.instacart,
  })

  useEffect(() => {
    const result = searchParams.get('instacart')
    if (!result) return

    if (result === 'linked') {
      setBanner('Instacart account linked successfully.')
      queryClient.invalidateQueries({ queryKey: ['instacart-connect'] })
    } else if (result === 'error') {
      const message = searchParams.get('message')?.replace(/\+/g, ' ')
      setBanner(message || 'Could not link Instacart account.')
    }

    searchParams.delete('instacart')
    searchParams.delete('message')
    setSearchParams(searchParams, { replace: true })
  }, [queryClient, searchParams, setSearchParams])

  const connectMutation = useMutation({
    mutationFn: () => startInstacartConnect('/profile'),
    onSuccess: ({ authorize_url }) => {
      window.location.href = authorize_url
    },
    onError: (err) => {
      setBanner(err instanceof Error ? err.message : 'Could not start Instacart linking')
    },
  })

  const disconnectMutation = useMutation({
    mutationFn: disconnectInstacart,
    onSuccess: () => {
      setBanner('Disconnected from Your Cook Mate. To fully unlink, contact Instacart support.')
      queryClient.invalidateQueries({ queryKey: ['instacart-connect'] })
    },
  })

  if (!features?.instacart) {
    return null
  }

  if (isLoading) {
    return (
      <div className="mt-6 rounded-2xl border border-stone-200 bg-white p-6 text-sm text-stone-500">
        Checking Instacart connection…
      </div>
    )
  }

  if (!data?.configured) {
    return (
      <div className="mt-6 rounded-2xl border border-stone-200 bg-stone-50 p-6">
        <h2 className="font-semibold text-stone-900">Instacart</h2>
        <p className="mt-2 text-sm text-stone-600">
          When you tap Shop on Instacart, you&apos;ll sign in on Instacart&apos;s site to add
          ingredients to your cart. In-app account linking requires Instacart Connect partner
          credentials from Instacart.
        </p>
      </div>
    )
  }

  return (
    <div className="mt-6 rounded-2xl border border-[#43b02a]/25 bg-[#f0fdf4] p-6">
      <h2 className="font-semibold text-[#15803d]">Instacart account</h2>

      {banner ? (
        <p className="mt-2 rounded-xl bg-white/80 px-3 py-2 text-sm text-stone-700">{banner}</p>
      ) : null}

      {data.linked ? (
        <>
          <p className="mt-2 text-sm text-stone-700">
            Your account is linked to Instacart.
            {data.instacart_plus_member
              ? ` Instacart+ active${data.expired_at ? ` until ${new Date(data.expired_at).toLocaleDateString()}` : ''}.`
              : ' Instacart+ not active on this account.'}
          </p>
          <button
            type="button"
            onClick={() => disconnectMutation.mutate()}
            disabled={disconnectMutation.isPending}
            className="mt-4 text-sm font-medium text-stone-600 underline hover:text-stone-800 disabled:opacity-50"
          >
            {disconnectMutation.isPending ? 'Disconnecting…' : 'Disconnect here'}
          </button>
        </>
      ) : (
        <>
          <p className="mt-2 text-sm text-stone-700">
            Link your Instacart account so we recognize you when you shop recipe ingredients.
          </p>
          <button
            type="button"
            onClick={() => connectMutation.mutate()}
            disabled={connectMutation.isPending}
            className="mt-4 inline-flex min-h-10 items-center rounded-xl bg-[#43b02a] px-5 py-2 text-sm font-semibold text-white hover:bg-[#3a9a24] disabled:opacity-50"
          >
            {connectMutation.isPending ? 'Redirecting…' : 'Connect Instacart account'}
          </button>
        </>
      )}
    </div>
  )
}
