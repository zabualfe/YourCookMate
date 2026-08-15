import type { Ingredient, ParsedRecipe, RecipeStep } from '../types/recipe'

function ingredientKey(name: string): string {
  return name.trim().toLowerCase()
}

function matchIngredientNames(
  recipeIngredients: Ingredient[],
  names: string[],
): Ingredient[] {
  if (!names.length) return []

  const byKey = new Map(recipeIngredients.map((ing) => [ingredientKey(ing.name), ing]))
  const matched: Ingredient[] = []
  const seen = new Set<string>()

  for (const raw of names) {
    const key = ingredientKey(raw)
    if (!key || seen.has(key)) continue

    const exact = byKey.get(key)
    if (exact) {
      matched.push(exact)
      seen.add(key)
      continue
    }

    const fuzzy = recipeIngredients.find((ing) => {
      const ingKey = ingredientKey(ing.name)
      return ingKey.includes(key) || key.includes(ingKey)
    })
    if (fuzzy && !seen.has(ingredientKey(fuzzy.name))) {
      matched.push(fuzzy)
      seen.add(ingredientKey(fuzzy.name))
    }
  }

  return matched
}

/** Ingredients tied to a specific step — used list first, then names mentioned in the instruction. */
export function ingredientsForStep(
  recipe: ParsedRecipe,
  step: RecipeStep | null,
): Ingredient[] {
  if (!step) return []

  const fromUsed = matchIngredientNames(recipe.ingredients, step.ingredients_used ?? [])
  if (fromUsed.length) return fromUsed

  const instruction = step.instruction.toLowerCase()
  const mentioned = recipe.ingredients.filter((ing) => {
    const name = ingredientKey(ing.name)
    if (name.length < 3) return false
    return instruction.includes(name)
  })
  if (mentioned.length) return mentioned

  return []
}

export const VIDEO_SOURCE_TYPES = new Set([
  'instagram',
  'tiktok',
  'youtube',
  'facebook',
  'pinterest',
  'vimeo',
  'video',
])

export function isVideoSourceType(sourceType: string | null | undefined): boolean {
  if (!sourceType) return false
  return VIDEO_SOURCE_TYPES.has(sourceType.toLowerCase())
}
