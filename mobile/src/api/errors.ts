export type BillingErrorCode = 'daily_upload_limit' | 'video_too_long' | 'recipe_expired'

export class ApiError extends Error {
  status: number
  code?: string
  extra: Record<string, unknown>

  constructor(message: string, status: number, code?: string, extra: Record<string, unknown> = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.extra = extra
  }
}

export function isBillingError(error: unknown, code?: BillingErrorCode): error is ApiError {
  if (!(error instanceof ApiError) || !error.code) return false
  if (code) return error.code === code
  return (
    error.code === 'daily_upload_limit' ||
    error.code === 'video_too_long' ||
    error.code === 'recipe_expired'
  )
}

export function isSocialFetchError(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase()
  return (
    message.includes('caption') ||
    message.includes('fetch') ||
    message.includes('blocked') ||
    message.includes('login') ||
    message.includes('cookies') ||
    message.includes('unavailable to automatic')
  )
}

export function errorFromDetail(status: number, detail: unknown): Error {
  if (typeof detail === 'string') {
    return new ApiError(detail, status)
  }
  if (Array.isArray(detail)) {
    const message = detail.map((d: { msg?: string }) => d.msg ?? '').filter(Boolean).join(', ')
    return new ApiError(message || `Request failed (${status})`, status)
  }
  if (detail && typeof detail === 'object' && 'message' in detail) {
    const body = detail as { code?: string; message: string } & Record<string, unknown>
    const { code, message, ...extra } = body
    return new ApiError(message, status, code, extra)
  }
  return new ApiError(`Request failed (${status})`, status)
}
