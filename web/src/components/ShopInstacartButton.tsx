import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createInstacartLink, createSharedInstacartLink, getFeatures } from '../api/client'

type ShopInstacartButtonProps =
  | { recipeId: string; shareSlug?: undefined; className?: string }
  | { shareSlug: string; recipeId?: undefined; className?: string }

export function ShopInstacartButton({ className = '', ...props }: ShopInstacartButtonProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const { data: features } = useQuery({
    queryKey: ['features'],
    queryFn: getFeatures,
    staleTime: 60_000,
  })

  if (!features?.instacart_shopping) {
    return null
  }

  const handleClick = async () => {
    setError('')
    setLoading(true)
    try {
      const result = props.recipeId
        ? await createInstacartLink(props.recipeId)
        : await createSharedInstacartLink(props.shareSlug!)
      window.open(result.url, '_blank', 'noopener,noreferrer')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open Instacart')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="inline-flex min-h-12 flex-col items-start justify-center rounded-2xl border border-[#43b02a]/30 bg-[#f0fdf4] px-6 py-3 text-left transition hover:bg-[#dcfce7] disabled:opacity-50"
      >
        <span className="text-sm font-semibold text-[#15803d]">
          {loading ? 'Opening Instacart…' : 'Shop on Instacart'}
        </span>
        <span className="text-xs text-[#166534]/80">Pick a store and add ingredients to cart</span>
      </button>
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
    </div>
  )
}
