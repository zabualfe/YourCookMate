import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import type { ParsedRecipe } from '../types/recipe'
import { useCookMode } from '../hooks/useCookMode'
import { IngredientDrawer } from './IngredientDrawer'
import { StepCard } from './StepCard'
import { StepNavigator } from './StepNavigator'

interface CookModeShellProps {
  recipe: ParsedRecipe
  recipeId: string
}

export function CookModeShell({ recipe, recipeId }: CookModeShellProps) {
  const navigate = useNavigate()
  const { currentIndex, currentStep, total, isFirst, isLast, goNext, goPrev } = useCookMode(
    recipe.steps,
  )
  const [drawerOpen, setDrawerOpen] = useState(false)

  const handleNext = useCallback(() => {
    if (isLast) {
      navigate(`/recipes/${recipeId}`)
      return
    }
    goNext()
  }, [goNext, isLast, navigate, recipeId])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault()
        handleNext()
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        if (!isFirst) goPrev()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [goPrev, isFirst, handleNext])

  let touchStartX = 0
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX = e.touches[0].clientX
  }
  const onTouchEnd = (e: React.TouchEvent) => {
    const delta = e.changedTouches[0].clientX - touchStartX
    if (delta < -50) handleNext()
    if (delta > 50 && !isFirst) goPrev()
  }

  return (
    <div
      className="flex min-h-dvh flex-col bg-stone-50"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <header className="flex items-center justify-between border-b border-stone-200 bg-white px-4 py-3">
        <Link
          to={`/recipes/${recipeId}`}
          className="text-sm font-medium text-stone-500 hover:text-stone-800"
        >
          Exit
        </Link>
        <h1 className="max-w-[50%] truncate text-sm font-semibold text-stone-900">{recipe.title}</h1>
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="text-sm font-medium text-brand-600"
        >
          Ingredients
        </button>
      </header>

      <div className="px-4 pt-4">
        <div className="flex gap-1">
          {recipe.steps.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors ${
                i <= currentIndex ? 'bg-brand-600' : 'bg-stone-200'
              }`}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden">
        <AnimatePresence mode="wait">
          {currentStep && (
            <StepCard
              key={currentStep.order}
              step={currentStep}
              stepNumber={currentIndex + 1}
              totalSteps={total}
            />
          )}
        </AnimatePresence>
      </div>

      <StepNavigator onPrev={goPrev} onNext={handleNext} isFirst={isFirst} isLast={isLast} />

      <IngredientDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        ingredients={recipe.ingredients}
        highlighted={currentStep?.ingredients_used ?? []}
      />
    </div>
  )
}
