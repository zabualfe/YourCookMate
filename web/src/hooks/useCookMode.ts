import { useCallback, useState } from 'react'
import type { RecipeStep } from '../types/recipe'

export function useCookMode(steps: RecipeStep[]) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const total = steps.length
  const currentStep = steps[currentIndex]

  const goNext = useCallback(() => {
    setCurrentIndex((i) => Math.min(i + 1, total - 1))
  }, [total])

  const goPrev = useCallback(() => {
    setCurrentIndex((i) => Math.max(i - 1, 0))
  }, [])

  const goTo = useCallback(
    (index: number) => {
      setCurrentIndex(Math.max(0, Math.min(index, total - 1)))
    },
    [total],
  )

  return {
    currentIndex,
    currentStep,
    total,
    isFirst: currentIndex === 0,
    isLast: currentIndex === total - 1,
    goNext,
    goPrev,
    goTo,
  }
}
