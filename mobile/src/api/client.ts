import AsyncStorage from '@react-native-async-storage/async-storage'
import { File, UploadType } from 'expo-file-system'
import { API_URL } from '@/constants/api'
import type { AuthResponse, User } from '@/types/auth'
import type {
  ParseRecipeResponse,
  ParsedRecipe,
  RecipeDetailResponse,
  RecipeListResponse,
} from '@/types/recipe'
import type { IngestLinkResponse } from '@/types/ingest'

const TOKEN_KEY = 'yourcookmate_token'

export async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_KEY)
}

export async function setToken(token: string | null): Promise<void> {
  if (token) await AsyncStorage.setItem(TOKEN_KEY, token)
  else await AsyncStorage.removeItem(TOKEN_KEY)
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(`${API_URL}${path}`, { ...options, headers })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    const detail = (body as { detail?: unknown }).detail
    const message =
      typeof detail === 'string'
        ? detail
        : Array.isArray(detail)
          ? detail.map((d: { msg?: string }) => d.msg ?? '').filter(Boolean).join(', ')
          : `Request failed (${res.status})`
    throw new Error(message)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
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

export async function register(
  email: string,
  password: string,
  displayName?: string,
): Promise<AuthResponse> {
  return request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, display_name: displayName }),
  })
}

export async function fetchMe(): Promise<User> {
  return request('/auth/me')
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
  aws_api_url?: string | null
}

export async function getFeatures(): Promise<AppFeatures> {
  const flags = await request<AppFeatures>('/features')
  const envAws = process.env.EXPO_PUBLIC_AWS_API_URL?.trim().replace(/\/$/, '')
  return {
    ...flags,
    aws_api_url: flags.aws_api_url || envAws || null,
  }
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

export async function startInstacartConnect(returnTo = 'yourcookmate://profile'): Promise<{ authorize_url: string }> {
  return request(`/auth/instacart/connect/start?return_to=${encodeURIComponent(returnTo)}`, {
    method: 'POST',
  })
}

export async function disconnectInstacart(): Promise<InstacartConnectStatus> {
  return request('/auth/instacart/connect', { method: 'DELETE' })
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

  const { ingestUsesAws, parseRecipeViaAws } = await import('./ingest')
  if (ingestUsesAws()) {
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
}): Promise<IngestLinkResponse> {
  const { ingestSocialLink: ingestViaAws } = await import('./ingest')
  return ingestViaAws(payload)
}

export async function ingestSocialLinkSync(payload: {
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

export async function fetchLinkPreviewSync(payload: {
  url: string
}): Promise<import('@/types/ingest').LinkPreviewResponse> {
  return request('/ingest/preview', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function listRecipes(q?: string): Promise<RecipeListResponse> {
  const params = q ? `?q=${encodeURIComponent(q)}` : ''
  return request(`/recipes${params}`)
}

export async function getRecipe(id: string): Promise<RecipeDetailResponse> {
  return request(`/recipes/${id}`)
}

export async function updateRecipe(
  id: string,
  recipe: ParsedRecipe,
): Promise<RecipeDetailResponse> {
  return request(`/recipes/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ recipe }),
  })
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

export interface InstacartLinkResponse {
  url: string
  cached: boolean
}

export async function createInstacartLink(recipeId: string): Promise<InstacartLinkResponse> {
  return request(`/recipes/${encodeURIComponent(recipeId)}/instacart-link`, { method: 'POST' })
}

export async function deleteRecipe(id: string): Promise<void> {
  return request(`/recipes/${id}`, { method: 'DELETE' })
}

export async function uploadRecipeIcon(
  id: string,
  file: { uri: string; name: string; type: string },
): Promise<RecipeDetailResponse> {
  const token = await getToken()
  const headers: Record<string, string> = {}
  if (token) headers.Authorization = `Bearer ${token}`

  const localFile = new File(file.uri)
  const result = await localFile.upload(`${API_URL}/recipes/${id}/icon`, {
    uploadType: UploadType.MULTIPART,
    fieldName: 'file',
    mimeType: file.type,
    headers,
  })

  if (result.status < 200 || result.status >= 300) {
    let message = `Request failed (${result.status})`
    try {
      const body = JSON.parse(result.body) as { detail?: unknown }
      if (typeof body.detail === 'string') message = body.detail
    } catch {
      // keep default message
    }
    throw new Error(message)
  }

  return JSON.parse(result.body) as RecipeDetailResponse
}

export async function deleteRecipeIcon(id: string): Promise<RecipeDetailResponse> {
  return request(`/recipes/${id}/icon`, { method: 'DELETE' })
}
