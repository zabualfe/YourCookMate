import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Pin } from 'lucide-react'
import { updateRecipePin } from '../api/client'
import { useFeatures } from '../context/FeaturesContext'
import type { RecipeDetailResponse } from '../types/recipe'

interface PinRecipeButtonProps {
  recipeId: string
  pinnedRank?: number | null
  sharedToCommunity?: boolean
  compact?: boolean
}

export function PinRecipeButton({
  recipeId,
  pinnedRank,
  sharedToCommunity,
  compact,
}: PinRecipeButtonProps) {
  const features = useFeatures()
  const queryClient = useQueryClient()
  const [error, setError] = useState('')
  const pinned = Boolean(pinnedRank)

  const mutation = useMutation({
    mutationFn: () => updateRecipePin(recipeId, !pinned),
    onSuccess: (updated) => {
      setError('')
      queryClient.setQueryData<RecipeDetailResponse>(['recipe', recipeId], (current) =>
        current ? { ...current, pinned_rank: updated.pinned_rank } : current,
      )
      queryClient.invalidateQueries({ queryKey: ['recipes'] })
      queryClient.invalidateQueries({ queryKey: ['public-profile'] })
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Could not update pin')
    },
  })

  if (!features.community) return null
  if (!sharedToCommunity && !pinned) return null

  const className = pinned
    ? compact
      ? 'inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-brand-50 px-2.5 py-1.5 text-xs font-semibold text-brand-800 hover:bg-brand-100 disabled:opacity-60'
      : 'inline-flex min-h-11 items-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-4 py-2.5 text-sm font-semibold text-brand-800 hover:bg-brand-100 disabled:opacity-60'
    : compact
      ? 'inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-stone-200 px-2.5 py-1.5 text-xs font-semibold text-stone-600 hover:bg-stone-50 disabled:opacity-60'
      : 'inline-flex min-h-11 items-center gap-2 rounded-xl border border-stone-200 px-4 py-2.5 text-sm font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-60'

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending}
        className={className}
        title={pinned ? 'Unpin from your public profile' : 'Pin to your public profile'}
      >
        <Pin className="size-3.5" fill={pinned ? 'currentColor' : 'none'} aria-hidden />
        {mutation.isPending ? 'Saving…' : pinned ? (compact ? `Pinned ${pinnedRank}` : `Pinned · ${pinnedRank}`) : compact ? 'Pin' : 'Pin to profile'}
      </button>
      {error && <span className="max-w-[12rem] text-right text-xs text-red-700">{error}</span>}
    </span>
  )
}
