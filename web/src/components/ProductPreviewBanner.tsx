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
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-6 rounded-[2rem] bg-gradient-to-br from-brand-200/50 via-brand-50 to-accent-100/50 blur-2xl"
      />

      <div className="relative flex gap-2 lg:gap-3">
        <div className="flex min-w-0 flex-[1.65] flex-col overflow-hidden rounded-2xl border border-stone-200/80 bg-white shadow-2xl shadow-stone-900/10 ring-1 ring-stone-900/5">
          <div className="border-b border-stone-200 bg-white px-5 py-3.5">
            <span className="block truncate text-base font-semibold text-stone-900">
              {DEMO_RECIPE.title}
            </span>
          </div>

          <div className="px-5 pt-5">
            <div className="flex gap-1">
              {DEMO_RECIPE.steps.map((_, i) => (
                <div
                  key={i}
                  className={`h-1 flex-1 rounded-full transition-colors duration-500 ${
                    i <= currentIndex ? 'bg-brand-600' : 'bg-stone-200'
                  }`}
                />
              ))}
            </div>
          </div>

          <div className="min-h-[260px] flex-1 px-5 py-5 sm:min-h-[300px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentIndex}
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.25 }}
              >
                <p className="mb-3 text-sm font-medium uppercase tracking-wider text-brand-600">
                  Step {currentIndex + 1} of {total}
                </p>
                <p className="text-xl font-semibold leading-snug text-stone-900 sm:text-2xl">
                  {step.instruction}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {step.duration_minutes != null && (
                    <span className="inline-flex items-center gap-2 rounded-full border border-accent-500/30 bg-white px-3 py-1.5 text-xs font-medium text-accent-600">
                      Start {step.duration_minutes} min timer
                    </span>
                  )}
                  {step.equipment.map((item) => (
                    <span
                      key={item}
                      className="rounded-full bg-stone-100 px-3 py-1.5 text-xs font-medium text-stone-600"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-stone-200 bg-white px-5 py-4">
            <span className="min-h-11 min-w-[96px] rounded-xl border border-stone-200 px-4 py-2.5 text-center text-sm font-semibold text-stone-400">
              Previous
            </span>
            <span className="min-h-11 flex-1 rounded-xl bg-brand-600 px-4 py-2.5 text-center text-sm font-semibold text-white">
              {currentIndex === total - 1 ? 'Done' : 'Next step'}
            </span>
          </div>
        </div>

        <div className="flex min-w-0 flex-[0.75] flex-col overflow-hidden rounded-2xl border border-stone-200/80 bg-white shadow-2xl shadow-stone-900/10 ring-1 ring-stone-900/5 sm:flex-[0.8] lg:flex-[0.85]">
          <div className="border-b border-stone-200 px-4 py-3.5 sm:px-5">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-stone-500">
              Ingredients
            </h3>
          </div>
          <ul className="min-h-[260px] flex-1 space-y-1.5 overflow-y-auto px-3 py-3 sm:min-h-[300px] sm:px-4 sm:py-4">
            {DEMO_RECIPE.ingredients.map((ing) => {
              const active = highlightSet.has(ing.name.toLowerCase())
              return (
                <li
                  key={ing.name}
                  className={`flex items-baseline justify-between gap-3 rounded-lg px-2.5 py-2 transition-colors duration-300 sm:px-3 ${
                    active ? 'bg-brand-50 ring-1 ring-brand-200' : ''
                  }`}
                >
                  <span
                    className={`text-sm font-medium leading-tight ${
                      active ? 'text-brand-800' : 'text-stone-800'
                    }`}
                  >
                    {ing.name}
                  </span>
                  <span className="shrink-0 text-xs text-stone-500">{ing.quantity}</span>
                </li>
              )
            })}
          </ul>
        </div>
      </div>

      <p className="mt-4 text-center text-sm font-medium text-stone-500">
        Live preview — one step at a time while you cook
      </p>
    </div>
  )
}
