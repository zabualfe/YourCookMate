import type { IngestLinkResponse } from '../types/ingest'
import type { RecipeDetailResponse, RecipeListResponse } from '../types/recipe'
import type { AuthResponse, User } from '../types/auth'
import type { ParseRecipeResponse, ParsedRecipe } from '../types/recipe'
import type { BillingPlansResponse, UsageSnapshot } from '../types/billing'
import { errorFromDetail } from './errors'
import type {
  CollectionDetailResponse,
  CollectionListResponse,
  CollectionSummary,
  CommunityRecipeListResponse,
  ShareResponse,
  SharedRecipeResponse,
} from '../types/collection'

const BASE = import.meta.env.VITE_API_URL ?? '/api'
const TOKEN_KEY = 'yourcookmate_token'
const USER_KEY = 'yourcookmate_user'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function getCachedUser(): User | null {
  try {
    const raw = localStorage.getItem(USER_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return null
    const user = parsed as User
    if (typeof user.id !== 'string' || typeof user.email !== 'string') return null
    return user
  } catch {
    return null
  }
}

export function setCachedUser(user: User | null) {
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user))
  else localStorage.removeItem(USER_KEY)
}

export function setToken(token: string | null) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token)
    return
  }
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(`${BASE}${path}`, { ...options, headers })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    const detail = (body as { detail?: unknown }).detail
    throw errorFromDetail(res.status, detail)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export async function parseRecipe(
  payload: string | {
    raw_text: string
    source_url?: string
    video_duration?: number | null
    force?: boolean
  },
): Promise<ParseRecipeResponse> {
  const body =
    typeof payload === 'string'
      ? { raw_text: payload }
      : {
          raw_text: payload.raw_text,
          source_url: payload.source_url,
          video_duration: payload.video_duration ?? undefined,
          force: payload.force || undefined,
        }

  const { getAwsIngestBase, parseRecipeViaAws } = await import('./ingest')
  // Locally prefer the FastAPI parser so locale/language fixes apply without waiting on AWS deploy.
  // Production (non-DEV) still uses AWS when configured.
  if (getAwsIngestBase() && !import.meta.env.DEV) {
    return parseRecipeViaAws(body)
  }

  return request('/recipes/parse', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function ingestSocialLink(payload: {
  url: string
  caption?: string
  force?: boolean
  onQueued?: () => void
}): Promise<IngestLinkResponse> {
  const { ingestSocialLink: ingestViaAws } = await import('./ingest')
  return ingestViaAws(payload)
}

/** Direct Render sync ingest (used when VITE_AWS_API_URL is unset). */
export async function ingestSocialLinkSync(payload: {
  url: string
  caption?: string
  force?: boolean
}): Promise<IngestLinkResponse> {
  return request('/ingest/link', {
    method: 'POST',
    body: JSON.stringify({
      url: payload.url,
      caption: payload.caption || undefined,
      force: payload.force || undefined,
    }),
  })
}

export async function lookupSocialLink(url: string): Promise<IngestLinkResponse> {
  return request('/ingest/lookup', {
    method: 'POST',
    body: JSON.stringify({ url }),
  })
}

export async function fetchLinkPreviewSync(payload: {
  url: string
}): Promise<import('../types/ingest').LinkPreviewResponse> {
  return request('/ingest/preview', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function register(
  email: string,
  password: string,
  displayName?: string,
  username?: string,
): Promise<AuthResponse> {
  return request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email,
      password,
      display_name: displayName,
      username: username || undefined,
    }),
  })
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  return request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
}

export async function loginWithGoogle(idToken: string): Promise<AuthResponse> {
  return request('/auth/google', {
    method: 'POST',
    body: JSON.stringify({ id_token: idToken }),
  })
}

export async function loginWithApple(
  idToken: string,
  displayName?: string,
): Promise<AuthResponse> {
  return request('/auth/apple', {
    method: 'POST',
    body: JSON.stringify({
      id_token: idToken,
      display_name: displayName || undefined,
    }),
  })
}

export async function fetchMe(): Promise<User> {
  return request('/auth/me')
}

