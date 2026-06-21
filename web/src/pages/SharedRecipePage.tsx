import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Layout } from '../components/Layout'
import { RecipeIcon } from '../components/RecipeIcon'
import { RecipeNutritionInfo } from '../components/RecipeNutritionInfo'
import { RecipeSourceLink } from '../components/RecipeSourceLink'
import { ShopInstacartButton } from '../components/ShopInstacartButton'
import { getSharedRecipe, saveSharedRecipe } from '../api/client'
import { useAuth } from '../context/AuthContext'

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

  return (
    <Layout>
      <div className="mx-auto max-w-3xl px-4 py-8">
        <p className="text-sm text-stone-500">Shared by {data.author_name}</p>
        <div className="mt-3 flex items-start gap-4">
          <RecipeIcon recipeId={data.slug} iconUrl={data.icon_url} size="lg" />
          <div>
            <h1 className="text-3xl font-bold text-stone-900">{data.title}</h1>
            {data.source_url && <RecipeSourceLink url={data.source_url} className="mt-2" />}
            <p className="mt-1 text-stone-600">{data.step_count} steps</p>
            <RecipeNutritionInfo recipe={data.recipe} className="mt-3" />
          </div>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            to={`/r/${slug}/cook`}
            className="inline-flex min-h-12 items-center rounded-2xl bg-brand-600 px-8 py-3 font-semibold text-white transition hover:bg-brand-700"
          >
            Start cooking
          </Link>

          <ShopInstacartButton shareSlug={slug} />

          {!isAuthenticated && (
            <Link
              to={`/login?redirect=${encodeURIComponent(`/r/${slug}`)}`}
              className="inline-flex min-h-12 items-center rounded-2xl border border-stone-200 px-6 py-3 text-sm font-medium text-stone-700 hover:bg-stone-50"
            >
              Sign in to save
            </Link>
          )}

          {isAuthenticated && !needsVerify && (
            <button
              type="button"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className="inline-flex min-h-12 items-center rounded-2xl border border-brand-200 bg-brand-50 px-6 py-3 text-sm font-semibold text-brand-800 hover:bg-brand-100 disabled:opacity-50"
            >
              {saveMutation.isPending ? 'Saving…' : 'Save to my library'}
            </button>
          )}

          {needsVerify && (
            <Link
              to={`/verify-email?redirect=${encodeURIComponent(`/r/${slug}`)}`}
              className="inline-flex min-h-12 items-center rounded-2xl border border-amber-200 bg-amber-50 px-6 py-3 text-sm font-medium text-amber-900"
            >
              Verify email to save
            </Link>
          )}
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
