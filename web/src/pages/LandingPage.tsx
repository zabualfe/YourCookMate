import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ChefHat,
  Clock,
  Layers,
  Smartphone,
  Sparkles,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { Layout } from '../components/Layout'
import { FlowShowcase } from '../components/FlowShowcase'
import { ProductPreviewBanner } from '../components/ProductPreviewBanner'
import { useAuth } from '../context/AuthContext'
import { listRecipes } from '../api/client'
import { getRecentRecipes } from '../lib/storage'

const PLATFORMS = ['TikTok', 'YouTube', 'Instagram', 'Recipe blogs']

const FEATURES: { title: string; desc: string; Icon: LucideIcon }[] = [
  {
    title: 'Hands-free cooking',
    desc: 'Large type, one step per screen, and swipe navigation — built for the counter, not the couch.',
    Icon: Smartphone,
  },
  {
    title: 'Built-in timers',
    desc: 'Steps with cook times get a one-tap timer so you never lose track mid-recipe.',
    Icon: Clock,
  },
  {
    title: 'Ingredient highlights',
    desc: 'See which ingredients you need for the current step without scrolling back to the list.',
    Icon: Layers,
  },
  {
    title: 'Your recipe library',
    desc: 'Save favorites, organize collections, and pick up right where you left off.',
    Icon: ChefHat,
  },
]

