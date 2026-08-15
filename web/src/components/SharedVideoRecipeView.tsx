import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import type { SharedRecipeResponse } from '../types/collection'
import { resolveVideoEmbed } from '../lib/videoEmbed'
import { RecipeNutritionInfo } from './RecipeNutritionInfo'
import { RecipeSourceLink } from './RecipeSourceLink'
import { videoPlatformLabel } from '../types/ingest'

interface SharedVideoRecipeViewProps {
  slug: string
  data: SharedRecipeResponse
  actions: React.ReactNode
  saveError?: string | null
}

export function SharedVideoRecipeView({
  slug,
  data,
  actions,
  saveError,
}: SharedVideoRecipeViewProps) {
  const embed = useMemo(
    () => (data.source_url ? resolveVideoEmbed(data.source_url) : null),
    [data.source_url],
  )

  const steps = data.recipe.steps
  const ingredients = data.recipe.ingredients
  const platformLabel = videoPlatformLabel(data.source_type ?? 'video')

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-stone-500">Shared by {data.author_name}</p>
          <h1 className="mt-1 font-display text-3xl font-semibold tracking-normal text-stone-900 sm:text-4xl">
            {data.title}
          </h1>
          <p className="mt-2 text-sm text-stone-600">
            {platformLabel} recipe · {data.step_count} steps
          </p>
          {data.source_url && <RecipeSourceLink url={data.source_url} className="mt-2" />}
          <RecipeNutritionInfo recipe={data.recipe} className="mt-3" />
        </div>
        <div className="flex flex-wrap gap-3">{actions}</div>
      </div>

      {saveError && (
        <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{saveError}</p>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:items-start">
        <div className="overflow-hidden rounded-2xl border border-stone-200 bg-stone-950 shadow-xl">
          <div
            className={[
              'relative w-full bg-black',
              embed?.isVertical
                ? 'mx-auto aspect-[9/16] max-h-[min(70vh,40rem)] w-full max-w-sm'
                : 'aspect-video',
            ].join(' ')}
          >
            {embed?.embedUrl ? (
              <iframe
                src={embed.embedUrl}
                title={data.title}
                className="absolute inset-0 size-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; fullscreen; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-stone-900 px-6 text-center">
                <p className="text-sm text-stone-300">
                  This {platformLabel.toLowerCase()} link can’t be embedded inline.
                </p>
                {data.source_url && (
                  <a
                    href={data.source_url}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-stone-900"
                  >
                    Open original video
                  </a>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex min-h-0 flex-col gap-4">
          <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
            <h2 className="font-semibold text-stone-900">Ingredients</h2>
            <ul className="mt-3 space-y-2">
              {ingredients.length ? (
                ingredients.map((ing) => (
                  <li
                    key={ing.name}
                    className="flex items-baseline justify-between gap-3 text-sm text-stone-800"
                  >
                    <span>{ing.name}</span>
                    {ing.quantity && <span className="shrink-0 text-stone-400">{ing.quantity}</span>}
                  </li>
                ))
              ) : (
                <li className="text-sm text-stone-500">No ingredients listed.</li>
              )}
            </ul>
          </section>

          <section className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
            <div className="border-b border-stone-100 px-5 py-3">
              <h2 className="font-semibold text-stone-900">Steps</h2>
            </div>
            <ol className="max-h-[28rem] space-y-1 overflow-y-auto p-2">
              {steps.map((step) => (
                <li key={step.order} className="flex items-start gap-3 rounded-xl px-3 py-3">
                  <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-stone-100 text-xs font-semibold text-stone-600">
                    {step.order}
                  </span>
                  <span className="min-w-0 flex-1 text-sm font-medium text-stone-900">
                    {step.instruction}
                  </span>
                </li>
              ))}
            </ol>
          </section>

          <Link
            to={`/r/${slug}/cook`}
            className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-brand-700 px-6 py-3 text-center font-semibold text-white transition hover:bg-brand-800"
          >
            Open full cook mode
          </Link>
        </div>
      </div>
    </div>
  )
}
