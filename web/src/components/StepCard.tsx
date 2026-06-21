import { motion } from 'framer-motion'
import type { RecipeStep } from '../types/recipe'
import { TimerChip } from './TimerChip'

interface StepCardProps {
  step: RecipeStep
  stepNumber: number
  totalSteps: number
}

export function StepCard({ step, stepNumber, totalSteps }: StepCardProps) {
  const hasMedia = Boolean(step.clip_url || step.image_url)

  return (
    <motion.div
      key={step.order}
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -24 }}
      transition={{ duration: 0.25 }}
      className="flex flex-1 flex-col overflow-hidden px-4 py-4"
    >
      <p className="mb-3 shrink-0 text-sm font-medium uppercase tracking-wider text-brand-600">
        Step {stepNumber} of {totalSteps}
      </p>

      {step.clip_url ? (
        <div className="mb-4 flex max-h-[40dvh] w-full shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-stone-200 bg-stone-100 shadow-sm">
          <video
            key={step.clip_url}
            src={step.clip_url}
            poster={step.image_url ?? undefined}
            autoPlay
            loop
            muted
            playsInline
            className="max-h-[40dvh] w-full object-contain"
          />
        </div>
      ) : step.image_url ? (
        <div className="mb-4 flex max-h-[40dvh] w-full shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-stone-200 bg-stone-100 shadow-sm">
          <img
            src={step.image_url}
            alt={`Reference for step ${stepNumber}`}
            className="max-h-[40dvh] w-full object-contain"
          />
        </div>
      ) : null}

      <div className={hasMedia ? 'shrink-0' : 'flex flex-1 flex-col justify-center'}>
        <p className="text-xl font-semibold leading-snug text-stone-900 sm:text-2xl">
          {step.instruction}
        </p>

        <div className="mt-4 flex flex-wrap gap-3">
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
      </div>
    </motion.div>
  )
}