export async function updateProfile(body: {
  display_name?: string | null
  username?: string
}): Promise<User> {
  return request('/auth/me', {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export async function getBillingPlans(): Promise<BillingPlansResponse> {
  return request('/billing/plans')
}

export async function getBillingUsage(): Promise<UsageSnapshot> {
  return request('/billing/usage')
}

export async function checkUpload(videoDuration?: number | null): Promise<UsageSnapshot> {
  return request('/billing/check-upload', {
    method: 'POST',
    body: JSON.stringify({
      video_duration: videoDuration ?? undefined,
    }),
  })
}

export async function startCheckout(
  successPath = '/billing/success',
  cancelPath = '/plans',
): Promise<{ url: string }> {
  return request('/billing/checkout', {
    method: 'POST',
    body: JSON.stringify({ success_path: successPath, cancel_path: cancelPath }),
  })
}

export async function startBillingPortal(): Promise<{ url: string }> {
  return request('/billing/portal', { method: 'POST' })
}

export async function cancelPlan(): Promise<BillingPlansResponse> {
  return request('/billing/cancel', { method: 'POST' })
}

export async function resumePlan(): Promise<BillingPlansResponse> {
  return request('/billing/resume', { method: 'POST' })
}

export interface AppFeatures {
  auth: boolean
  registration: boolean
  ai: boolean
  social_ingest: boolean
  community: boolean
  instacart: boolean
  instacart_shopping: boolean
  instacart_connect: boolean
  aws_transcribe?: boolean
  /** Set on Vercel via VITE_AWS_API_URL or AWS_API_URL — enables async ingest through API Gateway */
  aws_api_url?: string | null
}

export async function getFeatures(): Promise<AppFeatures> {
  const res = await fetch('/api/features', { cache: 'no-store' })
  if (!res.ok) {
    throw new Error('Failed to load feature flags')
  }
  return res.json() as Promise<AppFeatures>
}

export interface AdminFeatureFlag {
  key: string
  enabled: boolean
  label: string
  description: string
}

export interface AdminFeatureFlagsResponse {
  flags: AdminFeatureFlag[]
  updated_at?: string | null
}

export async function getAdminStatus(): Promise<{ is_admin: boolean }> {
  return request('/admin/status')
}

export async function getAdminFeatureFlags(): Promise<AdminFeatureFlagsResponse> {
  return request('/admin/feature-flags')
}

export async function updateAdminFeatureFlags(
  flags: Record<string, boolean>,
): Promise<AppFeatures> {
  return request('/admin/feature-flags', {
    method: 'PUT',
    body: JSON.stringify(flags),
  })
}

export interface InstacartConnectStatus {
  configured: boolean
  linked: boolean
  instacart_plus_member?: boolean | null
  expired_at?: string | null
}

export async function getInstacartConnectStatus(): Promise<InstacartConnectStatus> {
  return request('/auth/instacart/connect/status')
}

export async function startInstacartConnect(returnTo = '/profile'): Promise<{ authorize_url: string }> {
  return request(`/auth/instacart/connect/start?return_to=${encodeURIComponent(returnTo)}`, {
    method: 'POST',
  })
}

export async function disconnectInstacart(): Promise<InstacartConnectStatus> {
  return request('/auth/instacart/connect', { method: 'DELETE' })
}

export async function verifyEmail(token: string): Promise<AuthResponse> {
  return request('/auth/verify-email', {
    method: 'POST',
    body: JSON.stringify({ token }),
  })
}

export async function resendVerification(): Promise<{ message: string; verification_url?: string | null }> {
  return request('/auth/resend-verification', { method: 'POST' })
}

export async function saveRecipe(payload: {
  raw_text: string
  recipe: ParsedRecipe
  used_ai: boolean
  source_type?: string
  source_url?: string
  allow_duplicate?: boolean
  usage_already_recorded?: boolean
}): Promise<RecipeDetailResponse> {
  return request('/recipes', {
    method: 'POST',
    body: JSON.stringify({
      raw_text: payload.raw_text,
      recipe: payload.recipe,
      used_ai: payload.used_ai,
      source_type: payload.source_type ?? 'text',
      source_url: payload.source_url ?? null,
      allow_duplicate: payload.allow_duplicate || undefined,
      usage_already_recorded: payload.usage_already_recorded || undefined,
    }),
  })
}

export async function listRecipes(q?: string): Promise<RecipeListResponse> {
  const params = q ? `?q=${encodeURIComponent(q)}` : ''
  return request(`/recipes${params}`)
}

export async function getRecipe(id: string): Promise<RecipeDetailResponse> {
  return request(`/recipes/${id}`)
}

export async function updateRecipe(id: string, recipe: ParsedRecipe): Promise<RecipeDetailResponse> {
  return request(`/recipes/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ recipe }),
  })
}

async function uploadRequest<T>(path: string, file: File): Promise<T> {
  const token = getToken()
  const form = new FormData()
  form.append('file', file)
  const headers: Record<string, string> = {}
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(`${BASE}${path}`, { method: 'POST', body: form, headers })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    const detail = (body as { detail?: unknown }).detail
    const message = typeof detail === 'string' ? detail : errorFromDetail(res.status, detail).message
    throw new Error(message)
  }
  return res.json() as Promise<T>
}

export async function uploadRecipeIcon(id: string, file: File): Promise<RecipeDetailResponse> {
  return uploadRequest(`/recipes/${id}/icon`, file)
}

export async function deleteRecipeIcon(id: string): Promise<RecipeDetailResponse> {
  return request(`/recipes/${id}/icon`, { method: 'DELETE' })
}

export async function deleteRecipe(id: string): Promise<void> {
  return request(`/recipes/${id}`, { method: 'DELETE' })
}

export async function updateRecipeShare(id: string, enabled: boolean): Promise<ShareResponse> {
  return request(`/recipes/${id}/share`, {
    method: 'POST',
    body: JSON.stringify({ enabled }),
  })
}

export async function updateRecipeCommunity(
  id: string,
  enabled: boolean,
): Promise<ShareResponse> {
  return request(`/recipes/${id}/community`, {
    method: 'POST',
    body: JSON.stringify({ enabled }),
  })
}

export async function updateRecipePin(
  id: string,
  enabled: boolean,
): Promise<RecipeDetailResponse> {
  return request(`/recipes/${id}/pin`, {
    method: 'POST',
    body: JSON.stringify({ enabled }),
  })
}

export async function getSharedRecipe(slug: string): Promise<SharedRecipeResponse> {
  return request(`/r/${encodeURIComponent(slug)}`)
}

export async function listCommunityRecipes(
  q?: string,
  feed: import('../types/social').CommunityFeed = 'discover',
): Promise<CommunityRecipeListResponse> {
  const params = new URLSearchParams()
  if (q) params.set('q', q)
  if (feed && feed !== 'discover') params.set('feed', feed)
  const query = params.toString()
  return request(`/community/recipes${query ? `?${query}` : ''}`)
}

export async function checkUsername(username: string): Promise<import('../types/social').UsernameCheckResponse> {
  return request(`/users/check-username?username=${encodeURIComponent(username)}`)
}

export async function getPublicProfile(username: string): Promise<import('../types/social').PublicProfile> {
  return request(`/users/${encodeURIComponent(username)}`)
}

export async function followUser(username: string): Promise<import('../types/social').FollowResponse> {
  return request(`/users/${encodeURIComponent(username)}/follow`, { method: 'POST' })
}

export async function unfollowUser(username: string): Promise<import('../types/social').FollowResponse> {
  return request(`/users/${encodeURIComponent(username)}/follow`, { method: 'DELETE' })
}

export async function listFollowers(username: string): Promise<import('../types/social').PublicUserListResponse> {
  return request(`/users/${encodeURIComponent(username)}/followers`)
}

export async function listFollowing(username: string): Promise<import('../types/social').PublicUserListResponse> {
  return request(`/users/${encodeURIComponent(username)}/following`)
}

export async function saveSharedRecipe(slug: string): Promise<RecipeDetailResponse> {
  return request(`/r/${encodeURIComponent(slug)}/save`, { method: 'POST' })
}

export interface InstacartLinkResponse {
  url: string
  cached: boolean
}

export async function createInstacartLink(recipeId: string): Promise<InstacartLinkResponse> {
  return request(`/recipes/${encodeURIComponent(recipeId)}/instacart-link`, { method: 'POST' })
}

export async function createSharedInstacartLink(slug: string): Promise<InstacartLinkResponse> {
  return request(`/r/${encodeURIComponent(slug)}/instacart-link`, { method: 'POST' })
}

export async function listCollections(recipeId?: string): Promise<CollectionListResponse> {
  const params = recipeId ? `?recipe_id=${encodeURIComponent(recipeId)}` : ''
  return request(`/collections${params}`)
}

export async function createCollection(name: string): Promise<CollectionSummary> {
  return request('/collections', {
    method: 'POST',
    body: JSON.stringify({ name }),
  })
}

export async function getCollection(id: string): Promise<CollectionDetailResponse> {
  return request(`/collections/${id}`)
}

export async function updateCollection(id: string, name: string): Promise<CollectionSummary> {
  return request(`/collections/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ name }),
  })
}

export async function deleteCollection(id: string): Promise<void> {
  return request(`/collections/${id}`, { method: 'DELETE' })
}

export async function addRecipeToCollection(collectionId: string, recipeId: string): Promise<void> {
  await request(`/collections/${collectionId}/recipes/${recipeId}`, { method: 'POST' })
}

export async function removeRecipeFromCollection(collectionId: string, recipeId: string): Promise<void> {
  await request(`/collections/${collectionId}/recipes/${recipeId}`, { method: 'DELETE' })
}
