import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Layout } from '../components/Layout'
import { useAuth } from '../context/AuthContext'
import { getCollection, removeRecipeFromCollection, updateCollection } from '../api/client'

export function CollectionDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { isAuthenticated } = useAuth()
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState('')

  const { data, isLoading, error } = useQuery({
    queryKey: ['collection', id],
    queryFn: () => getCollection(id!),
    enabled: !!id && isAuthenticated,
  })

  const renameMutation = useMutation({
    mutationFn: (newName: string) => updateCollection(id!, newName),
    onSuccess: () => {
      setEditing(false)
      queryClient.invalidateQueries({ queryKey: ['collection', id] })
      queryClient.invalidateQueries({ queryKey: ['collections'] })
    },
  })

  const removeMutation = useMutation({
    mutationFn: (recipeId: string) => removeRecipeFromCollection(id!, recipeId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['collection', id] }),
  })

  if (isLoading) {
    return (
      <Layout>
        <div className="px-4 py-16 text-center text-stone-500">Loading…</div>
      </Layout>
    )
  }

  if (error || !data) {
    return (
      <Layout>
        <div className="mx-auto max-w-lg px-4 py-16 text-center">
          <p className="text-stone-600">{(error as Error)?.message ?? 'Collection not found.'}</p>
          <Link to="/collections" className="mt-4 inline-block font-medium text-brand-600">
            Back to collections
          </Link>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="mx-auto max-w-3xl px-4 py-8">
        <Link to="/collections" className="text-sm font-medium text-stone-500 hover:text-stone-800">
          ← Collections
        </Link>

        {editing ? (
          <form
            className="mt-4 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              const trimmed = name.trim()
              if (trimmed) renameMutation.mutate(trimmed)
            }}
          >
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="min-w-0 flex-1 rounded-xl border border-stone-200 px-4 py-2 text-xl font-bold outline-none focus:border-brand-400"
              autoFocus
            />
            <button
              type="submit"
              className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-xl border border-stone-200 px-4 py-2 text-sm"
            >
              Cancel
            </button>
          </form>
        ) : (
          <div className="mt-4 flex items-center gap-3">
            <h1 className="text-2xl font-bold text-stone-900">{data.name}</h1>
            <button
              type="button"
              onClick={() => {
                setName(data.name)
                setEditing(true)
              }}
              className="text-sm font-medium text-brand-600 hover:text-brand-700"
            >
              Rename
            </button>
          </div>
        )}

        <p className="mt-1 text-stone-600">{data.recipes.length} recipes</p>

        {data.recipes.length === 0 && (
          <div className="mt-12 rounded-2xl border border-dashed border-stone-300 p-10 text-center">
            <p className="text-stone-600">No recipes in this collection.</p>
            <Link to="/recipes" className="mt-3 inline-block font-medium text-brand-600">
              Browse my recipes →
            </Link>
          </div>
        )}

        <ul className="mt-6 space-y-3">
          {data.recipes.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-3 rounded-2xl border border-stone-200 bg-white p-4"
            >
              <Link to={`/recipes/${item.id}`} className="min-w-0 flex-1">
                <p className="truncate font-semibold text-stone-900">{item.title}</p>
                <p className="text-sm text-stone-500">{item.step_count} steps</p>
              </Link>
              <Link
                to={`/cook/${item.id}`}
                className="shrink-0 rounded-lg bg-brand-50 px-3 py-2 text-sm font-medium text-brand-700 hover:bg-brand-100"
              >
                Cook
              </Link>
              <button
                type="button"
                onClick={() => removeMutation.mutate(item.id)}
                className="shrink-0 text-sm text-stone-400 hover:text-red-600"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      </div>
    </Layout>
  )
}
