import type { IngestLinkResponse } from '../types/ingest'
import type { RecipeDetailResponse, RecipeListResponse } from '../types/recipe'
import type { AuthResponse, User } from '../types/auth'
import type { ParseRecipeResponse, ParsedRecipe } from '../types/recipe'
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

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
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
    const message =
      typeof detail === 'string'
        ? detail
        : Array.isArray(detail)
          ? detail.map((d: { msg?: string }) => d.msg ?? '').filter(Boolean).join(', ')
          : res.status === 502 || res.status === 503
            ? 'Backend unavailable — make sure npm run dev is running and the API started on port 8000'
            : `Request failed (${res.status})`
    throw new Error(message)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export async function parseRecipe(
  payload: string | {
    raw_text: string
    source_url?: string
    video_duration?: number | null
  },
): Promise<ParseRecipeResponse> {
  const body =
    typeof payload === 'string'
      ? { raw_text: payload }
      : {
          raw_text: payload.raw_text,
          source_url: payload.source_url,
          video_duration: payload.video_duration ?? undefined,
        }
  return request('/recipes/parse', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function ingestSocialLink(payload: {
  url: string
  caption?: string
}): Promise<IngestLinkResponse> {
  return request('/ingest/link', {
    method: 'POST',
    body: JSON.stringify({
      url: payload.url,
      caption: payload.caption || undefined,
    }),
  })
}

export async function register(email: string, password: string, displayName?: string): Promise<AuthResponse> {
  return request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, display_name: displayName }),
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

export async function loginWithApple(idToken: string): Promise<AuthResponse> {
  return request('/auth/apple', {
    method: 'POST',
    body: JSON.stringify({ id_token: idToken }),
  })
}

export async function fetchMe(): Promise<User> {
  return request('/auth/me')
}

export interface AppFeatures {
  instacart: boolean
  instacart_shopping: boolean
  instacart_connect: boolean
}

export async function getFeatures(): Promise<AppFeatures> {
  return request('/features')
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
}): Promise<RecipeDetailResponse> {
  return request('/recipes', {
    method: 'POST',
    body: JSON.stringify({
      raw_text: payload.raw_text,
      recipe: payload.recipe,
      used_ai: payload.used_ai,
      source_type: payload.source_type ?? 'text',
      source_url: payload.source_url ?? null,
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
    const message = typeof detail === 'string' ? detail : `Request failed (${res.status})`
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

export async function getSharedRecipe(slug: string): Promise<SharedRecipeResponse> {
  return request(`/r/${encodeURIComponent(slug)}`)
}

export async function listCommunityRecipes(q?: string): Promise<CommunityRecipeListResponse> {
  const params = q ? `?q=${encodeURIComponent(q)}` : ''
  return request(`/community/recipes${params}`)
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
