import type { StoredRecipe } from '../types/recipe'

const STORAGE_KEY = 'yourcookmate_recipes'

export function getAllRecipes(): StoredRecipe[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as StoredRecipe[]
  } catch {
    return []
  }
}

export function getRecipe(id: string): StoredRecipe | undefined {
  return getAllRecipes().find((r) => r.id === id)
}

export function saveRecipe(recipe: StoredRecipe): void {
  const all = getAllRecipes().filter((r) => r.id !== recipe.id)
  all.unshift(recipe)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
}

export function createRecipeId(): string {
  return crypto.randomUUID()
}

export function getRecentRecipes(limit = 5): StoredRecipe[] {
  return getAllRecipes().slice(0, limit)
}
