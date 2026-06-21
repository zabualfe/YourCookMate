export interface CollectionSummary {
  id: string
  name: string
  recipe_count: number
  created_at: string
  contains_recipe?: boolean | null
}

export interface RecipeCollectionTag {
  id: string
  name: string
}

export interface CollectionListResponse {
  items: CollectionSummary[]
  total: number
}

export interface CollectionRecipeSummary {
  id: string
  title: string
  step_count: number
  used_ai: boolean
  created_at: string
}

export interface CollectionDetailResponse {
  id: string
  name: string
  created_at: string
  recipes: CollectionRecipeSummary[]
}

export interface ShareResponse {
  is_public: boolean
  share_slug?: string | null
  share_url?: string | null
}

export interface CommunityRecipeSummary {
  slug: string
  title: string
  author_name: string
  step_count: number
  used_ai: boolean
  created_at: string
  icon_url?: string | null
}

export interface CommunityRecipeListResponse {
  items: CommunityRecipeSummary[]
  total: number
}

export interface SharedRecipeResponse {
  slug: string
  title: string
  recipe: import('./recipe').ParsedRecipe
  author_name: string
  step_count: number
  used_ai: boolean
  source_type?: string
  source_url?: string | null
  icon_url?: string | null
}
