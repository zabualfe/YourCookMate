import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'

const DEMO_RECIPE = {
  title: 'Garlic Butter Pasta',
  ingredients: [
    { name: 'Pasta', quantity: '12 oz' },
    { name: 'Butter', quantity: '4 tbsp' },
    { name: 'Garlic', quantity: '4 cloves' },
    { name: 'Parsley', quantity: '2 tbsp' },
    { name: 'Parmesan', quantity: '¼ cup' },
    { name: 'Salt & pepper', quantity: 'to taste' },
  ],
  steps: [
    {
      instruction:
        'Bring a large pot of salted water to a boil. Add pasta and cook until al dente, about 9 minutes.',
      duration_minutes: 9,
      equipment: ['Large pot'],
      ingredients_used: ['Pasta', 'Salt & pepper'],
    },
    {
      instruction:
        'While pasta cooks, melt butter in a skillet over medium heat. Add minced garlic and sauté until fragrant, about 1 minute.',
      duration_minutes: 1,
      equipment: ['Skillet'],
      ingredients_used: ['Butter', 'Garlic'],
    },
    {
      instruction:
        'Drain pasta, reserving ½ cup pasta water. Toss pasta with garlic butter, adding pasta water as needed.',
      duration_minutes: null,
      equipment: ['Colander'],
      ingredients_used: ['Pasta', 'Butter'],
    },
    {
      instruction:
        'Season with salt, pepper, and parsley. Serve immediately with parmesan on top.',
      duration_minutes: null,
      equipment: [],
      ingredients_used: ['Parsley', 'Parmesan', 'Salt & pepper'],
    },
  ],
}

export function ProductPreviewBanner() {
  const [currentIndex, setCurrentIndex] = useState(0)
  const prefersReducedMotion = useReducedMotion()
  const total = DEMO_RECIPE.steps.length
  const step = DEMO_RECIPE.steps[currentIndex]
  const highlightSet = new Set(step.ingredients_used.map((name) => name.toLowerCase()))

  useEffect(() => {
    if (prefersReducedMotion) return
    const id = setInterval(() => {
      setCurrentIndex((i) => (i + 1) % total)
    }, 4000)
    return () => clearInterval(id)
  }, [total, prefersReducedMotion])

  return (
    <div className="relative w-full">
      <div className="relative flex flex-col overflow-hidden rounded-xl border border-stone-300/80 bg-stone-200/60 shadow-xl md:flex-row md:gap-px">
        <div className="flex min-w-0 flex-1 flex-col bg-white md:flex-[1.65]">
          <div className="flex h-14 items-center border-b border-stone-200 px-4 sm:px-5">
            <span className="block truncate text-base font-semibold leading-none text-stone-900">
              {DEMO_RECIPE.title}
            </span>
          </div>

          <div className="px-4 pt-4 sm:px-5 sm:pt-5">
            <div className="flex gap-1" role="presentation">
              {DEMO_RECIPE.steps.map((_, i) => (
                <div
                  key={i}
                  className={`h-0.5 flex-1 transition-colors duration-500 ${
                    i <= currentIndex ? 'bg-brand-700' : 'bg-stone-200'
                  }`}
                />
              ))}
            </div>
          </div>

          <div className="flex min-h-56 flex-1 px-4 py-4 sm:min-h-64 sm:px-5 sm:py-5 md:min-h-72">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentIndex}
                initial={prefersReducedMotion ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={prefersReducedMotion ? undefined : { opacity: 0, y: -4 }}
                transition={{ duration: 0.22 }}
              >
                <p className="mb-3 text-sm font-medium text-brand-700">
                  Step {currentIndex + 1} of {total}
                </p>
                <p className="font-display text-lg font-medium leading-snug text-stone-900 sm:text-xl md:text-2xl">
                  {step.instruction}
                </p>
                <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm text-stone-500 sm:mt-5">
                  {step.duration_minutes != null && (
                    <span>{step.duration_minutes} min timer</span>
                  )}
                  {step.equipment.map((item) => (
                    <span key={item}>{item}</span>
                  ))}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="flex items-center gap-2 border-t border-stone-200 px-4 py-3 sm:px-5 sm:py-4">
            <span className="inline-flex min-h-11 min-w-24 items-center justify-center rounded-lg border border-stone-200 px-4 py-2.5 text-center text-sm font-semibold text-stone-400">
              Previous
            </span>
            <span className="inline-flex min-h-11 flex-1 items-center justify-center rounded-lg bg-brand-700 px-4 py-2.5 text-center text-sm font-semibold text-white">
              {currentIndex === total - 1 ? 'Done' : 'Next step'}
            </span>
          </div>
        </div>

        <div className="flex min-w-0 flex-col border-t border-stone-200 bg-white md:w-[min(100%,18rem)] md:shrink-0 md:border-t-0 lg:w-[min(100%,20rem)]">
          <div className="flex h-14 items-center border-b border-stone-200 px-4 sm:px-5">
            <h3 className="text-base font-semibold leading-none text-stone-500">Ingredients</h3>
          </div>
          <ul className="grid grid-cols-2 gap-x-2 gap-y-0.5 px-2 py-2 sm:px-3 sm:py-3 md:grid-cols-1 md:overflow-y-auto">
            {DEMO_RECIPE.ingredients.map((ing) => {
              const active = highlightSet.has(ing.name.toLowerCase())
              return (
                <li
                  key={ing.name}
                  className={`flex items-baseline justify-between gap-2 px-2.5 py-2 transition-colors duration-300 sm:gap-3 sm:px-3 sm:py-2.5 ${
                    active ? 'bg-brand-50 text-brand-900' : 'text-stone-800'
                  }`}
                >
                  <span className={`truncate text-sm leading-tight ${active ? 'font-semibold' : 'font-medium'}`}>
                    {ing.name}
                  </span>
                  <span className="shrink-0 text-xs text-stone-500">{ing.quantity}</span>
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </div>
  )
}
