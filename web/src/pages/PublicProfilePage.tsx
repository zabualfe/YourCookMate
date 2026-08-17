import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Layout } from '../components/Layout'
import { RecipeIcon } from '../components/RecipeIcon'
import { AuthorAvatar, AuthorLink } from '../components/AuthorLink'
import { FollowButton } from '../components/FollowButton'
import { getPublicProfile, listFollowers, listFollowing } from '../api/client'
import { PinRecipeButton } from '../components/PinRecipeButton'
import type { CommunityRecipeSummary } from '../types/collection'
import type { PublicUserCard } from '../types/social'

type ListKind = 'followers' | 'following' | null

export function PublicProfilePage() {
  const { username } = useParams<{ username: string }>()
  const [listKind, setListKind] = useState<ListKind>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['public-profile', username],
    queryFn: () => getPublicProfile(username!),
    enabled: !!username,
  })

  const listQuery = useQuery({
    queryKey: [listKind === 'followers' ? 'followers' : 'following-users', username],
    queryFn: () => (listKind === 'followers' ? listFollowers(username!) : listFollowing(username!)),
    enabled: !!username && listKind !== null,
  })

  if (!username) {
    return (
      <Layout>
        <div className="px-4 py-16 text-center text-stone-500">Invalid profile.</div>
      </Layout>
    )
  }

  if (isLoading) {
    return (
      <Layout>
        <div className="px-4 py-16 text-center text-stone-500">Loading cook…</div>
      </Layout>
    )
  }

  if (error || !data) {
    return (
      <Layout>
        <div className="mx-auto max-w-lg px-4 py-16 text-center">
          <p className="text-stone-600">{(error as Error)?.message ?? 'Cook not found.'}</p>
          <Link to="/community" className="mt-4 inline-block font-medium text-brand-600">
            Back to Community
          </Link>
        </div>
      </Layout>
    )
  }

  const toggleList = (kind: Exclude<ListKind, null>) => {
    setListKind((current) => (current === kind ? null : kind))
  }

  const pinned = data.recipes.filter((item) => item.pinned_rank)
  const rest = data.recipes.filter((item) => !item.pinned_rank)

  return (
    <Layout>
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-stone-200 bg-white p-6">
          <div className="flex min-w-0 items-center gap-4">
            <AuthorAvatar name={data.author_name} avatarUrl={data.avatar_url} size="lg" />
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-bold text-stone-900">{data.author_name}</h1>
              <p className="text-stone-500">@{data.username}</p>
              <div className="mt-3 flex flex-wrap gap-3 text-sm">
                <button
                  type="button"
                  onClick={() => toggleList('followers')}
                  className="rounded-lg px-1 font-medium text-stone-700 hover:text-brand-700"
                >
                  {data.follower_count} follower{data.follower_count === 1 ? '' : 's'}
                </button>
                <button
                  type="button"
                  onClick={() => toggleList('following')}
                  className="rounded-lg px-1 font-medium text-stone-700 hover:text-brand-700"
                >
                  {data.following_count} following
                </button>
              </div>
            </div>
          </div>
          {data.is_self ? (
            <Link
              to="/profile"
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-stone-200 px-4 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-50"
            >
              Edit profile
            </Link>
          ) : (
            <FollowButton username={data.username} isFollowing={data.is_following} />
          )}
        </div>

        {listKind && (
          <section className="mt-4 rounded-2xl border border-stone-200 bg-white p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
              {listKind === 'followers' ? 'Followers' : 'Following'}
            </h2>
            {listQuery.isLoading && <p className="mt-3 text-sm text-stone-500">Loading…</p>}
            {listQuery.data && listQuery.data.items.length === 0 && (
              <p className="mt-3 text-sm text-stone-500">No cooks to show yet.</p>
            )}
            <ul className="mt-3 space-y-2">
              {listQuery.data?.items.map((person: PublicUserCard) => (
                <li key={person.username}>
                  <AuthorLink
                    username={person.username}
                    name={person.author_name}
                    avatarUrl={person.avatar_url}
                    className="w-full rounded-xl px-2 py-2 hover:bg-stone-50"
                  />
                </li>
              ))}
            </ul>
          </section>
        )}

        {pinned.length > 0 && (
          <section className="mt-8">
            <h2 className="text-lg font-semibold text-stone-900">Featured recipes</h2>
            <p className="mt-1 text-sm text-stone-500">Top picks from @{data.username}</p>
            <ul className="mt-4 grid gap-3 sm:grid-cols-3">
              {pinned.map((item) => (
                <li key={item.slug}>
                  <ProfileRecipeCard item={item} featured isSelf={data.is_self} />
                </li>
              ))}
            </ul>
          </section>
        )}

        <h2 className="mt-8 text-lg font-semibold text-stone-900">Community recipes</h2>
        {data.recipes.length === 0 ? (
          <p className="mt-4 rounded-2xl border border-dashed border-stone-300 p-8 text-center text-stone-500">
            No public recipes yet.
          </p>
        ) : rest.length === 0 ? (
          <p className="mt-4 text-sm text-stone-500">All shared recipes are featured above.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {rest.map((item) => (
              <li key={item.slug}>
                <ProfileRecipeCard item={item} isSelf={data.is_self} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </Layout>
  )
}

function ProfileRecipeCard({
  item,
  featured,
  isSelf,
}: {
  item: CommunityRecipeSummary
  featured?: boolean
  isSelf: boolean
}) {
  return (
    <div
      className={
        featured
          ? 'flex h-full flex-col rounded-2xl border border-brand-200 bg-brand-50/40 p-4'
          : 'flex items-center gap-3 rounded-2xl border border-stone-200 bg-white p-4'
      }
    >
      <div className={featured ? 'flex items-start gap-3' : 'flex min-w-0 flex-1 items-center gap-3'}>
        <RecipeIcon recipeId={item.slug} iconUrl={item.icon_url} size="sm" />
        <Link to={`/r/${item.slug}`} className="min-w-0 flex-1">
          {featured && (
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">
              Pinned {item.pinned_rank}
            </p>
          )}
          <p className="truncate font-semibold text-stone-900">{item.title}</p>
          <p className="text-sm text-stone-500">
            {item.step_count} steps · {new Date(item.created_at).toLocaleDateString()}
          </p>
        </Link>
      </div>
      <div className={featured ? 'mt-3 flex flex-wrap items-center gap-2' : 'flex shrink-0 items-center gap-2'}>
        {isSelf && item.id && (
          <PinRecipeButton
            recipeId={item.id}
            pinnedRank={item.pinned_rank}
            sharedToCommunity
            compact
          />
        )}
        <Link
          to={`/r/${item.slug}/cook`}
          className="shrink-0 rounded-lg bg-brand-50 px-3 py-2 text-sm font-medium text-brand-700 hover:bg-brand-100"
        >
          Cook
        </Link>
      </div>
    </div>
  )
}
