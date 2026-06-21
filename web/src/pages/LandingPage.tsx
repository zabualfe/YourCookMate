import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Layout } from '../components/Layout'
import { useAuth } from '../context/AuthContext'
import { listRecipes } from '../api/client'
import { getRecentRecipes } from '../lib/storage'

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

  return (
    <Layout>
      <section className="mx-auto max-w-3xl px-4 py-12 sm:py-20">
        <div className="mb-10">
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-brand-600">
            Cook with confidence
          </p>
          <h1 className="text-4xl font-bold leading-tight text-stone-900 sm:text-5xl">
            Turn any recipe into easy, step-by-step cards
          </h1>
          <p className="mt-4 max-w-xl text-lg text-stone-600">
            Paste a recipe and Your Cook Mate breaks it into clear, one-at-a-time steps you can flip
            through while you cook.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/new"
              className="inline-flex min-h-12 items-center rounded-2xl bg-brand-600 px-8 py-3 text-base font-semibold text-white shadow-lg shadow-brand-600/25 transition hover:bg-brand-700"
            >
              Paste a recipe
            </Link>
            {isAuthenticated ? (
              <Link
                to="/recipes"
                className="inline-flex min-h-12 items-center rounded-2xl border border-stone-200 px-8 py-3 text-base font-semibold text-stone-700 hover:bg-stone-50"
              >
                My recipes
              </Link>
            ) : (
              <Link
                to="/register"
                className="inline-flex min-h-12 items-center rounded-2xl border border-stone-200 px-8 py-3 text-base font-semibold text-stone-700 hover:bg-stone-50"
              >
                Create account
              </Link>
            )}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { title: 'Paste', desc: 'Drop in any recipe text from a blog, book, or note.' },
            { title: 'Review', desc: 'Check the parsed steps and ingredients before cooking.' },
            { title: 'Cook', desc: 'One step per screen — swipe or tap through at your own pace.' },
          ].map((item) => (
            <div key={item.title} className="rounded-2xl border border-stone-200 bg-white p-5">
              <h3 className="font-semibold text-brand-800">{item.title}</h3>
              <p className="mt-1 text-sm text-stone-600">{item.desc}</p>
            </div>
          ))}
        </div>

        {recent.length > 0 && (
          <div className="mt-12">
            <h2 className="mb-4 text-lg font-semibold text-stone-900">Recent recipes</h2>
            <ul className="space-y-2">
              {recent.map((r) => (
                <li key={r.id}>
                  <Link
                    to={`/recipes/${r.id}`}
                    className="flex items-center justify-between rounded-xl border border-stone-200 bg-white px-4 py-3 transition hover:border-brand-300"
                  >
                    <span className="font-medium text-stone-800">{r.title}</span>
                    <span className="text-sm text-stone-400">{r.step_count} steps</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </Layout>
  )
}
