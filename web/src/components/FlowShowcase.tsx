import { useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Check, GripVertical, Link2, Timer } from 'lucide-react'

type StageId = 'share' | 'review' | 'cook'

interface Stage {
  id: StageId
  label: string
  title: string
  description: string
}

const STAGES: Stage[] = [
  {
    id: 'share',
    label: 'Share',
    title: 'Paste any cooking link',
    description:
      'Drop a TikTok, YouTube, Instagram, or recipe blog URL. We read the video or page and extract the recipe for you.',
  },
  {
    id: 'review',
    label: 'Review',
    title: 'Tweak before you cook',
    description:
      'Edit steps, fix ingredient amounts, and reorder anything. Your recipe card is ready when you are.',
  },
  {
    id: 'cook',
    label: 'Cook',
    title: 'One step at a time',
    description:
      'Full-screen step cards with timers, gear tags, and highlighted ingredients — designed for messy hands.',
  },
]

function ShareMock() {
  return (
    <div className="flex h-full min-h-80 flex-col overflow-hidden rounded-xl border border-stone-200 bg-white shadow-xl">
      <div className="border-b border-stone-200 px-4 py-4 sm:px-5">
        <p className="text-sm text-stone-500">Add recipe</p>
        <p className="mt-0.5 text-base font-semibold text-stone-900">From a link</p>
      </div>
      <div className="flex flex-1 flex-col gap-4 p-4 sm:p-5">
        <div className="border border-stone-200 bg-surface px-4 py-5">
          <div className="flex items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center bg-brand-700 text-white">
              <Link2 className="size-5" strokeWidth={2} aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-stone-800">
                tiktok.com/@chef/video/…
              </p>
              <p className="text-xs text-stone-500">TikTok · 2:14</p>
            </div>
          </div>
        </div>
        <div className="mt-auto rounded-lg bg-brand-700 px-4 py-3 text-center text-sm font-semibold text-white">
          Create step-by-step recipe
        </div>
      </div>
    </div>
  )
}

function ReviewMock() {
  const steps = [
    'Boil pasta until al dente, about 9 min.',
    'Sauté garlic in butter until fragrant.',
    'Toss pasta with garlic butter and parsley.',
  ]

  return (
    <div className="flex h-full min-h-80 flex-col overflow-hidden rounded-xl border border-stone-200 bg-white shadow-xl">
      <div className="border-b border-stone-200 px-4 py-4 sm:px-5">
        <p className="text-sm text-stone-500">Review</p>
        <p className="mt-0.5 text-base font-semibold text-stone-900">Garlic Butter Pasta</p>
      </div>
      <ul className="flex-1 space-y-2 p-4">
        {steps.map((text, i) => (
          <li
            key={i}
            className="flex items-start gap-2 border border-stone-200 bg-surface px-3 py-3"
          >
            <GripVertical className="mt-0.5 size-4 shrink-0 text-stone-300" aria-hidden />
            <div className="min-w-0 flex-1">
              <span className="text-xs font-semibold text-stone-500">Step {i + 1}</span>
              <p className="mt-0.5 text-sm leading-snug text-stone-800">{text}</p>
            </div>
            <Check className="mt-0.5 size-4 shrink-0 text-brand-600" aria-hidden />
          </li>
        ))}
      </ul>
      <div className="border-t border-stone-200 px-4 py-4 sm:px-5">
        <div className="rounded-lg bg-brand-700 px-4 py-3 text-center text-sm font-semibold text-white">
          Save & start cooking
        </div>
      </div>
    </div>
  )
}

function CookMock() {
  return (
    <div className="flex h-full min-h-80 flex-col overflow-hidden rounded-xl border border-stone-200 bg-white shadow-xl">
      <div className="px-4 pt-4 sm:px-5">
        <div className="flex gap-1" role="presentation">
          {[1, 2, 3, 4].map((n) => (
            <div
              key={n}
              className={`h-0.5 flex-1 ${n <= 2 ? 'bg-brand-700' : 'bg-stone-200'}`}
            />
          ))}
        </div>
      </div>
      <div className="flex flex-1 flex-col px-4 py-4 sm:px-5">
        <p className="text-sm font-medium text-brand-700">Step 2 of 4</p>
        <p className="mt-2 font-display text-base font-medium leading-snug text-stone-900 sm:text-lg">
          Sauté minced garlic in butter until fragrant, about 1 minute.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-stone-500">
          <span className="inline-flex items-center gap-1.5">
            <Timer className="size-3.5" aria-hidden />
            1 min timer
          </span>
          <span>Skillet</span>
        </div>
      </div>
      <div className="flex gap-2 border-t border-stone-200 px-4 py-4 sm:px-5">
        <span className="inline-flex min-h-10 flex-1 items-center justify-center rounded-lg border border-stone-200 py-2.5 text-center text-sm font-semibold text-stone-400">
          Previous
        </span>
        <span className="inline-flex min-h-10 flex-[2] items-center justify-center rounded-lg bg-brand-700 py-2.5 text-center text-sm font-semibold text-white">
          Next step
        </span>
      </div>
    </div>
  )
}

const MOCKS: Record<StageId, () => React.ReactNode> = {
  share: ShareMock,
  review: ReviewMock,
  cook: CookMock,
}

export function FlowShowcase() {
  const [active, setActive] = useState<StageId>('share')
  const prefersReducedMotion = useReducedMotion()
  const Mock = MOCKS[active]

  return (
    <section id="how-it-works" className="scroll-mt-20">
      <div className="max-w-xl">
        <h2 className="font-display text-2xl font-semibold tracking-normal text-stone-900 sm:text-3xl md:text-4xl">
          From link to kitchen
        </h2>
        <p className="mt-3 text-base text-stone-600 sm:text-lg">
          Three steps. Tap each one to see what you&apos;ll use while you cook.
        </p>
      </div>

      <div className="mt-10 grid items-start gap-8 sm:mt-12 lg:grid-cols-2 lg:gap-12 xl:gap-14">
        <div className="flex flex-col" role="tablist" aria-label="How it works">
          {STAGES.map((item, index) => {
            const selected = active === item.id
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setActive(item.id)}
                className={`w-full cursor-pointer border-l-2 py-4 pl-4 text-left transition duration-200 sm:py-5 sm:pl-5 md:pl-6 ${
                  selected
                    ? 'border-brand-700'
                    : 'border-stone-200 hover:border-stone-400'
                }`}
              >
                <p
                  className={`text-sm font-medium ${
                    selected ? 'text-brand-700' : 'text-stone-400'
                  }`}
                >
                  {String(index + 1).padStart(2, '0')} · {item.label}
                </p>
                <h3 className="mt-1 text-base font-semibold text-stone-900 sm:text-lg">
                  {item.title}
                </h3>
                <p
                  className={`mt-1.5 text-sm leading-relaxed ${
                    selected ? 'text-stone-600' : 'text-stone-500'
                  }`}
                >
                  {item.description}
                </p>
              </button>
            )
          })}
        </div>

        <div className="relative w-full lg:sticky lg:top-24">
          <AnimatePresence mode="wait">
            <motion.div
              key={active}
              initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={prefersReducedMotion ? undefined : { opacity: 0 }}
              transition={{ duration: 0.22 }}
              role="tabpanel"
            >
              <Mock />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  )
}