export function LandingPage() {
  const { isAuthenticated } = useAuth()

  const { data: apiRecipes } = useQuery({
    queryKey: ['recipes', 'recent'],
    queryFn: () => listRecipes(),
    enabled: isAuthenticated,
  })

  const recent = isAuthenticated
    ? (apiRecipes?.items.slice(0, 3) ?? [])
    : getRecentRecipes(3).map((r) => ({
        id: r.id,
        title: r.recipe.title,
        step_count: r.recipe.steps.length,
      }))

  const primaryCta = isAuthenticated ? '/new' : '/register'
  const primaryLabel = isAuthenticated ? 'Add a recipe' : 'Get started free'

  return (
    <Layout>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-brand-200/40">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(5,150,105,0.14),transparent)]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 top-20 h-72 w-72 rounded-full bg-accent-100/60 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -left-16 bottom-0 h-56 w-56 rounded-full bg-brand-100/80 blur-3xl"
        />

        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 py-14 sm:py-20 lg:grid-cols-[1fr_1.25fr] lg:gap-16 lg:py-24">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-brand-200/80 bg-white/80 px-4 py-1.5 text-sm font-medium text-brand-700 shadow-sm backdrop-blur-sm">
              <Sparkles className="h-4 w-4 text-accent-500" aria-hidden />
              From video to step cards in seconds
            </div>

            <h1 className="font-display text-balance text-4xl font-bold leading-[1.15] tracking-tight text-stone-900 sm:text-5xl lg:text-[3.25rem]">
              Turn any recipe into easy, step-by-step cards
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-stone-600">
              Drop in a cooking video or recipe site and Your Cook Mate breaks it into clear,
              one-at-a-time steps you can flip through while you cook.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to={primaryCta}
                className="inline-flex min-h-12 cursor-pointer items-center rounded-2xl bg-brand-600 px-8 py-3 text-base font-semibold text-white shadow-lg shadow-brand-600/30 transition duration-200 hover:bg-brand-700 hover:shadow-brand-600/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
              >
                {primaryLabel}
              </Link>
              <a
                href="#how-it-works"
                className="inline-flex min-h-12 cursor-pointer items-center rounded-2xl border border-stone-200 bg-white px-8 py-3 text-base font-semibold text-stone-700 transition duration-200 hover:border-brand-200 hover:bg-brand-50/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
              >
                See how it works
              </a>
            </div>

            <div className="mt-10 flex flex-wrap gap-2">
              {PLATFORMS.map((name) => (
                <span
                  key={name}
                  className="rounded-full border border-stone-200/80 bg-white/70 px-3 py-1 text-xs font-medium text-stone-600"
                >
                  {name}
                </span>
              ))}
            </div>
          </div>

          <div className="min-w-0 lg:-mr-6 xl:-mr-10">
            <ProductPreviewBanner />
          </div>
        </div>
      </section>

      {/* Interactive flow */}
      <section className="bg-white py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-4">
          <FlowShowcase />
        </div>
      </section>

      {/* Feature grid */}
      <section className="border-y border-stone-200/60 bg-surface-alt py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mb-12 text-center">
            <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-brand-600">
              Built for real cooking
            </p>
            <h2 className="font-display text-3xl font-bold tracking-tight text-stone-900 sm:text-4xl">
              Everything you need at the stove
            </h2>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:gap-6">
            {FEATURES.map((item) => (
              <article
                key={item.title}
                className="group rounded-2xl border border-stone-200/80 bg-white p-6 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-lg hover:shadow-brand-900/5 sm:p-8"
              >
                <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-600 transition group-hover:bg-brand-600 group-hover:text-white">
                  <item.Icon className="h-6 w-6" strokeWidth={1.75} />
                </div>
                <h3 className="text-xl font-bold text-stone-900">{item.title}</h3>
                <p className="mt-2 leading-relaxed text-stone-600">{item.desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Social proof strip */}
      <section className="bg-brand-800 py-12 text-white sm:py-14">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-8 px-4 sm:flex-row sm:justify-between">
          <div className="flex items-center gap-3 text-center sm:text-left">
            <Users className="h-8 w-8 shrink-0 text-brand-200" aria-hidden />
            <p className="text-lg font-medium text-brand-50">
              Designed for home cooks who learn from videos and want clarity in the kitchen.
            </p>
          </div>
          <Link
            to={primaryCta}
            className="inline-flex min-h-12 shrink-0 cursor-pointer items-center rounded-2xl bg-accent-500 px-8 py-3 text-base font-semibold text-white shadow-lg transition duration-200 hover:bg-accent-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            Try it now
          </Link>
        </div>
      </section>

      {/* Recent recipes (returning users) */}
      {recent.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
          <h2 className="mb-6 text-2xl font-bold text-stone-900">Pick up where you left off</h2>
          <ul className="grid gap-3 sm:grid-cols-3">
            {recent.map((r) => (
              <li key={r.id}>
                <Link
                  to={`/recipes/${r.id}`}
                  className="flex h-full cursor-pointer flex-col rounded-2xl border border-stone-200 bg-white px-5 py-4 transition duration-200 hover:border-brand-300 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
                >
                  <span className="font-semibold text-stone-800">{r.title}</span>
                  <span className="mt-1 text-sm text-stone-400">{r.step_count} steps</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Final CTA */}
      <section className="border-t border-stone-200/60 bg-gradient-to-b from-white to-surface py-16 sm:py-20">
        <div className="mx-auto max-w-3xl px-4 text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight text-stone-900 sm:text-4xl">
            Ready to cook with confidence?
          </h2>
          <p className="mt-4 text-lg text-stone-600">
            Paste a link, review the steps, and start cooking — no more pausing videos on repeat.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              to={primaryCta}
              className="inline-flex min-h-12 cursor-pointer items-center rounded-2xl bg-brand-600 px-8 py-3 text-base font-semibold text-white shadow-lg shadow-brand-600/25 transition duration-200 hover:bg-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
            >
              {primaryLabel}
            </Link>
            {!isAuthenticated && (
              <Link
                to="/login"
                className="inline-flex min-h-12 cursor-pointer items-center rounded-2xl border border-stone-200 bg-white px-8 py-3 text-base font-semibold text-stone-700 transition duration-200 hover:bg-stone-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
              >
                Sign in
              </Link>
            )}
          </div>
        </div>
      </section>

      <footer className="border-t border-stone-200/60 bg-stone-900 px-4 py-8 text-center text-sm text-stone-400">
        <p>© {new Date().getFullYear()} Your Cook Mate — Cook with confidence.</p>
      </footer>
    </Layout>
  )
}
