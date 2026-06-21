export interface Ingredient {
  name: string
  quantity: string
  group: string
}

export interface RecipeStep {
  order: number
  instruction: string
  duration_minutes?: number | null
  ingredients_used: string[]
  equipment: string[]
  image_url?: string | null
  clip_url?: string | null
}

export interface ParsedRecipe {
  title: string
  servings?: number | null
  prep_time_minutes?: number | null
  cook_time_minutes?: number | null
  calories_per_serving?: number | null
  allergens?: string[]
  ingredients: Ingredient[]
  steps: RecipeStep[]
}

export interface ParseRecipeResponse {
  recipe: ParsedRecipe
  used_ai: boolean
  step_image_notes?: string[]
}

export interface RecipeSummary {
  id: string
  title: string
  step_count: number
  used_ai: boolean
  created_at: string
}

export interface RecipeListResponse {
  items: RecipeSummary[]
  total: number
}

export interface RecipeDetailResponse {
  id: string
  title: string
  raw_text: string
  source_type: string
  source_url?: string | null
  used_ai: boolean
  recipe: ParsedRecipe
  created_at: string
}

export interface ReviewDraft {
  rawText: string
  recipe: ParsedRecipe
  usedAi: boolean
  sourceType?: string
  sourceUrl?: string
  stepImageNotes?: string[]
}
