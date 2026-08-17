import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Layout } from '../components/Layout'
import { RecipeIcon } from '../components/RecipeIcon'
import { RecipeNutritionInfo } from '../components/RecipeNutritionInfo'
import { RecipeSourceLink } from '../components/RecipeSourceLink'
import { SharedVideoRecipeView } from '../components/SharedVideoRecipeView'
import { ShopInstacartButton } from '../components/ShopInstacartButton'
import { AdSlot } from '../components/AdSlot'
import { getSharedRecipe, saveSharedRecipe } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { isVideoSourceType } from '../lib/recipeTimestamps'
import { AuthorLink } from '../components/AuthorLink'
import { FollowButton } from '../components/FollowButton'

export function SharedRecipePage() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const { isAuthenticated, user } = useAuth()

  const { data, isLoading, error } = useQuery({
    queryKey: ['shared-recipe', slug],
    queryFn: () => getSharedRecipe(slug!),
    enabled: !!slug,
  })

  const saveMutation = useMutation({
    mutationFn: () => saveSharedRecipe(slug!),
    onSuccess: (saved) => navigate(`/recipes/${saved.id}`),
  })

  if (!slug) {
    return (
      <Layout>
        <div className="px-4 py-16 text-center text-stone-500">Invalid link.</div>
      </Layout>
    )
  }

  if (isLoading) {
    return (
      <Layout>
        <div className="px-4 py-16 text-center text-stone-500">Loading recipe…</div>
      </Layout>
    )
  }

  if (error || !data) {
    return (
      <Layout>
        <div className="mx-auto max-w-lg px-4 py-16 text-center">
          <p className="text-stone-600">{(error as Error)?.message ?? 'Recipe not found.'}</p>
          <Link to="/" className="mt-4 inline-block font-medium text-brand-600">
            Go home
          </Link>
        </div>
      </Layout>
    )
  }

  const needsVerify = isAuthenticated && user && !user.email_verified
  const useVideoLayout = isVideoSourceType(data.source_type) && !!data.source_url

  const addRecipeButton = (() => {
    const className =
      'inline-flex min-h-11 items-center justify-center rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-800 disabled:cursor-wait disabled:opacity-60'

    if (!isAuthenticated) {
      return (
        <Link
          to={`/login?redirect=${encodeURIComponent(`/r/${slug}`)}`}
          className={className}
        >
          + Add Recipe
        </Link>
      )
    }

    if (needsVerify) {
      return (
        <Link
          to={`/verify-email?redirect=${encodeURIComponent(`/r/${slug}`)}`}
          className={className}
        >
          + Add Recipe
        </Link>
      )
    }

    return (
      <button
        type="button"
        onClick={() => saveMutation.mutate()}
        disabled={saveMutation.isPending}
        className={className}
      >
        {saveMutation.isPending ? 'Adding…' : '+ Add Recipe'}
      </button>
    )
  })()

  const actions = (
    <>
      {addRecipeButton}

      {!useVideoLayout && (
        <Link
          to={`/r/${slug}/cook`}
          className="inline-flex min-h-11 items-center rounded-xl border border-stone-200 px-4 py-2.5 text-sm font-semibold text-stone-700 transition hover:bg-stone-50"
        >
          Start cooking
        </Link>
      )}

      <ShopInstacartButton shareSlug={slug} />
    </>
  )

  if (useVideoLayout) {
    return (
      <Layout>
        <SharedVideoRecipeView
          slug={slug}
          data={data}
          actions={actions}
          saveError={
            saveMutation.error ? (saveMutation.error as Error).message : null
          }
        />
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <AuthorLink
                username={data.author_username}
                name={data.author_name}
                avatarUrl={data.author_avatar_url}
              />
              {data.author_username && (
                <FollowButton
                  username={data.author_username}
                  isFollowing={Boolean(data.is_following)}
                  isSelf={Boolean(data.is_self)}
                />
              )}
            </div>
            <div className="mt-3 flex items-start gap-4">
              <RecipeIcon recipeId={data.slug} iconUrl={data.icon_url} size="lg" />
              <div>
                <h1 className="text-3xl font-bold text-stone-900">{data.title}</h1>
                {data.source_url && <RecipeSourceLink url={data.source_url} className="mt-2" />}
                <p className="mt-1 text-stone-600">{data.step_count} steps</p>
                <RecipeNutritionInfo recipe={data.recipe} className="mt-3" />
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3">{actions}</div>
        </div>

        {saveMutation.error && (
          <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
            {(saveMutation.error as Error).message}
          </p>
        )}

        <section className="mt-10">
          <h2 className="mb-3 font-semibold">Ingredients</h2>
          <ul className="space-y-2 rounded-2xl border border-stone-200 bg-white p-4">
            {data.recipe.ingredients.map((ing) => (
              <li key={ing.name} className="flex justify-between text-sm">
                <span>{ing.name}</span>
                {ing.quantity && <span className="text-stone-400">{ing.quantity}</span>}
              </li>
            ))}
          </ul>
        </section>

        <AdSlot variant="banner" className="mt-8" />

        <section className="mt-8">
          <h2 className="mb-3 font-semibold">Steps preview</h2>
          <ol className="space-y-2">
            {data.recipe.steps.slice(0, 3).map((step, i) => (
              <li key={step.order} className="rounded-xl border border-stone-200 bg-white p-3 text-sm text-stone-700">
                <span className="mr-2 font-semibold text-brand-600">{i + 1}.</span>
                {step.instruction}
              </li>
            ))}
          </ol>
          {data.recipe.steps.length > 3 && (
            <p className="mt-2 text-sm text-stone-500">
              + {data.recipe.steps.length - 3} more steps in cook mode
            </p>
          )}
        </section>
      </div>
    </Layout>
  )
}
