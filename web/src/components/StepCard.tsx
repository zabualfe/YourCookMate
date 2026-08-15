import type { RecipeStep } from '../types/recipe'
import { TimerChip } from './TimerChip'

interface StepCardProps {
  step: RecipeStep
  stepNumber: number
  totalSteps: number
}

export function StepCard({ step, stepNumber, totalSteps }: StepCardProps) {
  return (
    <div className="flex min-h-full flex-col items-center justify-center px-6 py-8 text-center sm:px-10">
      {step.clip_url ? (
        <div className="flex max-h-[28dvh] w-full max-w-xl shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-stone-200 bg-stone-100">
          <video
            key={step.clip_url}
            src={step.clip_url}
            poster={step.image_url ?? undefined}
            autoPlay
            loop
            muted
            playsInline
            className="max-h-[28dvh] w-full object-contain"
          />
        </div>
      ) : step.image_url ? (
        <div className="flex max-h-[28dvh] w-full max-w-xl shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-stone-200 bg-stone-100">
          <img
            src={step.image_url}
            alt={`Reference for step ${stepNumber}`}
            className="max-h-[28dvh] w-full object-contain"
          />
        </div>
      ) : null}

      <p
        className={[
          'max-w-xl text-2xl font-semibold leading-snug text-stone-900 sm:text-3xl',
          step.clip_url || step.image_url ? 'mt-6' : '',
        ].join(' ')}
      >
        {step.instruction}
      </p>

      {(step.duration_minutes != null && step.duration_minutes > 0) ||
      step.equipment.length > 0 ? (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {step.duration_minutes != null && step.duration_minutes > 0 && (
            <TimerChip durationMinutes={step.duration_minutes} />
          )}
          {step.equipment.map((item) => (
            <span
              key={item}
              className="rounded-full bg-stone-100 px-3 py-1.5 text-xs font-medium text-stone-600"
            >
              {item}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  )
}
