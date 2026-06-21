import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { updateRecipeShare } from '../api/client'
import { LinkIcon } from './icons'
import type { ShareResponse } from '../types/collection'

interface SharePanelProps {
  recipeId: string
  initial: Pick<ShareResponse, 'is_public' | 'share_url'>
  variant?: 'panel' | 'popover'
  onClose?: () => void
}

export function SharePanel({ recipeId, initial, variant = 'panel', onClose }: SharePanelProps) {
  const queryClient = useQueryClient()
  const [isPublic, setIsPublic] = useState(initial.is_public)
  const [shareUrl, setShareUrl] = useState(initial.share_url ?? '')
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: (enabled: boolean) => updateRecipeShare(recipeId, enabled),
    onSuccess: (data) => {
      setIsPublic(data.is_public)
      setShareUrl(data.share_url ?? '')
      queryClient.invalidateQueries({ queryKey: ['recipe', recipeId] })
    },
    onError: (err) => setError(err instanceof Error ? err.message : 'Failed to update sharing'),
  })

  const handleToggle = () => {
    setError('')
    mutation.mutate(!isPublic)
  }

  const handleCopy = async () => {
    if (!shareUrl) return
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('Could not copy link')
    }
  }

  const content = (
    <>
      <p className="text-sm text-stone-600">
        {isPublic
          ? 'Anyone with the link can view and cook this recipe.'
          : 'Create a public link to share with friends.'}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleToggle}
          disabled={mutation.isPending}
          className={`rounded-xl px-4 py-2 text-sm font-semibold transition disabled:opacity-50 ${
            isPublic
              ? 'bg-stone-100 text-stone-700 hover:bg-stone-200'
              : 'bg-brand-600 text-white hover:bg-brand-700'
          }`}
        >
          {mutation.isPending ? 'Updating…' : isPublic ? 'Stop sharing' : 'Share link'}
        </button>
        {isPublic && (
          <span className="rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700">
            Public
          </span>
        )}
      </div>

      {isPublic && shareUrl && (
        <div className="mt-3 flex gap-2">
          <input
            readOnly
            value={shareUrl}
            className="min-w-0 flex-1 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-700"
          />
          <button
            type="button"
            onClick={handleCopy}
            className="shrink-0 rounded-xl border border-stone-200 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      )}

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </>
  )

  if (variant === 'popover') {
    return (
      <div className="w-80 rounded-2xl border border-stone-200 bg-white p-4 shadow-lg">
        <div className="mb-3 flex items-center justify-between">
          <p className="font-semibold text-stone-900">Share recipe</p>
          {onClose && (
            <button type="button" onClick={onClose} className="text-stone-400 hover:text-stone-600">
              ✕
            </button>
          )}
        </div>
        {content}
      </div>
    )
  }

  return (
    <div className="mt-8 rounded-2xl border border-stone-200 bg-white p-5">
      <h2 className="font-semibold text-stone-900">Share recipe</h2>
      {content}
    </div>
  )
}

export function ShareQuickAdd({
  recipeId,
  initial,
  isPublic,
}: {
  recipeId: string
  initial: Pick<ShareResponse, 'is_public' | 'share_url'>
  isPublic?: boolean
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={[
          'inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-sm font-medium transition',
          isPublic
            ? 'border-green-200 bg-green-50 text-green-800 hover:bg-green-100'
            : 'border-stone-200 text-stone-700 hover:bg-stone-50',
        ].join(' ')}
      >
        <LinkIcon />
        Share
      </button>
      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-30 cursor-default"
            aria-label="Close"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-full z-40 mt-2">
            <SharePanel
              recipeId={recipeId}
              initial={initial}
              variant="popover"
              onClose={() => setOpen(false)}
            />
          </div>
        </>
      )}
    </div>
  )
}
