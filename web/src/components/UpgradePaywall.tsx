import { Link } from 'react-router-dom'
import type { UsageSnapshot } from '../types/billing'
import { videoLimitLabel } from '../types/billing'

type PaywallReason = 'quota' | 'duration' | 'expired' | 'upgrade'

interface UpgradePaywallProps {
  reason: PaywallReason
  usage?: UsageSnapshot | null
  compact?: boolean
}

const COPY: Record<PaywallReason, { title: string; body: string }> = {
  quota: {
    title: 'Daily upload limit reached',
    body: 'Free accounts can import 2 recipes a day. Pro unlocks 10 uploads a day and 3-minute videos.',
  },
  duration: {
    title: 'This video is too long for Free',
    body: 'Free imports are limited to 1-minute videos. Upgrade to Pro for clips up to 3 minutes.',
  },
  expired: {
    title: 'This recipe is on the free 14-day window',
    body: 'Free recipes stay viewable for 14 days. Upgrade to Pro to open this one again — and keep every future import.',
  },
  upgrade: {
    title: 'Upgrade to Pro',
    body: '10 uploads a day, 3-minute videos, and recipes that stay in your library.',
  },
}

export function UpgradePaywall({ reason, usage, compact = false }: UpgradePaywallProps) {
  const copy = COPY[reason]
  const configured = usage?.billing_configured ?? true

  return (
    <div
      className={[
        'rounded-2xl border border-amber-200 bg-amber-50',
        compact ? 'px-4 py-3' : 'px-5 py-4',
      ].join(' ')}
    >
      <p className={compact ? 'text-sm font-semibold text-amber-950' : 'font-semibold text-amber-950'}>
        {copy.title}
      </p>
      <p className="mt-1 text-sm text-amber-900">{copy.body}</p>
      {usage && !usage.is_pro && (
        <p className="mt-2 text-xs text-amber-800/90">
          Free: {usage.uploads_limit} uploads/day · videos up to {videoLimitLabel(usage.max_video_seconds)}
          {usage.visibility_days ? ` · ${usage.visibility_days}-day viewing window` : ''}
        </p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {configured ? (
          <Link
            to="/plans"
            className="rounded-xl bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800"
          >
            Upgrade to Pro
          </Link>
        ) : (
          <p className="text-sm text-amber-800">Pro checkout isn’t configured on this server yet.</p>
        )}
        <Link to="/plans" className="text-sm font-medium text-brand-700 hover:text-brand-800">
          View plans
        </Link>
      </div>
    </div>
  )
}
