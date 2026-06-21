import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Layout } from '../components/Layout'
import { useAuth } from '../context/AuthContext'
import { createCollection, deleteCollection, listCollections } from '../api/client'

export function CollectionsPage() {
  const { isAuthenticated, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [error, setError] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['collections'],
    queryFn: () => listCollections(),
    enabled: isAuthenticated,
  })

  const createMutation = useMutation({
    mutationFn: (collectionName: string) => createCollection(collectionName),
    onSuccess: () => {
      setName('')
      queryClient.invalidateQueries({ queryKey: ['collections'] })
    },
    onError: (err) => setError(err instanceof Error ? err.message : 'Failed to create collection'),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteCollection,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['collections'] }),
  })

  if (authLoading) {
    return (
      <Layout>
        <div className="px-4 py-16 text-center text-stone-500">Loading…</div>
      </Layout>
    )
  }

  if (!isAuthenticated) {
    navigate(`/login?redirect=${encodeURIComponent('/collections')}`, { replace: true })
    return null
  }

  return (
    <Layout>
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-stone-900">Collections</h1>
            <p className="mt-1 text-stone-600">Organize recipes into folders</p>
          </div>
          <Link
            to="/recipes"
            className="rounded-xl border border-stone-200 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
          >
            My recipes
          </Link>
        </div>

        <form
          className="mt-6 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            const trimmed = name.trim()
            if (!trimmed) return
            setError('')
            createMutation.mutate(trimmed)
          }}
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="New collection name"
            className="min-w-0 flex-1 rounded-xl border border-stone-200 bg-white px-4 py-3 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20"
          />
          <button
            type="submit"
            disabled={createMutation.isPending || !name.trim()}
            className="shrink-0 rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            Create
          </button>
        </form>

        {error && (
          <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
        )}

        {isLoading && <p className="mt-8 text-stone-500">Loading collections…</p>}

        {data && data.items.length === 0 && (
          <div className="mt-12 rounded-2xl border border-dashed border-stone-300 p-10 text-center">
            <p className="text-stone-600">No collections yet.</p>
            <p className="mt-1 text-sm text-stone-500">Try &quot;Weeknight Dinners&quot; or &quot;Favorites&quot;</p>
          </div>
        )}

        <ul className="mt-6 space-y-3">
          {data?.items.map((col) => (
            <li
              key={col.id}
              className="flex items-center gap-3 rounded-2xl border border-stone-200 bg-white p-4"
            >
              <Link to={`/collections/${col.id}`} className="min-w-0 flex-1">
                <p className="truncate font-semibold text-stone-900">{col.name}</p>
                <p className="text-sm text-stone-500">
                  {col.recipe_count} recipes · {new Date(col.created_at).toLocaleDateString()}
                </p>
              </Link>
              <button
                type="button"
                onClick={() => {
                  if (confirm(`Delete "${col.name}"? Recipes stay in your library.`)) {
                    deleteMutation.mutate(col.id)
                  }
                }}
                className="shrink-0 text-sm text-stone-400 hover:text-red-600"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      </div>
    </Layout>
  )
}
