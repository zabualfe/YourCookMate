import { API_URL } from '@/constants/api'

const DEV_HOSTS = new Set(['localhost', '127.0.0.1', '10.0.2.2'])

function apiOrigin(): string {
  try {
    return new URL(API_URL).origin
  } catch {
    return API_URL.replace(/\/$/, '')
  }
}

/** Append a cache-busting query param so replaced icons reload immediately. */
export function bustIconUrl(url: string | null | undefined): string | null {
  if (!url) return null
  const base = url.split('?')[0]
  return `${base}?v=${Date.now()}`
}

/** Resolve recipe media / icon URLs for the mobile API base (handles relative paths and dev hosts). */
export function resolveMediaUrl(url?: string | null): string | null {
  if (!url) return null
  const trimmed = url.trim()
  if (!trimmed) return null

  if (trimmed.startsWith('data:') || trimmed.startsWith('file:')) {
    return trimmed
  }

  if (trimmed.startsWith('/uploads/')) {
    return `${API_URL}${trimmed}`
  }

  if (trimmed.startsWith('uploads/')) {
    return `${API_URL}/${trimmed}`
  }

  try {
    const parsed = new URL(trimmed)
    const pathWithQuery = `${parsed.pathname}${parsed.search}`

    if (parsed.pathname.startsWith('/uploads/')) {
      if (DEV_HOSTS.has(parsed.hostname) || parsed.origin !== apiOrigin()) {
        return `${API_URL}${pathWithQuery}`
      }
    }

    return trimmed
  } catch {
    return `${API_URL}/uploads/${trimmed.replace(/^\//, '')}`
  }
}
