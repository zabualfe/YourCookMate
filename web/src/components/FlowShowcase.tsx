import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowRight,
  Check,
  ClipboardCheck,
  GripVertical,
  Link2,
  Pizza,
  Timer,
  Video,
  type LucideIcon,
} from 'lucide-react'

type StageId = 'share' | 'review' | 'cook'

interface Stage {
  id: StageId
  label: string
  title: string
  description: string
  Icon: LucideIcon
  accent: string
  ring: string
}

const STAGES: Stage[] = [
  {
    id: 'share',
    label: 'Share',
    title: 'Paste any cooking link',
    description:
      'Drop a TikTok, YouTube, Instagram, or recipe blog URL. We read the video or page and extract the recipe for you.',
    Icon: Video,
    accent: 'from-brand-500 to-brand-700',
    ring: 'ring-brand-200',
  },
  {
    id: 'review',
    label: 'Review',
    title: 'Tweak before you cook',
    description:
      'Edit steps, fix ingredient amounts, and reorder anything. Your recipe card is ready when you are.',
    Icon: ClipboardCheck,
    accent: 'from-accent-500 to-accent-700',
    ring: 'ring-accent-200',
  },
  {
    id: 'cook',
    label: 'Cook',
    title: 'One step at a time',
    description:
      'Full-screen step cards with timers, gear tags, and highlighted ingredients — designed for messy hands.',
    Icon: Pizza,
    accent: 'from-sky-500 to-blue-600',
    ring: 'ring-sky-200',
  },
]

function ShareMock() {
  return (
    <div className="flex h-full flex-col rounded-2xl border border-stone-200/80 bg-white shadow-xl shadow-stone-900/8">
      <div className="border-b border-stone-200 px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-stone-400">Add recipe</p>
        <p className="mt-0.5 text-base font-semibold text-stone-900">From a link</p>
      </div>
      <div className="flex flex-1 flex-col gap-4 p-5">
        <div className="rounded-xl border-2 border-dashed border-brand-200 bg-brand-50/50 px-4 py-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white">
              <Link2 className="h-5 w-5" strokeWidth={2} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-brand-800">
                tiktok.com/@chef/video/…
              </p>
              <p className="text-xs text-brand-600/80">TikTok · 2:14</p>
            </div>
          </div>
        </div>
        <div className="mt-auto rounded-xl bg-brand-600 px-4 py-3 text-center text-sm font-semibold text-white">
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
    <div className="flex h-full flex-col rounded-2xl border border-stone-200/80 bg-white shadow-xl shadow-stone-900/8">
      <div className="border-b border-stone-200 px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-stone-400">Review</p>
        <p className="mt-0.5 text-base font-semibold text-stone-900">Garlic Butter Pasta</p>
      </div>
      <ul className="flex-1 space-y-2 p-4">
        {steps.map((text, i) => (
          <li
            key={i}
            className="flex items-start gap-2 rounded-xl border border-stone-200 bg-stone-50/80 px-3 py-3"
          >
            <GripVertical className="mt-0.5 h-4 w-4 shrink-0 text-stone-300" aria-hidden />
            <div className="min-w-0 flex-1">
              <span className="text-xs font-bold uppercase tracking-wider text-accent-600">
                Step {i + 1}
              </span>
              <p className="mt-0.5 text-sm leading-snug text-stone-800">{text}</p>
            </div>
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent-500" aria-hidden />
          </li>
        ))}
      </ul>
      <div className="border-t border-stone-200 px-5 py-4">
        <div className="rounded-xl bg-accent-600 px-4 py-3 text-center text-sm font-semibold text-white">
          Save & start cooking
        </div>
      </div>
    </div>
  )
}

function CookMock() {
  return (
    <div className="flex h-full flex-col rounded-2xl border border-stone-200/80 bg-white shadow-xl shadow-stone-900/8">
      <div className="px-5 pt-4">
        <div className="flex gap-1">
          {[1, 2, 3, 4].map((n) => (
            <div
              key={n}
              className={`h-1 flex-1 rounded-full ${n <= 2 ? 'bg-brand-600' : 'bg-stone-200'}`}
            />
          ))}
        </div>
      </div>
      <div className="flex flex-1 flex-col px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">Step 2 of 4</p>
        <p className="mt-2 text-lg font-semibold leading-snug text-stone-900">
          Sauté minced garlic in butter until fragrant, about 1 minute.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-accent-500/30 bg-accent-50 px-3 py-1.5 text-xs font-medium text-accent-700">
            <Timer className="h-3.5 w-3.5" />
            1 min timer
          </span>
          <span className="rounded-full bg-stone-100 px-3 py-1.5 text-xs font-medium text-stone-600">
            Skillet
          </span>
        </div>
      </div>
      <div className="flex gap-2 border-t border-stone-200 px-5 py-4">
        <span className="min-h-10 flex-1 rounded-xl border border-stone-200 py-2.5 text-center text-sm font-semibold text-stone-400">
          Previous
        </span>
        <span className="min-h-10 flex-[2] rounded-xl bg-brand-600 py-2.5 text-center text-sm font-semibold text-white">
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
  const Mock = MOCKS[active]

  return (
    <section id="how-it-works" className="scroll-mt-20">
      <div className="mb-12 text-center">
        <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-brand-600">
          The journey
        </p>
        <h2 className="font-display text-3xl font-bold tracking-tight text-stone-900 sm:text-4xl lg:text-5xl">
          See the full flow
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-stone-600">
          Tap each stage to preview exactly what you&apos;ll see in the app — from link to kitchen.
        </p>
      </div>

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-12">
        <div className="flex flex-col gap-3">
          {STAGES.map((item, index) => {
            const selected = active === item.id
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActive(item.id)}
                aria-pressed={selected}
                className={`group relative w-full cursor-pointer overflow-hidden rounded-2xl border p-5 text-left transition duration-200 sm:p-6 ${
                  selected
                    ? `border-brand-200 bg-white shadow-lg shadow-brand-900/8 ring-2 ${item.ring}`
                    : 'border-stone-200/80 bg-white/60 hover:border-stone-300 hover:bg-white hover:shadow-md'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-md transition ${
                      selected ? item.accent : 'from-stone-300 to-stone-400 group-hover:from-stone-400 group-hover:to-stone-500'
                    }`}
                  >
                    <item.Icon className="h-6 w-6" strokeWidth={1.75} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs font-bold uppercase tracking-wider ${
                          selected ? 'text-brand-600' : 'text-stone-400'
                        }`}
                      >
                        {index + 1}. {item.label}
                      </span>
                      {selected && (
                        <ArrowRight className="h-4 w-4 text-brand-500" aria-hidden />
                      )}
                    </div>
                    <h3 className="mt-1 text-lg font-bold text-stone-900">{item.title}</h3>
                    <p
                      className={`mt-1.5 text-sm leading-relaxed transition ${
                        selected ? 'text-stone-600' : 'text-stone-500'
                      }`}
                    >
                      {item.description}
                    </p>
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        <div className="relative lg:sticky lg:top-24">
          <div
            aria-hidden
            className="pointer-events-none absolute -inset-4 rounded-3xl bg-gradient-to-br from-brand-200/40 via-surface-alt/50 to-accent-100/30 blur-xl"
          />
          <div className="relative min-h-[380px] sm:min-h-[420px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={active}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
                className="absolute inset-0"
              >
                <Mock />
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  )
}
