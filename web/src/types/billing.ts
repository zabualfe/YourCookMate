export interface PlanLimits {
  id: string
  name: string
  uploads_per_day: number
  max_video_seconds: number
  visibility_days?: number | null
  price_display?: string | null
}

export interface UsageSnapshot {
  plan: string
  is_pro: boolean
  uploads_used_today: number
  uploads_remaining_today: number
  uploads_limit: number
  max_video_seconds: number
  visibility_days?: number | null
  period_end: string
  billing_configured: boolean
}

export interface BillingPlansResponse {
  current_plan: string
  is_pro: boolean
  billing_configured: boolean
  plans: PlanLimits[]
  usage: UsageSnapshot
  cancel_at_period_end?: boolean
  subscription_ends_at?: string | null
}

export function videoLimitLabel(seconds: number): string {
  const minutes = Math.max(1, Math.round(seconds / 60))
  return minutes === 1 ? '1 minute' : `${minutes} minutes`
}

export function uploadsLeftLabel(usage: UsageSnapshot): string {
  const left = usage.uploads_remaining_today
  const limit = usage.uploads_limit
  if (left <= 0) return `0 of ${limit} uploads left today`
  return `${left} of ${limit} upload${limit === 1 ? '' : 's'} left today`
}
