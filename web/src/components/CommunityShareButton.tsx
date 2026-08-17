import { useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, UsersRound, X } from 'lucide-react'
import { updateProfile, updateRecipeCommunity } from '../api/client'
import { useFeatures } from '../context/FeaturesContext'
import { useAuth } from '../context/AuthContext'
import { UsernameField } from './UsernameField'
import { isUsernameRequiredError } from '../api/errors'
import type { RecipeDetailResponse } from '../types/recipe'

interface CommunityShareButtonProps {
  recipeId: string
  recipeTitle: string
  sharedToCommunity: boolean
}

export function CommunityShareButton({
  recipeId,
  recipeTitle,
  sharedToCommunity,
}: CommunityShareButtonProps) {
  const features = useFeatures()
  const { user, refreshUser } = useAuth()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const [username, setUsername] = useState('')
  const [needsUsername, setNeedsUsername] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const confirmRef = useRef<HTMLButtonElement>(null)

  const mutation = useMutation({
    mutationFn: async () => {
      if (!user?.username) {
        const handle = username.trim()
        if (!handle) throw new Error('Choose a username before sharing')
        await updateProfile({ username: handle })
        await refreshUser()
      }
      return updateRecipeCommunity(recipeId, true)
    },
    onSuccess: (shared) => {
      queryClient.setQueryData<RecipeDetailResponse>(['recipe', recipeId], (current) =>
        current
          ? {
              ...current,
              is_public: shared.is_public,
              shared_to_community: shared.shared_to_community ?? true,
              share_slug: shared.share_slug,
              share_url: shared.share_url,
            }
          : current,
      )
      queryClient.invalidateQueries({ queryKey: ['community-recipes'] })
      setOpen(false)
      setError('')
      requestAnimationFrame(() => triggerRef.current?.focus())
    },
    onError: (err) => {
      if (isUsernameRequiredError(err)) {
        setNeedsUsername(true)
      }
      setError(err instanceof Error ? err.message : 'Could not share this recipe')
    },
  })

  useEffect(() => {
    if (!open) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    requestAnimationFrame(() => confirmRef.current?.focus())

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || mutation.isPending) return
      setOpen(false)
      requestAnimationFrame(() => triggerRef.current?.focus())
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, mutation.isPending])

  if (!features.community) return null

  const close = () => {
    if (mutation.isPending) return
    setOpen(false)
    setError('')
    requestAnimationFrame(() => triggerRef.current?.focus())
  }

  const showUsernameField = needsUsername || !user?.username

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          if (sharedToCommunity) return
          setError('')
          setUsername('')
          setNeedsUsername(!user?.username)
          setOpen(true)
        }}
        aria-disabled={sharedToCommunity}
        className={[
          'inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600',
          sharedToCommunity
            ? 'cursor-default border-blue-200 bg-blue-50 text-blue-700'
            : 'cursor-pointer border-blue-600 bg-blue-600 text-white hover:border-blue-700 hover:bg-blue-700',
        ].join(' ')}
      >
        {sharedToCommunity ? (
          <Check className="size-4" strokeWidth={2.25} aria-hidden />
        ) : (
          <UsersRound className="size-4" strokeWidth={2} aria-hidden />
        )}
        {sharedToCommunity ? 'Shared with Community' : 'Share with Community'}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/50 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) close()
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="community-share-title"
            aria-describedby="community-share-description"
            className="w-full max-w-md overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4 border-b border-stone-200 px-5 py-4">
              <div>
                <h2 id="community-share-title" className="text-lg font-semibold text-stone-900">
                  Share with Community?
                </h2>
                <p id="community-share-description" className="mt-1 text-sm leading-relaxed text-stone-600">
                  Are you sure you&apos;d like to share “{recipeTitle}”? It will be public and
                  appear in the Community tab.
                </p>
              </div>
              <button
                type="button"
                onClick={close}
                disabled={mutation.isPending}
                aria-label="Close confirmation"
                className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-stone-500 transition hover:bg-stone-100 hover:text-stone-800 disabled:opacity-50"
              >
                <X className="size-5" aria-hidden />
              </button>
            </div>

            {showUsernameField && (
              <div className="px-5 pt-4">
                <p className="mb-3 text-sm text-stone-600">
                  Pick a username so other cooks can find and follow you.
                </p>
                <UsernameField value={username} onChange={setUsername} autoFocus />
              </div>
            )}

            {error && (
              <p role="alert" className="mx-5 mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </p>
            )}

            <div className="flex flex-col-reverse gap-3 px-5 py-4 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={close}
                disabled={mutation.isPending}
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-stone-200 px-5 py-2.5 text-sm font-semibold text-stone-700 transition hover:bg-stone-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                ref={confirmRef}
                type="button"
                onClick={() => mutation.mutate()}
                disabled={mutation.isPending || (showUsernameField && !username.trim())}
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-wait disabled:opacity-60"
              >
                {mutation.isPending ? 'Sharing…' : 'Yes, share recipe'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
