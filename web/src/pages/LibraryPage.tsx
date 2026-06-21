import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Layout } from '../components/Layout'
import { RecipeCollectionChips } from '../components/RecipeCollectionChips'
import { CollectionQuickAdd } from '../components/CollectionPicker'
import { RecipeIcon } from '../components/RecipeIcon'
import { useAuth } from '../context/AuthContext'
import { deleteRecipe, listRecipes } from '../api/client'

export function LibraryPage() {
  const { isAuthenticated, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => clearTimeout(id)
  }, [search])

  const { data, isLoading, error } = useQuery({
    queryKey: ['recipes', debouncedSearch],
    queryFn: () => listRecipes(debouncedSearch || undefined),
    enabled: isAuthenticated,
  })

  const removeMutation = useMutation({
    mutationFn: deleteRecipe,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['recipes'] }),
  })

  if (authLoading) {
    return (
      <Layout>
        <div className="px-4 py-16 text-center text-stone-500">Loading…</div>
      </Layout>
    )
  }

  if (!isAuthenticated) {
    navigate(`/login?redirect=${encodeURIComponent('/recipes')}`, { replace: true })
    return null
  }

  return (
    <Layout>
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-stone-900">My recipes</h1>
            <p className="mt-1 text-stone-600">{data?.total ?? 0} saved</p>
          </div>
          <Link
            to="/new"
            className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Add recipe
          </Link>
        </div>

        <input
          type="search"
          placeholder="Search recipes…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mt-6 w-full rounded-xl border border-stone-200 bg-white px-4 py-3 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20"
        />

        {isLoading && <p className="mt-8 text-stone-500">Loading recipes…</p>}
        {error && (
          <p className="mt-8 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
            {(error as Error).message}
          </p>
        )}

        {data && data.items.length === 0 && (
          <div className="mt-12 rounded-2xl border border-dashed border-stone-300 p-10 text-center">
            <p className="text-stone-600">No recipes yet.</p>
            <Link to="/new" className="mt-3 inline-block font-medium text-brand-600">
              Paste your first recipe →
            </Link>
          </div>
        )}

        <ul className="mt-6 space-y-3">
          {data?.items.map((item) => (
            <li
              key={item.id}
              className="rounded-2xl border border-stone-200 bg-white p-4"
            >
              <div className="flex items-start gap-3">
                <RecipeIcon recipeId={item.id} iconUrl={item.icon_url} size="sm" />
                <Link to={`/recipes/${item.id}`} className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-stone-900">{item.title}</p>
                  <p className="text-sm text-stone-500">
                    {item.step_count} steps · {new Date(item.created_at).toLocaleDateString()}
                  </p>
                  <RecipeCollectionChips collections={item.collections ?? []} />
                </Link>
                <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
                  {(item.collections?.length ?? 0) === 0 && (
                    <CollectionQuickAdd recipeId={item.id} collections={item.collections ?? []} />
                  )}
                  <Link
                    to={`/cook/${item.id}`}
                    className="rounded-lg bg-brand-50 px-3 py-2 text-center text-sm font-medium text-brand-700 hover:bg-brand-100"
                  >
                    Cook
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm('Delete this recipe?')) removeMutation.mutate(item.id)
                    }}
                    className="text-sm text-stone-400 hover:text-red-600"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </Layout>
  )
}
