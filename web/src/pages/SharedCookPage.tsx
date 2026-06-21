import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { CookModeShell } from '../components/CookModeShell'
import { getSharedRecipe } from '../api/client'

export function SharedCookPage() {
  const { slug } = useParams<{ slug: string }>()

  const { data, isLoading, error } = useQuery({
    queryKey: ['shared-recipe', slug],
    queryFn: () => getSharedRecipe(slug!),
    enabled: !!slug,
  })

  if (!slug) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-6">
        <p className="text-stone-600">Invalid recipe.</p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-6">
        <p className="text-stone-600">Loading recipe…</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6">
        <p className="text-stone-600">{(error as Error)?.message ?? 'Recipe not found.'}</p>
        <Link to="/" className="font-medium text-brand-600">
          Go home
        </Link>
      </div>
    )
  }

  return <CookModeShell recipe={data.recipe} recipeId={`shared-${slug}`} />
}
