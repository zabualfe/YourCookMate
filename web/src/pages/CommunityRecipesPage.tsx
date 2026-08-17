import { useEffect, useState, Fragment } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Layout } from '../components/Layout'
import { RecipeIcon } from '../components/RecipeIcon'
import { AdSlot } from '../components/AdSlot'
import { AuthorLink } from '../components/AuthorLink'
import { listCommunityRecipes } from '../api/client'
import { shouldInsertInFeedAd } from '../lib/adsense'
import { useAuth } from '../context/AuthContext'
import type { CommunityFeed } from '../types/social'

export function CommunityRecipesPage() {
  const { isAuthenticated } = useAuth()
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [feed, setFeed] = useState<CommunityFeed>('discover')

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => clearTimeout(id)
  }, [search])

  const followingEnabled = feed === 'following' && isAuthenticated
  const { data, isLoading, error } = useQuery({
    queryKey: ['community-recipes', debouncedSearch, feed, isAuthenticated],
    queryFn: () => listCommunityRecipes(debouncedSearch || undefined, feed),
    enabled: feed === 'discover' || followingEnabled,
  })

  return (
    <Layout>
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Community</h1>
          <p className="mt-1 text-stone-600">Discover recipes from cooks, or catch up with people you follow</p>
        </div>

        <div className="mt-6 flex gap-2">
          <FeedTab active={feed === 'discover'} onClick={() => setFeed('discover')}>
            Discover
          </FeedTab>
          <FeedTab active={feed === 'following'} onClick={() => setFeed('following')}>
            Following
          </FeedTab>
        </div>

        <input
          type="search"
          placeholder="Search recipes or cooks…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mt-4 w-full rounded-xl border border-stone-200 bg-white px-4 py-3 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20"
        />

        {feed === 'following' && !isAuthenticated && (
          <div className="mt-12 rounded-2xl border border-dashed border-stone-300 p-10 text-center">
            <p className="text-stone-600">Sign in to follow cooks and see their recipes here.</p>
            <Link to="/login?redirect=/community" className="mt-4 inline-block font-medium text-brand-600">
              Sign in
            </Link>
          </div>
        )}

        {(feed === 'discover' || followingEnabled) && isLoading && (
          <p className="mt-8 text-stone-500">Loading recipes…</p>
        )}
        {error && (
          <p className="mt-8 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
            {(error as Error).message}
          </p>
        )}

        {data && data.items.length === 0 && (
          <div className="mt-12 rounded-2xl border border-dashed border-stone-300 p-10 text-center">
            {feed === 'following' ? (
              <>
                <p className="text-stone-600">Follow cooks to see their recipes here.</p>
                <p className="mt-1 text-sm text-stone-500">Browse Discover to find people sharing recipes.</p>
                <button
                  type="button"
                  onClick={() => setFeed('discover')}
                  className="mt-4 inline-block font-medium text-brand-600"
                >
                  Browse Discover
                </button>
              </>
            ) : (
              <>
                <p className="text-stone-600">No community recipes yet.</p>
                <p className="mt-1 text-sm text-stone-500">Share one of your recipes to appear here for others.</p>
                <Link to="/recipes" className="mt-4 inline-block font-medium text-brand-600">
                  Go to My Recipes →
                </Link>
              </>
            )}
          </div>
        )}

        <ul className="mt-6 space-y-3">
          {data?.items.map((item, index) => (
            <Fragment key={item.slug}>
              <li className="rounded-2xl border border-stone-200 bg-white p-4">
                <div className="flex items-center gap-3">
                  <RecipeIcon recipeId={item.slug} iconUrl={item.icon_url} size="sm" />
                  <Link to={`/r/${item.slug}`} className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-stone-900">{item.title}</p>
                    <p className="text-sm text-stone-500">
                      {item.step_count} steps · {new Date(item.created_at).toLocaleDateString()}
                    </p>
                  </Link>
                  <Link
                    to={`/r/${item.slug}/cook`}
                    className="shrink-0 rounded-lg bg-brand-50 px-3 py-2 text-sm font-medium text-brand-700 hover:bg-brand-100"
                  >
                    Cook
                  </Link>
                </div>
                <div className="mt-3 border-t border-stone-100 pt-3">
                  <AuthorLink
                    username={item.author_username}
                    name={item.author_name}
                    avatarUrl={item.author_avatar_url}
                  />
                </div>
              </li>
              {data && shouldInsertInFeedAd(index, data.items.length) && (
                <li>
                  <AdSlot variant="infeed" />
                </li>
              )}
            </Fragment>
          ))}
        </ul>
        {data && data.items.length > 0 && <AdSlot variant="banner" className="mt-6" />}
      </div>
    </Layout>
  )
}

function FeedTab({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'rounded-full px-4 py-2 text-sm font-semibold transition',
        active ? 'bg-brand-600 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200',
      ].join(' ')}
    >
      {children}
    </button>
  )
}
