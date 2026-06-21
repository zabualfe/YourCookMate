import type { ParsedRecipe } from '../types/recipe'

function formatAllergen(label: string) {
  return label
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

interface RecipeNutritionInfoProps {
  recipe: Pick<ParsedRecipe, 'calories_per_serving' | 'allergens'>
  className?: string
}

export function RecipeNutritionInfo({ recipe, className = '' }: RecipeNutritionInfoProps) {
  const allergens = recipe.allergens ?? []
  const hasCalories = recipe.calories_per_serving != null
  const hasAllergens = allergens.length > 0

  if (!hasCalories && !hasAllergens) return null

  return (
    <div className={['flex flex-wrap items-center gap-2', className].join(' ')}>
      {hasCalories && (
        <span className="inline-flex items-center rounded-full bg-amber-50 px-3 py-1 text-sm font-medium text-amber-900 ring-1 ring-amber-200">
          ~{recipe.calories_per_serving} cal / serving
          <span className="ml-1 text-xs font-normal text-amber-700">(est.)</span>
        </span>
      )}
      {hasAllergens ? (
        allergens.map((allergen) => (
          <span
            key={allergen}
            className="inline-flex items-center rounded-full bg-red-50 px-3 py-1 text-sm font-medium text-red-800 ring-1 ring-red-200"
          >
            {formatAllergen(allergen)}
          </span>
        ))
      ) : (
        hasCalories && (
          <span className="text-sm text-stone-500">No common allergens detected</span>
        )
      )}
    </div>
  )
}

interface RecipeNutritionFieldsProps {
  calories: number | null | undefined
  allergens: string[] | undefined
  onCaloriesChange: (value: number | null) => void
  onAllergensChange: (value: string[]) => void
  inputClass: string
}

export function RecipeNutritionFields({
  calories,
  allergens,
  onCaloriesChange,
  onAllergensChange,
  inputClass,
}: RecipeNutritionFieldsProps) {
  return (
    <>
      <label className="flex items-center gap-1.5">
        Cal / serving
        <input
          type="number"
          min={0}
          value={calories ?? ''}
          onChange={(e) =>
            onCaloriesChange(e.target.value ? Number(e.target.value) : null)
          }
          className={inputClass}
          placeholder="est."
        />
      </label>
      <label className="flex min-w-[12rem] flex-1 items-center gap-1.5">
        Allergens
        <input
          type="text"
          value={(allergens ?? []).join(', ')}
          onChange={(e) =>
            onAllergensChange(
              e.target.value
                .split(',')
                .map((item) => item.trim().toLowerCase())
                .filter(Boolean),
            )
          }
          placeholder="dairy, gluten"
          className="min-w-0 flex-1 rounded-lg border border-stone-200 bg-white px-2 py-1 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20"
        />
      </label>
    </>
  )
}
