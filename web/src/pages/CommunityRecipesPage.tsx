import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Layout } from '../components/Layout'
import { RecipeIcon } from '../components/RecipeIcon'
import { listCommunityRecipes } from '../api/client'

export function CommunityRecipesPage() {
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => clearTimeout(id)
  }, [search])

  const { data, isLoading, error } = useQuery({
    queryKey: ['community-recipes', debouncedSearch],
    queryFn: () => listCommunityRecipes(debouncedSearch || undefined),
  })

  return (
    <Layout>
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Community Recipes</h1>
          <p className="mt-1 text-stone-600">Recipes shared publicly by other cooks</p>
        </div>

        <input
          type="search"
          placeholder="Search community recipes…"
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
            <p className="text-stone-600">No community recipes yet.</p>
            <p className="mt-1 text-sm text-stone-500">
              Share one of your recipes to appear here for others.
            </p>
            <Link to="/recipes" className="mt-4 inline-block font-medium text-brand-600">
              Go to My Recipes →
            </Link>
          </div>
        )}

        <ul className="mt-6 space-y-3">
          {data?.items.map((item) => (
            <li
              key={item.slug}
              className="flex items-center gap-3 rounded-2xl border border-stone-200 bg-white p-4"
            >
              <RecipeIcon recipeId={item.slug} iconUrl={item.icon_url} size="sm" />
              <Link to={`/r/${item.slug}`} className="min-w-0 flex-1">
                <p className="truncate font-semibold text-stone-900">{item.title}</p>
                <p className="text-sm text-stone-500">
                  by {item.author_name} · {item.step_count} steps ·{' '}
                  {new Date(item.created_at).toLocaleDateString()}
                </p>
              </Link>
              <Link
                to={`/r/${item.slug}/cook`}
                className="shrink-0 rounded-lg bg-brand-50 px-3 py-2 text-sm font-medium text-brand-700 hover:bg-brand-100"
              >
                Cook
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </Layout>
  )
}
