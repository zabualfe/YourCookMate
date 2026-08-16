const MS_PER_DAY = 86_400_000

export function daysLeftUntil(iso?: string | null, now = Date.now()): number | null {
  if (!iso) return null
  const until = new Date(iso).getTime()
  if (Number.isNaN(until)) return null
  return Math.ceil((until - now) / MS_PER_DAY)
}

export type VisibilityKind = 'ok' | 'soon' | 'today' | 'locked'

export interface VisibilityStatus {
  kind: VisibilityKind
  daysLeft: number
  label: string
}

export function visibilityStatus(
  locked?: boolean,
  visibleUntil?: string | null,
): VisibilityStatus | null {
  if (locked) {
    return { kind: 'locked', daysLeft: 0, label: 'Locked' }
  }
  const daysLeft = daysLeftUntil(visibleUntil)
  if (daysLeft === null) return null
  if (daysLeft <= 0) {
    return { kind: 'today', daysLeft: 0, label: 'Expires today' }
  }
  if (daysLeft === 1) {
    return { kind: 'soon', daysLeft: 1, label: '1 day left' }
  }
  return {
    kind: daysLeft <= 3 ? 'soon' : 'ok',
    daysLeft,
    label: `${daysLeft} days left`,
  }
}

export function visibilityExplanation(
  locked?: boolean,
  visibleUntil?: string | null,
): string | null {
  const status = visibilityStatus(locked, visibleUntil)
  if (!status) return null
  if (status.kind === 'locked') {
    return 'This recipe’s 14-day Free viewing window has ended. Upgrade to Pro to open it again.'
  }
  const dateLabel = visibleUntil
    ? new Date(visibleUntil).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null
  if (status.kind === 'today' || !dateLabel) {
    return 'Free plans keep recipes viewable for 14 days. This one locks at the end of today unless you upgrade to Pro.'
  }
  return `Free plans keep recipes viewable for 14 days. This one stays open until ${dateLabel}. Upgrade to Pro to keep it in your library.`
}
