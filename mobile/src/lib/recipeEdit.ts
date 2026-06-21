import type { ParsedRecipe } from '@/types/recipe'

export function cloneRecipe(recipe: ParsedRecipe): ParsedRecipe {
  return JSON.parse(JSON.stringify(recipe)) as ParsedRecipe
}

export function normalizeRecipe(recipe: ParsedRecipe): ParsedRecipe {
  return {
    ...recipe,
    title: recipe.title.trim() || 'Untitled recipe',
    ingredients: recipe.ingredients
      .map((ing) => ({ ...ing, name: ing.name.trim(), quantity: ing.quantity.trim() }))
      .filter((ing) => ing.name),
    steps: recipe.steps
      .map((step, i) => ({ ...step, instruction: step.instruction.trim(), order: i + 1 }))
      .filter((step) => step.instruction),
  }
}
