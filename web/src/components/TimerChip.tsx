import { useEffect, useState } from 'react'

interface TimerChipProps {
  durationMinutes: number
}

export function TimerChip({ durationMinutes }: TimerChipProps) {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null)

  useEffect(() => {
    if (secondsLeft === null || secondsLeft <= 0) return
    const id = setInterval(() => setSecondsLeft((s) => (s !== null && s > 0 ? s - 1 : 0)), 1000)
    return () => clearInterval(id)
  }, [secondsLeft])

  const start = () => setSecondsLeft(durationMinutes * 60)

  const format = (total: number) => {
    const m = Math.floor(total / 60)
    const s = total % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  if (secondsLeft !== null && secondsLeft > 0) {
    return (
      <div className="inline-flex items-center gap-2 rounded-full bg-accent-500/15 px-4 py-2 text-sm font-medium text-accent-600">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-500 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-accent-500" />
        </span>
        {format(secondsLeft)}
      </div>
    )
  }

  if (secondsLeft === 0) {
    return (
      <div className="inline-flex items-center gap-2 rounded-full bg-brand-100 px-4 py-2 text-sm font-medium text-brand-800">
        Timer done!
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={start}
      className="inline-flex items-center gap-2 rounded-full border border-accent-500/30 bg-white px-4 py-2 text-sm font-medium text-accent-600 transition hover:bg-accent-500/10"
    >
      Start {durationMinutes} min timer
    </button>
  )
}
