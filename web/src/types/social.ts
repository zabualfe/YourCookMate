export interface PublicUserCard {
  username: string
  display_name?: string | null
  avatar_url?: string | null
  author_name: string
}

export interface PublicProfile extends PublicUserCard {
  follower_count: number
  following_count: number
  is_following: boolean
  is_self: boolean
  recipes: import('./collection').CommunityRecipeSummary[]
}

export interface PublicUserListResponse {
  items: PublicUserCard[]
  total: number
}

export interface UsernameCheckResponse {
  available: boolean
  username?: string | null
  reason?: string | null
}

export interface FollowResponse {
  following: boolean
  follower_count: number
}

export type CommunityFeed = 'discover' | 'following'
