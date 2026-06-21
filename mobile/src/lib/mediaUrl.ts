import { API_URL } from '@/constants/api'

export function resolveMediaUrl(url?: string | null): string | null {
  if (!url) return null
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  if (url.startsWith('/uploads/')) return `${API_URL}${url}`
  return `${API_URL}/uploads/${url.replace(/^\//, '')}`
}
