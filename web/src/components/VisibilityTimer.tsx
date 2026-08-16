import { useId } from 'react'
import { visibilityExplanation, visibilityStatus } from '../lib/visibility'

export function VisibilityTimer({
  locked,
  visibleUntil,
  className = '',
}: {
  locked?: boolean
  visibleUntil?: string | null
  className?: string
}) {
  const tooltipId = useId()
  const status = visibilityStatus(locked, visibleUntil)
  if (!status || status.kind === 'locked') return null
  const explanation = visibilityExplanation(locked, visibleUntil)
  if (!explanation) return null

  const tone =
    status.kind === 'today' || status.kind === 'soon'
      ? 'bg-amber-50 text-amber-800'
      : 'bg-stone-100 text-stone-600'

  return (
    <span
      className={`group/timer relative inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${tone} ${className}`}
      aria-describedby={tooltipId}
    >
      <ClockIcon />
      {status.label}
      <span
        id={tooltipId}
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-0 z-50 mb-1.5 w-56 rounded-lg bg-stone-900 px-2.5 py-2 text-left text-[11px] font-medium normal-case leading-snug tracking-normal text-white opacity-0 shadow-lg transition-opacity group-hover/timer:opacity-100 group-focus-visible/timer:opacity-100"
      >
        {explanation}
      </span>
    </span>
  )
}

function ClockIcon() {
  return (
    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.4}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 8v4l2.5 1.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  )
}
