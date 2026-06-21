export interface User {
  id: string
  email: string
  display_name?: string | null
  avatar_url?: string | null
  email_verified: boolean
}

export interface AuthResponse {
  access_token: string
  token_type: string
  user: User
  verification_url?: string | null
}
