import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { RecipeEditor, cloneRecipe, normalizeRecipe, type EditorRecipe } from '../components/RecipeEditor'
import { RecipeNutritionFields, RecipeNutritionInfo } from '../components/RecipeNutritionInfo'
import { RecipeSourceLink } from '../components/RecipeSourceLink'
import { createRecipeId, saveRecipe } from '../lib/storage'
import { useAuth } from '../context/AuthContext'
import { saveRecipe as saveRecipeApi } from '../api/client'
import type { ReviewDraft } from '../types/ingest'
import { videoPlatformLabel } from '../types/ingest'
import type { ParsedRecipe } from '../types/recipe'

const metaInputClass =
  'w-16 rounded-lg border border-stone-200 bg-white px-2 py-1 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20'

export function ReviewPage() {
  const navigate = useNavigate()
  const { isAuthenticated, user } = useAuth()
  const [draft, setDraft] = useState<ReviewDraft | null>(null)
  const [recipeDraft, setRecipeDraft] = useState<EditorRecipe | null>(null)
  const [activeTab, setActiveTab] = useState<'ingredients' | 'steps'>('ingredients')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const raw = sessionStorage.getItem('yourcookmate_review')
    if (!raw) {
      navigate('/new', { replace: true })
      return
    }
    const parsed = JSON.parse(raw) as ReviewDraft
    setDraft(parsed)
    setRecipeDraft(cloneRecipe(parsed.recipe))
  }, [navigate])

  if (!draft || !recipeDraft) return null

  const { rawText, usedAi, sourceType, sourceUrl, extractionNotes = [] } = draft
  const isVideoSource = Boolean(sourceType && sourceType !== 'text')
  const geminiSucceeded = extractionNotes.some((n) => n.includes('Vision: Gemini succeeded'))
  const geminiFailed = extractionNotes.some(
    (n) =>
      n.includes('Vision: Gemini failed') ||
      n.includes('Vision: Gemini produced no') ||
      n.includes('Gemini video analysis failed') ||
      n.includes('Gemini returned no recipe'),
  )
  const usedFrames = extractionNotes.some((n) => n.includes('frame stills'))
  const captionOnlySkip = extractionNotes.some((n) =>
    n.includes('skipped video download and AI enrichment'),
  )
  const visionHeadline = geminiSucceeded
    ? 'Video analyzed with Gemini'
    : geminiFailed && usedFrames
      ? 'Gemini failed — used frame stills instead'
      : geminiFailed
        ? 'Gemini failed — no visual brief'
        : usedFrames
          ? 'Video analyzed with frame stills'
          : captionOnlySkip
            ? 'Caption only — video AI enrichment was skipped'
            : extractionNotes.find((n) => n.startsWith('Vision:')) ??
              (extractionNotes.length > 0 ? extractionNotes[0] : null)

  const buildRecipe = () => normalizeRecipe(recipeDraft)

  const persistLocal = (id: string, recipe: ParsedRecipe) => {
    saveRecipe({
      id,
      rawText,
      recipe,
      usedAi,
      createdAt: new Date().toISOString(),
      sourceUrl,
      sourceType,
    })
    sessionStorage.removeItem('yourcookmate_review')
  }

  const persist = async (destination: 'library' | 'cook') => {
    setError('')
    const normalized = buildRecipe()
    if (normalized.steps.length === 0) {
      setError('Add at least one step before saving.')
      return
    }

    setLoading(true)
    try {
      if (isAuthenticated) {
        const saved = await saveRecipeApi({
          raw_text: rawText,
          recipe: normalized,
          used_ai: usedAi,
          source_type: sourceType ?? 'text',
          source_url: sourceUrl,
        })
        sessionStorage.removeItem('yourcookmate_review')
        navigate(destination === 'cook' ? `/cook/${saved.id}` : `/recipes/${saved.id}`)
      } else {
        const id = createRecipeId()
        persistLocal(id, normalized)
        navigate(destination === 'cook' ? `/cook/${id}` : `/recipes/${id}`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save recipe')
    } finally {
      setLoading(false)
    }
  }

  const updateMeta = (
    patch: Partial<
      Pick<
        ParsedRecipe,
        | 'title'
        | 'servings'
        | 'prep_time_minutes'
        | 'cook_time_minutes'
        | 'calories_per_serving'
        | 'allergens'
      >
    >,
  ) => {
    setRecipeDraft((current) => (current ? { ...current, ...patch } : current))
  }

  return (
    <Layout>
      <div className="mx-auto max-w-6xl px-4 py-8">
        <Link to="/new" className="text-sm font-medium text-stone-500 hover:text-stone-800">
          ← Back
        </Link>

        <div className="mt-4">
          <h1 className="text-2xl font-bold text-stone-900">Review your recipe</h1>
          <p className="mt-1 text-stone-600">
            {usedAi ? 'Parsed with AI' : 'Parsed with fallback'} · {recipeDraft.steps.length} steps
            {isVideoSource && <> · from {videoPlatformLabel(sourceType!)}</>}
          </p>
        </div>

        {isVideoSource && (
          <div
            className={[
              'mt-4 rounded-2xl border-2 px-5 py-4',
              geminiSucceeded
                ? 'border-emerald-400 bg-emerald-50'
                : geminiFailed
                  ? 'border-red-300 bg-red-50'
                  : usedFrames
                    ? 'border-amber-400 bg-amber-50'
                    : extractionNotes.length > 0
                      ? 'border-stone-300 bg-stone-50'
                      : 'border-stone-300 bg-stone-100',
            ].join(' ')}
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
              How this video was imported
            </p>
            <p
              className={[
                'mt-1 text-lg font-bold',
                geminiSucceeded
                  ? 'text-emerald-800'
                  : geminiFailed
                    ? 'text-red-800'
                    : usedFrames
                      ? 'text-amber-900'
                      : 'text-stone-800',
              ].join(' ')}
            >
              {visionHeadline ?? 'Import notes missing for this draft'}
            </p>
            {extractionNotes.length > 0 ? (
              <ul className="mt-3 space-y-1.5 text-sm text-stone-700">
                {extractionNotes.map((note) => (
                  <li key={note} className="flex gap-2">
                    <span className="shrink-0 text-stone-400">•</span>
                    <span>{note}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-stone-600">
                This review was saved before notes were stored. Go back to{' '}
                <Link to="/new" className="font-semibold underline">
                  Import
                </Link>{' '}
                and paste the link again (restart the backend if you just added a Gemini key).
              </p>
            )}
          </div>
        )}

        {!isAuthenticated && (
          <p className="mt-4 rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-800">
            <Link to="/login?redirect=/new/review" className="font-semibold underline">
              Sign in
            </Link>{' '}
            to save to your library across devices, or save locally in this browser.
          </p>
        )}

        {isAuthenticated && user && !user.email_verified && (
          <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <Link to="/verify-email?redirect=/new/review" className="font-semibold underline">
              Verify your email
            </Link>{' '}
            to save to your library. You can still edit and start cooking.
          </p>
        )}

        <label className="mt-6 block max-w-3xl">
          <span className="text-sm font-medium text-stone-700">Title</span>
          <input
            value={recipeDraft.title}
            onChange={(e) => updateMeta({ title: e.target.value })}
            className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-lg font-semibold outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20"
          />
        </label>
        {sourceUrl && <RecipeSourceLink url={sourceUrl} className="mt-2 max-w-3xl" />}

        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-stone-600">
          <label className="flex items-center gap-1.5">
            Servings
            <input
              type="number"
              min={1}
              value={recipeDraft.servings ?? ''}
              onChange={(e) =>
                updateMeta({
                  servings: e.target.value ? Number(e.target.value) : null,
                })
              }
              className={metaInputClass}
            />
          </label>
          <label className="flex items-center gap-1.5">
            Prep (min)
            <input
              type="number"
              min={0}
              value={recipeDraft.prep_time_minutes ?? ''}
              onChange={(e) =>
                updateMeta({
                  prep_time_minutes: e.target.value ? Number(e.target.value) : null,
                })
              }
              className={metaInputClass}
            />
          </label>
          <label className="flex items-center gap-1.5">
            Cook (min)
            <input
              type="number"
              min={0}
              value={recipeDraft.cook_time_minutes ?? ''}
              onChange={(e) =>
                updateMeta({
                  cook_time_minutes: e.target.value ? Number(e.target.value) : null,
                })
              }
              className={metaInputClass}
            />
          </label>
          <RecipeNutritionFields
            calories={recipeDraft.calories_per_serving}
            allergens={recipeDraft.allergens}
            onCaloriesChange={(calories_per_serving) => updateMeta({ calories_per_serving })}
            onAllergensChange={(allergens) => updateMeta({ allergens })}
            inputClass={metaInputClass}
          />
        </div>

        <RecipeNutritionInfo recipe={recipeDraft} className="mt-3" />

        <RecipeEditor
          draft={recipeDraft}
          onChange={setRecipeDraft}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />

        {error && (
          <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
        )}

        <div className="mt-8 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => persist('library')}
            disabled={loading}
            className="flex min-h-12 items-center justify-center rounded-2xl border border-stone-200 bg-white px-8 text-base font-semibold text-stone-800 transition hover:bg-stone-50 disabled:opacity-50"
          >
            {loading ? 'Saving…' : 'Save'}
          </button>
          <button
            type="button"
            onClick={() => persist('cook')}
            disabled={loading}
            className="flex min-h-12 items-center justify-center rounded-2xl bg-brand-600 px-10 text-base font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
          >
            {loading ? 'Saving…' : 'Start cooking'}
          </button>
        </div>
      </div>
    </Layout>
  )
}
