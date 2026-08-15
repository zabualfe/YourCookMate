import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import type { ParsedRecipe } from '../types/recipe'
import { useCookMode } from '../hooks/useCookMode'
import { ingredientsForStep } from '../lib/recipeTimestamps'
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

  const neededIngredients = useMemo(
    () => ingredientsForStep(recipe, currentStep ?? null),
    [recipe, currentStep],
  )

  const exitTo = recipeId.startsWith('shared-')
    ? `/r/${recipeId.slice('shared-'.length)}`
    : `/recipes/${recipeId}`

  const handleNext = useCallback(() => {
    if (isLast) {
      navigate(exitTo)
      return
    }
    goNext()
  }, [exitTo, goNext, isLast, navigate])

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
        <Link to={exitTo} className="text-sm font-medium text-stone-500 hover:text-stone-800">
          Exit
        </Link>
        <h1 className="max-w-[50%] truncate text-sm font-semibold text-stone-900">{recipe.title}</h1>
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="text-sm font-medium text-brand-600"
        >
          All ingredients
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
        <p className="mt-2 text-sm font-medium uppercase tracking-wider text-brand-600">
          Step {currentIndex + 1} of {total}
        </p>
      </div>

      <div className="flex w-full flex-1 overflow-hidden">
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
          <AnimatePresence mode="wait">
            {currentStep && (
              <motion.div
                key={currentStep.order}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="absolute inset-0 overflow-y-auto"
              >
                <StepCard
                  step={currentStep}
                  stepNumber={currentIndex + 1}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <aside className="hidden w-72 shrink-0 items-center justify-center self-stretch px-4 py-6 sm:flex xl:w-80">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep?.order ?? 'none'}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
              className="w-full max-h-[min(60vh,28rem)] overflow-y-auto rounded-2xl border border-stone-200 bg-white px-4 py-4 shadow-sm"
            >
              <h2 className="text-sm font-medium uppercase tracking-wider text-brand-600">
                For this step
              </h2>
              {neededIngredients.length > 0 ? (
                <ul className="mt-3 space-y-2">
                  {neededIngredients.map((ing) => (
                    <li
                      key={ing.name}
                      className="flex items-baseline justify-between gap-3 rounded-xl bg-stone-50 px-3 py-2.5 text-left"
                    >
                      <span className="font-medium text-stone-900">{ing.name}</span>
                      {ing.quantity && (
                        <span className="shrink-0 text-sm text-stone-500">{ing.quantity}</span>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm leading-relaxed text-stone-500">
                  No specific ingredients for this step.
                </p>
              )}
            </motion.div>
          </AnimatePresence>
        </aside>
      </div>

      {/* Mobile: ingredients under the step */}
      <div className="border-t border-stone-200 bg-white px-4 py-3 sm:hidden">
        <p className="text-xs font-medium uppercase tracking-wider text-brand-600">For this step</p>
        {neededIngredients.length > 0 ? (
          <ul className="mt-2 flex flex-wrap gap-2">
            {neededIngredients.map((ing) => (
              <li
                key={ing.name}
                className="rounded-full border border-stone-200 bg-stone-50 px-3 py-1.5 text-sm text-stone-800"
              >
                {ing.name}
                {ing.quantity ? (
                  <span className="text-stone-500"> · {ing.quantity}</span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-sm text-stone-500">No specific ingredients for this step.</p>
        )}
      </div>

      <StepNavigator onPrev={goPrev} onNext={handleNext} isFirst={isFirst} isLast={isLast} />

      <IngredientDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        ingredients={recipe.ingredients}
        highlighted={neededIngredients.map((ing) => ing.name)}
      />
    </div>
  )
}
