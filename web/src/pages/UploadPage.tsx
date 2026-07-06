import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { Layout } from '../components/Layout'
import { useFeatures } from '../context/FeaturesContext'
import { ingestSocialLink } from '../api/ingest'
import { parseRecipe } from '../api/client'
import { VideoLinkPreview } from '../components/VideoLinkPreview'
import { RecipeCreateProgress } from '../components/RecipeCreateProgress'
import type { IngestLinkResponse } from '../types/ingest'
import { videoPlatformLabel } from '../types/ingest'

type CreateResult =
  | { status: 'done'; ingested: IngestLinkResponse; rawText: string; parsed: Awaited<ReturnType<typeof parseRecipe>> }
  | { status: 'needs_edit'; ingested: IngestLinkResponse; rawText: string; message: string }

function saveReviewAndGo(
  navigate: ReturnType<typeof useNavigate>,
  rawText: string,
  parsed: Awaited<ReturnType<typeof parseRecipe>>,
  ingested: IngestLinkResponse,
) {
  sessionStorage.setItem(
    'yourcookmate_review',
    JSON.stringify({
      rawText,
      recipe: parsed.recipe,
      usedAi: parsed.used_ai,
      sourceType: ingested.source_type,
      sourceUrl: ingested.source_url,
    }),
  )
  navigate('/new/review')
}

