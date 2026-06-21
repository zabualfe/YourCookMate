import { AnimatePresence, motion } from 'framer-motion'
import type { Ingredient } from '../types/recipe'

interface IngredientDrawerProps {
  open: boolean
  onClose: () => void
  ingredients: Ingredient[]
  highlighted?: string[]
}

export function IngredientDrawer({ open, onClose, ingredients, highlighted = [] }: IngredientDrawerProps) {
  const highlightSet = new Set(highlighted.map((h) => h.toLowerCase()))

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="fixed inset-x-0 bottom-0 z-50 max-h-[70dvh] overflow-y-auto rounded-t-3xl bg-white p-6 shadow-2xl"
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-stone-200" />
            <h3 className="mb-4 text-lg font-semibold text-stone-900">Ingredients</h3>
            <ul className="space-y-3">
              {ingredients.map((ing) => {
                const active = highlightSet.has(ing.name.toLowerCase())
                return (
                  <li
                    key={ing.name}
                    className={`flex items-baseline justify-between gap-4 rounded-xl px-3 py-2 ${
                      active ? 'bg-brand-50 ring-1 ring-brand-200' : ''
                    }`}
                  >
                    <span className={`font-medium ${active ? 'text-brand-800' : 'text-stone-800'}`}>
                      {ing.name}
                    </span>
                    {ing.quantity && (
                      <span className="shrink-0 text-sm text-stone-500">{ing.quantity}</span>
                    )}
                  </li>
                )
              })}
            </ul>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
