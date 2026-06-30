import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Layout } from '../components/Layout'
import { ShareQuickAdd } from '../components/SharePanel'
import { CollectionQuickAdd } from '../components/CollectionPicker'
import { RecipeCollectionChips } from '../components/RecipeCollectionChips'
import { RecipeEditor, cloneRecipe, normalizeRecipe, type EditorRecipe } from '../components/RecipeEditor'
import { RecipeNutritionFields, RecipeNutritionInfo } from '../components/RecipeNutritionInfo'
import { RecipeSourceLink } from '../components/RecipeSourceLink'
import { ShopInstacartButton } from '../components/ShopInstacartButton'
import { RecipeIcon } from '../components/RecipeIcon'
import { CookwareIcon, PencilIcon } from '../components/icons'
import { getRecipe as getLocalRecipe, saveRecipe as saveLocalRecipe } from '../lib/storage'
import { getRecipe as getRecipeApi, updateRecipe } from '../api/client'
import { useAuth } from '../context/AuthContext'
import type { ParsedRecipe } from '../types/recipe'

const metaInputClass =
  'w-16 rounded-lg border border-stone-200 bg-white px-2 py-1 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20'

export function RecipeDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { isAuthenticated } = useAuth()
  const queryClient = useQueryClient()
  const [local, setLocal] = useState(() => (id ? getLocalRecipe(id) : undefined))
  const [activeTab, setActiveTab] = useState<'ingredients' | 'steps'>('ingredients')
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<EditorRecipe | null>(null)
  const [saveError, setSaveError] = useState('')
  const [iconUrl, setIconUrl] = useState<string | null | undefined>(undefined)

  const { data, isLoading, error } = useQuery({
    queryKey: ['recipe', id],
    queryFn: () => getRecipeApi(id!),
    enabled: !!id && isAuthenticated,
    retry: false,
  })

  useEffect(() => {
    if (!id || isAuthenticated) return
    setLocal(getLocalRecipe(id))
  }, [id, isAuthenticated])

  useEffect(() => {
    if (isAuthenticated && data) {
      setIconUrl(data.icon_url ?? null)
    } else if (local) {
      setIconUrl(local.iconUrl ?? null)
    }
  }, [isAuthenticated, data, local])

  const saveMutation = useMutation({
    mutationFn: (recipe: ParsedRecipe) => updateRecipe(id!, recipe),
    onSuccess: (updated) => {
      queryClient.setQueryData(['recipe', id], updated)
      queryClient.invalidateQueries({ queryKey: ['recipes'] })
      setEditing(false)
      setDraft(null)
      setSaveError('')
    },
    onError: (err) => setSaveError(err instanceof Error ? err.message : 'Failed to save'),
  })

  const detail = isAuthenticated && data
    ? {
        id: data.id,
        title: data.title,
        recipe: data.recipe,
        step_count: data.recipe.steps.length,
        servings: data.recipe.servings,
        prep_time: data.recipe.prep_time_minutes,
        cook_time: data.recipe.cook_time_minutes,
        collections: data.collections ?? [],
        is_public: data.is_public ?? false,
        share_url: data.share_url,
        source_url: data.source_url,
        isLocal: false,
      }
    : local
      ? {
          id: local.id,
          title: local.recipe.title,
          recipe: local.recipe,
          step_count: local.recipe.steps.length,
          servings: local.recipe.servings,
          prep_time: local.recipe.prep_time_minutes,
          cook_time: local.recipe.cook_time_minutes,
          collections: [],
          is_public: false,
          share_url: undefined as string | undefined,
          source_url: local.sourceUrl,
          isLocal: true,
        }
      : null

  const startEditing = () => {
    if (!detail) return
    setDraft(cloneRecipe(detail.recipe))
    setSaveError('')
    setEditing(true)
  }

  const cancelEditing = () => {
    setEditing(false)
    setDraft(null)
    setSaveError('')
  }

  const handleSave = () => {
    if (!draft || !detail) return
    const normalized = normalizeRecipe(draft)
    if (normalized.steps.length === 0) {
      setSaveError('Add at least one step before saving.')
      return
    }

    if (detail.isLocal) {
      saveLocalRecipe({
        id: detail.id,
        rawText: local?.rawText ?? '',
        recipe: normalized,
        usedAi: local?.usedAi ?? false,
        createdAt: local?.createdAt ?? new Date().toISOString(),
        sourceUrl: local?.sourceUrl,
        sourceType: local?.sourceType,
      })
      setLocal(getLocalRecipe(detail.id))
      setEditing(false)
      setDraft(null)
      setSaveError('')
      return
    }

    saveMutation.mutate(normalized)
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
    if (!draft) return
    setDraft({ ...draft, ...patch })
  }

  if (isAuthenticated && isLoading) {
    return (
      <Layout>
        <div className="flex h-[calc(100dvh-3.5rem)] items-center justify-center text-stone-500">
          Loading…
        </div>
      </Layout>
    )
  }

  if (!detail) {
    return (
      <Layout>
        <div className="mx-auto max-w-lg px-4 py-16 text-center">
          <p className="text-stone-600">
            {error ? (error as Error).message : 'Recipe not found.'}
          </p>
          <Link to="/" className="mt-4 inline-block text-brand-600">
            Go home
          </Link>
        </div>
      </Layout>
    )
  }

  const displayRecipe = editing && draft ? draft : detail.recipe
  const metaParts = [
    displayRecipe.servings != null && `${displayRecipe.servings} servings`,
    `${displayRecipe.steps.length} steps`,
    displayRecipe.prep_time_minutes != null && `${displayRecipe.prep_time_minutes}m prep`,
    displayRecipe.cook_time_minutes != null && `${displayRecipe.cook_time_minutes}m cook`,
    displayRecipe.calories_per_serving != null &&
      `~${displayRecipe.calories_per_serving} cal/serving (est.)`,
  ].filter(Boolean)

  return (
    <Layout>
      <div
        className={[
          'mx-auto flex h-[calc(100dvh-7.5rem)] max-w-6xl flex-col px-4 py-4 md:h-[calc(100dvh-3.5rem)] sm:px-6',
          editing ? 'overflow-visible' : 'overflow-hidden',
        ].join(' ')}
      >
        <div className="shrink-0 border-b border-stone-200 pb-4">
          <Link
            to={isAuthenticated ? '/recipes' : '/'}
            className="text-sm font-medium text-stone-500 hover:text-stone-800"
          >
            ← Back
          </Link>

          <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 flex-1 items-start gap-4">
              <RecipeIcon
                recipeId={detail.id}
                iconUrl={iconUrl}
                editable={!editing}
                isLocal={detail.isLocal}
                onIconChange={(url) => {
                  setIconUrl(url)
                  if (isAuthenticated && data) {
                    queryClient.setQueryData(['recipe', id], { ...data, icon_url: url })
                    queryClient.invalidateQueries({ queryKey: ['recipes'] })
                  } else if (detail.isLocal) {
                    setLocal(getLocalRecipe(detail.id))
                  }
                }}
              />
              <div className="min-w-0 flex-1">
              {editing && draft ? (
                <>
                  <input
                    value={draft.title}
                    onChange={(e) => updateMeta({ title: e.target.value })}
                    className="w-full rounded-xl border border-brand-200 bg-white px-3 py-2 text-2xl font-bold text-stone-900 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20 sm:text-3xl"
                    placeholder="Recipe title"
                  />
                  {detail.source_url && (
                    <RecipeSourceLink url={detail.source_url} className="mt-2" />
                  )}
                </>
              ) : (
                <>
                  <h1 className="text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl">
                    {detail.title}
                  </h1>
                  {detail.source_url && (
                    <RecipeSourceLink url={detail.source_url} className="mt-2" />
                  )}
                </>
              )}

              {editing && draft ? (
                <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-stone-600">
                  <label className="flex items-center gap-1.5">
                    Servings
                    <input
                      type="number"
                      min={1}
                      value={draft.servings ?? ''}
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
                      value={draft.prep_time_minutes ?? ''}
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
                      value={draft.cook_time_minutes ?? ''}
                      onChange={(e) =>
                        updateMeta({
                          cook_time_minutes: e.target.value ? Number(e.target.value) : null,
                        })
                      }
                      className={metaInputClass}
                    />
                  </label>
                  <RecipeNutritionFields
                    calories={draft.calories_per_serving}
                    allergens={draft.allergens}
                    onCaloriesChange={(calories_per_serving) => updateMeta({ calories_per_serving })}
                    onAllergensChange={(allergens) => updateMeta({ allergens })}
                    inputClass={metaInputClass}
                  />
                </div>
              ) : (
                <>
                  <p className="mt-1 text-sm text-stone-500">{metaParts.join(' · ')}</p>
                  <RecipeNutritionInfo recipe={displayRecipe} className="mt-2" />
                </>
              )}

              {!editing && detail.collections.length > 0 && (
                <div className="mt-2">
                  <RecipeCollectionChips collections={detail.collections} />
                </div>
              )}
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {editing ? (
                <>
                  <button
                    type="button"
                    onClick={cancelEditing}
                    disabled={saveMutation.isPending}
                    className="rounded-xl border border-stone-200 px-4 py-2.5 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saveMutation.isPending}
                    className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
                  >
                    {saveMutation.isPending ? 'Saving…' : 'Save changes'}
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={startEditing}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 px-4 py-2.5 text-sm font-medium text-stone-700 hover:bg-stone-50"
                  >
                    <PencilIcon />
                    Edit
                  </button>
                  {isAuthenticated && data && (
                    <>
                      <CollectionQuickAdd recipeId={data.id} collections={detail.collections} />
                      <ShareQuickAdd
                        recipeId={data.id}
                        initial={{ is_public: detail.is_public, share_url: detail.share_url }}
                        isPublic={detail.is_public}
                      />
                    </>
                  )}
                  <Link
                    to={`/cook/${detail.id}`}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-brand-600/20 transition hover:bg-brand-700"
                  >
                    <CookwareIcon />
                    Start cooking
                  </Link>
                  {isAuthenticated && data && (
                    <ShopInstacartButton recipeId={data.id} />
                  )}
                </>
              )}
            </div>
          </div>

          {saveError && (
            <p className="mt-3 rounded-xl bg-red-50 px-4 py-2 text-sm text-red-700">{saveError}</p>
          )}
        </div>

        {editing && draft ? (
          <RecipeEditor
            draft={draft}
            onChange={setDraft}
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />
        ) : (
          <>
            <div className="mt-3 flex shrink-0 gap-1 rounded-xl bg-stone-100 p-1 lg:hidden">
              <button
                type="button"
                onClick={() => setActiveTab('ingredients')}
                className={[
                  'flex-1 rounded-lg py-2 text-sm font-medium transition',
                  activeTab === 'ingredients' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600',
                ].join(' ')}
              >
                Ingredients ({detail.recipe.ingredients.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('steps')}
                className={[
                  'flex-1 rounded-lg py-2 text-sm font-medium transition',
                  activeTab === 'steps' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600',
                ].join(' ')}
              >
                Steps ({detail.step_count})
              </button>
            </div>

            <div className="mt-4 grid min-h-0 flex-1 gap-4 lg:grid-cols-2">
              <section
                className={[
                  'flex min-h-0 flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white',
                  activeTab !== 'ingredients' ? 'hidden lg:flex' : 'flex',
                ].join(' ')}
              >
                <div className="shrink-0 border-b border-stone-100 px-4 py-3">
                  <h2 className="font-semibold text-stone-900">
                    Ingredients
                    <span className="ml-2 text-sm font-normal text-stone-400">
                      ({detail.recipe.ingredients.length})
                    </span>
                  </h2>
                </div>
                <ul className="flex-1 overflow-y-auto px-4 py-3">
                  {detail.recipe.ingredients.map((ing, i) => (
                    <li
                      key={`${ing.name}-${i}`}
                      className="flex items-baseline justify-between gap-3 border-b border-stone-50 py-2 text-sm last:border-0"
                    >
                      <span className="text-stone-800">{ing.name}</span>
                      {ing.quantity && (
                        <span className="shrink-0 text-stone-400">{ing.quantity}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </section>

              <section
                className={[
                  'flex min-h-0 flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white',
                  activeTab !== 'steps' ? 'hidden lg:flex' : 'flex',
                ].join(' ')}
              >
                <div className="shrink-0 border-b border-stone-100 px-4 py-3">
                  <h2 className="font-semibold text-stone-900">
                    Steps
                    <span className="ml-2 text-sm font-normal text-stone-400">
                      ({detail.step_count})
                    </span>
                  </h2>
                </div>
                <ol className="flex-1 space-y-2 overflow-y-auto px-4 py-3">
                  {detail.recipe.steps.map((step, i) => (
                    <li
                      key={step.order}
                      className="flex gap-3 rounded-xl bg-stone-50 px-3 py-2.5 text-sm leading-relaxed text-stone-700"
                    >
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
                        {i + 1}
                      </span>
                      <span className="min-w-0 pt-0.5">{step.instruction}</span>
                    </li>
                  ))}
                </ol>
              </section>
            </div>
          </>
        )}
      </div>
    </Layout>
  )
}
