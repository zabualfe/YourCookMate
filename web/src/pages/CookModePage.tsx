import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { CookModeShell } from '../components/CookModeShell'
import { getRecipe as getLocalRecipe } from '../lib/storage'
import { getRecipe as getRecipeApi } from '../api/client'
import { useAuth } from '../context/AuthContext'
import type { ParsedRecipe } from '../types/recipe'

export function CookModePage() {
  const { id } = useParams<{ id: string }>()
  const { isAuthenticated } = useAuth()
  const [localRecipe, setLocalRecipe] = useState<ParsedRecipe | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['recipe', id],
    queryFn: () => getRecipeApi(id!),
    enabled: !!id && isAuthenticated,
    retry: false,
  })

  useEffect(() => {
    if (!id || isAuthenticated) return
    const stored = getLocalRecipe(id)
    setLocalRecipe(stored?.recipe ?? null)
  }, [id, isAuthenticated])

  if (!id) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-6">
        <p className="text-stone-600">Invalid recipe.</p>
      </div>
    )
  }

  if (isAuthenticated) {
    if (isLoading) {
      return (
        <div className="flex min-h-dvh items-center justify-center p-6">
          <p className="text-stone-600">Loading recipe…</p>
        </div>
      )
    }
    if (data) {
      return <CookModeShell recipe={data.recipe} recipeId={data.id} />
    }
  }

  if (localRecipe) {
    return <CookModeShell recipe={localRecipe} recipeId={id} />
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6">
      <p className="text-stone-600">
        {error ? (error as Error).message : 'Recipe not found.'}
      </p>
      <Link to="/" className="font-medium text-brand-600">
        Go home
      </Link>
    </div>
  )
}
