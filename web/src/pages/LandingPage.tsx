import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Layout } from '../components/Layout'
import { FlowShowcase } from '../components/FlowShowcase'
import { ProductPreviewBanner } from '../components/ProductPreviewBanner'
import { useAuth } from '../context/AuthContext'
import { listRecipes } from '../api/client'
import { getRecentRecipes } from '../lib/storage'
import { AdSlot } from '../components/AdSlot'

const FEATURES = [
  {
    title: 'Hands-free cooking',
    desc: 'Large type, one step per screen, and swipe navigation — built for the counter, not the couch.',
  },
  {
    title: 'Built-in timers',
    desc: 'Steps with cook times get a one-tap timer so you never lose track mid-recipe.',
  },
  {
    title: 'Ingredient highlights',
    desc: 'See which ingredients you need for the current step without scrolling back to the list.',
  },
  {
    title: 'Your recipe library',
    desc: 'Save favorites, organize collections, and pick up right where you left off.',
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
      {/* Hero — brand, headline, CTA, product visual */}
      <section className="relative overflow-hidden border-b border-stone-200/80">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(165deg,#fafaf8_0%,#f3f3f0_42%,#e8efe9_100%)]"
        />

        <div className="relative mx-auto grid max-w-7xl items-end gap-8 px-4 pb-0 pt-10 sm:gap-10 sm:px-6 sm:pt-14 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.15fr)] lg:items-center lg:gap-12 lg:px-8 lg:pb-16 lg:pt-20">
          <div className="pb-8 sm:pb-10 lg:pb-4">
            <p className="font-display text-xl font-semibold tracking-normal text-brand-700 sm:text-2xl md:text-3xl">
              Your Cook Mate
            </p>

            <h1 className="mt-4 font-display text-balance text-3xl font-semibold leading-snug tracking-normal text-stone-900 sm:mt-5 sm:text-4xl md:text-5xl lg:text-6xl">
              Turn any recipe into easy, step-by-step cards
            </h1>
            <p className="mt-4 max-w-md text-base leading-relaxed text-stone-600 sm:mt-5 sm:text-lg">
              Paste a cooking video or recipe site. Cook one clear step at a time — no more pausing
              on repeat.
            </p>

            <div className="mt-7 flex flex-col gap-3 sm:mt-9 sm:flex-row sm:flex-wrap sm:items-center">
              <Link
                to={primaryCta}
                className="inline-flex min-h-12 cursor-pointer items-center justify-center rounded-lg bg-brand-700 px-6 py-3 text-base font-semibold text-white transition duration-200 hover:bg-brand-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700 sm:px-7"
              >
                {primaryLabel}
              </Link>
              <a
                href="#how-it-works"
                className="inline-flex min-h-12 cursor-pointer items-center justify-center rounded-lg px-4 py-3 text-base font-semibold text-stone-700 transition duration-200 hover:text-stone-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700 sm:px-5"
              >
                See how it works
              </a>
            </div>
          </div>

          <div className="min-w-0 w-full lg:-mr-2 xl:-mr-6">
            <ProductPreviewBanner />
          </div>
        </div>
      </section>

      {/* Interactive flow */}
      <section className="bg-white py-16 sm:py-24 lg:py-28">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <FlowShowcase />
        </div>
      </section>

      {/* Features — list, not cards */}
      <section className="border-y border-stone-200/80 bg-surface-alt py-16 sm:py-24 lg:py-28">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-xl">
            <h2 className="font-display text-2xl font-semibold tracking-normal text-stone-900 sm:text-3xl md:text-4xl">
              Built for the stove, not the scroll
            </h2>
            <p className="mt-3 text-base text-stone-600 sm:text-lg">
              Everything stays readable when your hands are busy and the heat is on.
            </p>
          </div>

          <ul className="mt-10 divide-y divide-stone-200/90 border-y border-stone-200/90 sm:mt-14">
            {FEATURES.map((item, index) => (
              <li
                key={item.title}
                className="grid gap-2 py-6 sm:grid-cols-[4.5rem_minmax(0,1fr)] sm:items-baseline sm:gap-6 sm:py-8 lg:grid-cols-[4.5rem_minmax(0,1fr)_minmax(0,1.4fr)] lg:gap-8"
              >
                <span className="font-mono text-sm tabular-nums text-stone-400">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <h3 className="text-base font-semibold text-stone-900 sm:text-lg">{item.title}</h3>
                <p className="leading-relaxed text-stone-600 sm:col-span-2 lg:col-span-1 lg:text-lg">
                  {item.desc}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <div className="px-4 sm:px-6 lg:px-8">
        <AdSlot variant="banner" className="mx-auto my-6 max-w-3xl" />
      </div>

      {/* Recent recipes (returning users) */}
      {recent.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
          <h2 className="font-display text-xl font-semibold text-stone-900 sm:text-2xl">
            Pick up where you left off
          </h2>
          <ul className="mt-6 divide-y divide-stone-200 border-y border-stone-200 sm:mt-8">
            {recent.map((r) => (
              <li key={r.id}>
                <Link
                  to={`/recipes/${r.id}`}
                  className="flex cursor-pointer items-baseline justify-between gap-4 py-4 transition duration-200 hover:text-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700"
                >
                  <span className="font-semibold text-stone-900">{r.title}</span>
                  <span className="shrink-0 text-sm text-stone-500">{r.step_count} steps</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Final CTA */}
      <section className="bg-brand-800 py-16 text-white sm:py-20 lg:py-24">
        <div className="mx-auto max-w-2xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="font-display text-2xl font-semibold tracking-normal sm:text-3xl md:text-4xl">
            Ready when you are
          </h2>
          <p className="mt-4 text-base text-brand-100 sm:text-lg">
            Paste a link, review the steps, and start cooking.
          </p>
          <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:mt-9 sm:flex-row sm:flex-wrap sm:items-center">
            <Link
              to={primaryCta}
              className="inline-flex min-h-12 cursor-pointer items-center justify-center rounded-lg bg-white px-6 py-3 text-base font-semibold text-brand-800 transition duration-200 hover:bg-brand-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:px-7"
            >
              {primaryLabel}
            </Link>
            {!isAuthenticated && (
              <Link
                to="/login"
                className="inline-flex min-h-12 cursor-pointer items-center justify-center rounded-lg px-4 py-3 text-base font-semibold text-brand-100 transition duration-200 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:px-5"
              >
                Sign in
              </Link>
            )}
          </div>
        </div>
      </section>

      <footer className="border-t border-stone-800 bg-stone-950 px-4 py-8 text-center text-sm text-stone-500 sm:px-6">
        <p>© {new Date().getFullYear()} Your Cook Mate</p>
      </footer>
    </Layout>
  )
}
