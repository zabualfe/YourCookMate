import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'

const FULL_STEPS = [
  { label: 'Opening your link', target: 16 },
  { label: 'Watching the video', target: 62 },
  { label: 'Building step-by-step cards', target: 94 },
] as const

const PARSE_ONLY_STEPS = [{ label: 'Building step-by-step cards', target: 94 }] as const

interface RecipeCreateProgressProps {
  /** Active step index (0-based). */
  step: number
  /** Full 3-step flow or parse-only retry. */
  mode?: 'full' | 'parse-only'
}

export function RecipeCreateProgress({ step, mode = 'full' }: RecipeCreateProgressProps) {
  const steps = mode === 'full' ? FULL_STEPS : PARSE_ONLY_STEPS
  const safeStep = Math.min(step, steps.length - 1)
  const target = steps[safeStep]?.target ?? 94

  const [percent, setPercent] = useState(4)

  useEffect(() => {
    setPercent((p) => Math.max(p, 4))
  }, [step])

  useEffect(() => {
    const creep = window.setInterval(() => {
      setPercent((p) => {
        if (p >= target) return p
        const gap = target - p
        const bump = gap > 20 ? 1.2 : gap > 8 ? 0.6 : 0.25
        return Math.min(target, p + bump)
      })
    }, 120)
    return () => window.clearInterval(creep)
  }, [target])

  return (
    <div
      className="rounded-2xl border border-brand-200 bg-brand-50/60 p-5"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-brand-800">Working on your recipe…</p>
        <span className="text-xs font-medium tabular-nums text-brand-600">{Math.round(percent)}%</span>
      </div>

      <div className="mb-5 h-2.5 overflow-hidden rounded-full bg-brand-100">
        <div
          className="h-full rounded-full bg-brand-600 transition-[width] duration-300 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>

      <ol className="space-y-2.5">
        {steps.map((item, index) => {
          const done = index < safeStep
          const current = index === safeStep
          return (
            <li
              key={item.label}
              className={`flex items-center gap-3 text-sm transition-colors ${
                done ? 'text-brand-700' : current ? 'font-medium text-stone-900' : 'text-stone-400'
              }`}
            >
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs ${
                  done
                    ? 'border-brand-600 bg-brand-600 text-white'
                    : current
                      ? 'border-brand-500 bg-white text-brand-600'
                      : 'border-stone-200 bg-white text-stone-300'
                }`}
                aria-hidden
              >
                {done ? <Check className="h-3.5 w-3.5" strokeWidth={2.5} /> : index + 1}
              </span>
              <span>{item.label}</span>
              {current && (
                <span className="ml-auto h-1.5 w-1.5 animate-pulse rounded-full bg-brand-500 motion-reduce:animate-none" aria-hidden />
              )}
            </li>
          )
        })}
      </ol>

      <p className="mt-4 text-xs text-stone-500">
        Longer videos can take up to a minute — hang tight, we&apos;re on it.
      </p>
    </div>
  )
}
