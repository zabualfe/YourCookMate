import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  addRecipeToCollection,
  createCollection,
  listCollections,
  removeRecipeFromCollection,
} from '../api/client'
import { RecipeCollectionChips } from './RecipeCollectionChips'
import { FolderIcon } from './icons'
import type { RecipeCollectionTag } from '../types/collection'

interface CollectionPickerProps {
  recipeId: string
  collections?: RecipeCollectionTag[]
  variant?: 'panel' | 'popover'
  onClose?: () => void
}

export function CollectionPicker({
  recipeId,
  collections = [],
  variant = 'panel',
  onClose,
}: CollectionPickerProps) {
  const queryClient = useQueryClient()
  const [newName, setNewName] = useState('')
  const [pendingId, setPendingId] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['collections', recipeId],
    queryFn: () => listCollections(recipeId),
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['collections'] })
    queryClient.invalidateQueries({ queryKey: ['collections', recipeId] })
    queryClient.invalidateQueries({ queryKey: ['recipes'] })
    queryClient.invalidateQueries({ queryKey: ['recipe', recipeId] })
    queryClient.invalidateQueries({ queryKey: ['collection'] })
  }

  const toggleMutation = useMutation({
    mutationFn: async ({ collectionId, add }: { collectionId: string; add: boolean }) => {
      setPendingId(collectionId)
      if (add) await addRecipeToCollection(collectionId, recipeId)
      else await removeRecipeFromCollection(collectionId, recipeId)
    },
    onSuccess: invalidate,
    onSettled: () => setPendingId(null),
  })

  const createMutation = useMutation({
    mutationFn: (name: string) => createCollection(name),
    onSuccess: (col) => toggleMutation.mutate({ collectionId: col.id, add: true }),
    onSettled: () => {
      setNewName('')
      invalidate()
    },
  })

  const items = data?.items ?? []
  const selectedCount = items.filter((c) => c.contains_recipe).length

  const content = (
    <>
      {variant === 'panel' && collections.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-medium uppercase tracking-wide text-stone-500">In collections</p>
          <RecipeCollectionChips collections={collections} emptyLabel="" />
        </div>
      )}

      <p className="text-sm text-stone-600">
        {selectedCount > 0
          ? `In ${selectedCount} collection${selectedCount === 1 ? '' : 's'} — tap to add or remove`
          : 'Tap a collection to add this recipe'}
      </p>

      {isLoading && <p className="mt-3 text-sm text-stone-500">Loading collections…</p>}

      {!isLoading && items.length === 0 && (
        <p className="mt-3 rounded-xl bg-stone-50 px-3 py-2 text-sm text-stone-600">
          No collections yet. Create your first one below.
        </p>
      )}

      <ul className="mt-3 space-y-1">
        {items.map((col) => {
          const selected = col.contains_recipe === true
          const busy = pendingId === col.id
          return (
            <li key={col.id}>
              <button
                type="button"
                disabled={busy || toggleMutation.isPending}
                onClick={() => toggleMutation.mutate({ collectionId: col.id, add: !selected })}
                className={[
                  'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition disabled:opacity-60',
                  selected
                    ? 'bg-brand-50 text-brand-900 ring-1 ring-brand-200'
                    : 'hover:bg-stone-50 text-stone-800',
                ].join(' ')}
              >
                <span
                  className={[
                    'flex h-5 w-5 shrink-0 items-center justify-center rounded-md border',
                    selected ? 'border-brand-600 bg-brand-600 text-white' : 'border-stone-300 bg-white',
                  ].join(' ')}
                >
                  {selected && (
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </span>
                <span className="min-w-0 flex-1 truncate font-medium">{col.name}</span>
                <span className="shrink-0 text-xs text-stone-400">
                  {busy ? '…' : `${col.recipe_count} recipes`}
                </span>
              </button>
            </li>
          )
        })}
      </ul>

      <form
        className="mt-4 flex gap-2 border-t border-stone-100 pt-4"
        onSubmit={(e) => {
          e.preventDefault()
          const name = newName.trim()
          if (!name) return
          createMutation.mutate(name)
        }}
      >
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New collection name…"
          className="min-w-0 flex-1 rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20"
        />
        <button
          type="submit"
          disabled={createMutation.isPending || !newName.trim()}
          className="shrink-0 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {createMutation.isPending ? '…' : 'Create & add'}
        </button>
      </form>

      {(toggleMutation.error || createMutation.error) && (
        <p className="mt-2 text-sm text-red-600">
          {(toggleMutation.error ?? createMutation.error)?.message ?? 'Something went wrong'}
        </p>
      )}
    </>
  )

  if (variant === 'popover') {
    return (
      <div className="w-72 rounded-2xl border border-stone-200 bg-white p-4 shadow-lg">
        <div className="mb-3 flex items-center justify-between">
          <p className="font-semibold text-stone-900">Collections</p>
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
      <h2 className="font-semibold text-stone-900">Collections</h2>
      {content}
    </div>
  )
}

interface CollectionQuickAddProps {
  recipeId: string
  collections: RecipeCollectionTag[]
}

export function CollectionQuickAdd({ recipeId, collections }: CollectionQuickAddProps) {
  const [open, setOpen] = useState(false)
  const hasCollections = collections.length > 0

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={[
          'inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-sm font-medium transition',
          hasCollections
            ? 'border-brand-200 bg-brand-50 text-brand-800 hover:bg-brand-100'
            : 'border-stone-200 text-stone-700 hover:bg-stone-50',
        ].join(' ')}
        title="Manage collections"
      >
        <FolderIcon />
        {hasCollections ? 'Collections' : '+ Collection'}
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
            <CollectionPicker
              recipeId={recipeId}
              collections={collections}
              variant="popover"
              onClose={() => setOpen(false)}
            />
          </div>
        </>
      )}
    </div>
  )
}