export function UploadPage() {
  const features = useFeatures()
  const [text, setText] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [manualCaption, setManualCaption] = useState('')
  const [extracted, setExtracted] = useState<IngestLinkResponse | null>(null)
  const [editMessage, setEditMessage] = useState<string | null>(null)
  const [progressStep, setProgressStep] = useState<number | null>(null)
  const [progressSession, setProgressSession] = useState(0)
  const navigate = useNavigate()

  const createRecipeMutation = useMutation({
    mutationFn: async (): Promise<CreateResult> => {
      setProgressStep(0)
      const ingested = await ingestSocialLink({
        url: linkUrl.trim(),
        caption: manualCaption.trim() || undefined,
      })
      setProgressStep(1)
      const rawText = ingested.raw_text.trim()
      if (rawText.length < 10) {
        return {
          status: 'needs_edit',
          ingested,
          rawText,
          message:
            'We could not find enough recipe text in that link. Add the caption from the post and try again.',
        }
      }
      setProgressStep(2)
      try {
        const parsed = await parseRecipe({
          raw_text: rawText,
          source_url: ingested.source_url,
          video_duration: ingested.video_duration ?? undefined,
        })
        return { status: 'done', ingested, rawText, parsed }
      } catch {
        return {
          status: 'needs_edit',
          ingested,
          rawText,
          message:
            'We found the recipe but had trouble breaking it into steps. Edit the text below and try again.',
        }
      }
    },
    onMutate: () => {
      setProgressStep(0)
      setProgressSession((s) => s + 1)
    },
    onSuccess: (result) => {
      if (result.status === 'done') {
        saveReviewAndGo(navigate, result.rawText, result.parsed, result.ingested)
        return
      }
      setExtracted(result.ingested)
      setText(result.rawText)
      setEditMessage(result.message)
    },
    onSettled: () => setProgressStep(null),
  })

  const retryParseMutation = useMutation({
    mutationFn: async () => {
      if (!extracted) throw new Error('Nothing to build yet.')
      setProgressStep(0)
      const rawText = text.trim()
      if (rawText.length < 10) {
        throw new Error('Recipe text is too short. Add more detail or paste the caption and try again.')
      }
      return parseRecipe({
        raw_text: rawText,
        source_url: extracted.source_url,
        video_duration: extracted.video_duration ?? undefined,
      })
    },
    onSuccess: (parsed) => {
      if (!extracted) return
      saveReviewAndGo(navigate, text.trim(), parsed, extracted)
    },
    onMutate: () => {
      setProgressStep(0)
      setProgressSession((s) => s + 1)
    },
    onSettled: () => setProgressStep(null),
  })

  const isBusy = createRecipeMutation.isPending || retryParseMutation.isPending
  const canSubmit = linkUrl.trim().length >= 10 && !isBusy
  const showEditPanel = extracted !== null

  const resetLinkFlow = () => {
    setExtracted(null)
    setText('')
    setEditMessage(null)
    setProgressStep(null)
    createRecipeMutation.reset()
    retryParseMutation.reset()
  }

  if (!features.social_ingest) {
    return (
      <Layout>
        <div className="mx-auto max-w-3xl px-4 py-8">
          <h1 className="text-2xl font-bold text-stone-900">Add a recipe</h1>
          <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Adding recipes from links is currently unavailable. Please try again later.
          </p>
        </div>
      </Layout>
    )
  }

  const linkError = createRecipeMutation.error as Error | null
  const parseError = retryParseMutation.error as Error | null

  return (
    <Layout>
      <div className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-2xl font-bold text-stone-900">Add a recipe</h1>
        <p className="mt-1 text-stone-600">
          Paste a link to any cooking video or recipe page — we&apos;ll read it and break it into
          easy step-by-step cards.
        </p>

        {!features.ai && (
          <p className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
            AI parsing is off — recipes use basic text splitting only.
          </p>
        )}

        <div className="mt-6 space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-stone-700">Recipe or video link</span>
            <input
              type="url"
              value={linkUrl}
              onChange={(e) => {
                setLinkUrl(e.target.value)
                if (extracted) resetLinkFlow()
              }}
              placeholder="TikTok, YouTube, Instagram, or any recipe website…"
              className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20"
            />
          </label>

          {linkUrl.trim().length >= 10 && <VideoLinkPreview url={linkUrl} />}

          <label className="block">
            <span className="text-sm font-medium text-stone-700">
              Caption from the post{' '}
              <span className="font-normal text-stone-400">(optional — only if the link doesn&apos;t work)</span>
            </span>
            <textarea
              value={manualCaption}
              onChange={(e) => setManualCaption(e.target.value)}
              placeholder="Copy and paste the video caption here if we can't read the link automatically…"
              rows={4}
              className="mt-1 w-full resize-y rounded-xl border border-stone-200 bg-white p-3 text-sm leading-relaxed text-stone-800 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20"
            />
          </label>

          {!showEditPanel && (
            <button
              type="button"
              disabled={!canSubmit}
              onClick={() => createRecipeMutation.mutate()}
              className="flex min-h-12 w-full cursor-pointer items-center justify-center rounded-2xl bg-brand-600 text-base font-semibold text-white transition enabled:hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:px-10"
            >
              Create step-by-step recipe
            </button>
          )}

          {createRecipeMutation.isPending && progressStep !== null && (
            <RecipeCreateProgress key={`create-${progressSession}`} step={progressStep} mode="full" />
          )}

          {retryParseMutation.isPending && progressStep !== null && (
            <RecipeCreateProgress key={`retry-${progressSession}`} step={progressStep} mode="parse-only" />
          )}

          {linkError && (
            <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
              <p>{linkError.message || 'Something went wrong. Is the backend running?'}</p>
              {linkError.message.includes('caption') && (
                <p className="mt-2 text-red-600/90">
                  Open the post, copy the caption, paste it in the field above, then try again.
                </p>
              )}
            </div>
          )}

          {showEditPanel && extracted && (
            <div className="rounded-2xl border border-brand-200 bg-brand-50/40 p-4">
              {editMessage && (
                <p className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  {editMessage}
                </p>
              )}

              <div className="flex flex-wrap items-start gap-4">
                {extracted.thumbnail_url && (
                  <img
                    src={extracted.thumbnail_url}
                    alt=""
                    className="h-20 w-20 shrink-0 rounded-xl object-cover"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-stone-900">
                    Found on {videoPlatformLabel(extracted.source_type)}
                  </p>
                  {extracted.title && (
                    <p className="mt-0.5 truncate text-sm text-stone-600">{extracted.title}</p>
                  )}
                  {extracted.author && (
                    <p className="text-xs text-stone-500">by {extracted.author}</p>
                  )}
                  {extracted.extraction_notes.length > 0 && (
                    <ul className="mt-2 space-y-0.5 text-xs text-stone-600">
                      {extracted.extraction_notes.map((note) => (
                        <li key={note}>• {note}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <label className="mt-4 block">
                <span className="text-sm font-medium text-stone-700">
                  Recipe text — edit anything that looks wrong
                </span>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={12}
                  className="mt-1 w-full resize-y rounded-xl border border-stone-200 bg-white p-3 text-sm leading-relaxed text-stone-800 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20"
                />
              </label>

              <p className="mt-2 text-xs text-stone-500">
                {text.length.toLocaleString()} characters · confidence{' '}
                {Math.round(extracted.confidence * 100)}%
              </p>

              {parseError && (
                <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
                  {parseError.message}
                </div>
              )}

              <button
                type="button"
                disabled={text.trim().length < 10 || retryParseMutation.isPending}
                onClick={() => retryParseMutation.mutate()}
                className="mt-4 flex min-h-12 w-full cursor-pointer items-center justify-center rounded-2xl bg-brand-600 text-base font-semibold text-white transition enabled:hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:px-10"
              >
                Create step-by-step recipe
              </button>
            </div>
          )}
        </div>

        <p className="mt-6 text-xs text-stone-400">
          Works with TikTok, YouTube, Instagram, and recipe blogs. May take up to a minute for
          longer videos.
        </p>
      </div>
    </Layout>
  )
}
