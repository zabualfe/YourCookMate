import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { Layout } from '../components/Layout'
import { ingestSocialLink, parseRecipe } from '../api/client'
import type { IngestLinkResponse } from '../types/ingest'
import { videoPlatformLabel } from '../types/ingest'

const SAMPLE = `Classic Tomato Pasta

Ingredients:
- 12 oz spaghetti
- 2 tbsp olive oil
- 3 cloves garlic, minced
- 1 can (28 oz) crushed tomatoes
- 1 tsp dried oregano
- Salt and pepper to taste
- Fresh basil for garnish

Instructions:
1. Bring a large pot of salted water to a boil. Cook spaghetti according to package directions until al dente. Reserve 1 cup pasta water, then drain.
2. While pasta cooks, heat olive oil in a large skillet over medium heat. Add garlic and sauté 30 seconds until fragrant.
3. Add crushed tomatoes and oregano. Simmer 10 minutes, stirring occasionally. Season with salt and pepper.
4. Add drained pasta to the sauce. Toss, adding pasta water as needed until silky. Serve topped with fresh basil.`

type Tab = 'text' | 'link'

export function UploadPage() {
  const [tab, setTab] = useState<Tab>('text')
  const [text, setText] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [manualCaption, setManualCaption] = useState('')
  const [extracted, setExtracted] = useState<IngestLinkResponse | null>(null)
  const navigate = useNavigate()

  const parseMutation = useMutation({
    mutationFn: (rawText: string) =>
      parseRecipe({
        raw_text: rawText,
        source_url: extracted?.source_url,
        video_duration: extracted?.video_duration ?? undefined,
      }),
    onSuccess: (data, rawText) => {
      sessionStorage.setItem(
        'yourcookmate_review',
        JSON.stringify({
          rawText,
          recipe: data.recipe,
          usedAi: data.used_ai,
          sourceType: extracted?.source_type,
          sourceUrl: extracted?.source_url,
        }),
      )
      navigate('/new/review')
    },
  })

  const ingestMutation = useMutation({
    mutationFn: () =>
      ingestSocialLink({
        url: linkUrl.trim(),
        caption: manualCaption.trim() || undefined,
      }),
    onSuccess: (data) => {
      setExtracted(data)
      setText(data.raw_text)
    },
  })

  const activeText = tab === 'link' && extracted ? text : text
  const canParse = activeText.trim().length >= 10 && !parseMutation.isPending

  const handleParse = () => {
    parseMutation.mutate(activeText.trim())
  }

  const resetLinkFlow = () => {
    setExtracted(null)
    setText('')
    setManualCaption('')
  }

  return (
    <Layout>
      <div className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-2xl font-bold text-stone-900">Add a recipe</h1>
        <p className="mt-1 text-stone-600">
          Paste text or import from a video link — Instagram reels, TikTok, YouTube, and more.
        </p>

        <div className="mt-6 flex gap-1 rounded-xl bg-stone-100 p-1">
          <button
            type="button"
            onClick={() => {
              setTab('text')
              setExtracted(null)
            }}
            className={[
              'flex-1 rounded-lg py-2.5 text-sm font-medium transition',
              tab === 'text' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600 hover:text-stone-800',
            ].join(' ')}
          >
            Paste text
          </button>
          <button
            type="button"
            onClick={() => setTab('link')}
            className={[
              'flex-1 rounded-lg py-2.5 text-sm font-medium transition',
              tab === 'link' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600 hover:text-stone-800',
            ].join(' ')}
          >
            Video link
          </button>
        </div>

        {tab === 'text' ? (
          <>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste your full recipe here — title, ingredients, and instructions..."
              rows={16}
              className="mt-6 w-full resize-y rounded-2xl border border-stone-200 bg-white p-4 text-base leading-relaxed text-stone-800 shadow-sm outline-none ring-brand-500/0 transition focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20"
            />

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setText(SAMPLE)}
                className="text-sm font-medium text-brand-600 hover:text-brand-700"
              >
                Try sample recipe
              </button>
              <span className="text-stone-300">|</span>
              <span className="text-sm text-stone-400">{text.length.toLocaleString()} characters</span>
            </div>
          </>
        ) : (
          <div className="mt-6 space-y-4">
            <label className="block">
              <span className="text-sm font-medium text-stone-700">Video URL</span>
              <input
                type="url"
                value={linkUrl}
                onChange={(e) => {
                  setLinkUrl(e.target.value)
                  if (extracted) resetLinkFlow()
                }}
                placeholder="Instagram reel, TikTok, YouTube, Facebook, Pinterest, or any public video URL…"
                className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-stone-700">
                Caption <span className="font-normal text-stone-400">(optional — use if import fails)</span>
              </span>
              <textarea
                value={manualCaption}
                onChange={(e) => setManualCaption(e.target.value)}
                placeholder="Paste the caption here if the link can't be fetched automatically…"
                rows={4}
                className="mt-1 w-full resize-y rounded-xl border border-stone-200 bg-white p-3 text-sm leading-relaxed text-stone-800 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20"
              />
            </label>

            <button
              type="button"
              disabled={linkUrl.trim().length < 10 || ingestMutation.isPending}
              onClick={() => ingestMutation.mutate()}
              className="rounded-xl border border-stone-200 bg-white px-5 py-2.5 text-sm font-semibold text-stone-800 transition enabled:hover:bg-stone-50 disabled:opacity-50"
            >
              {ingestMutation.isPending ? 'Importing (may take a minute)…' : 'Import from link'}
            </button>

            {ingestMutation.isError && (
              <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
                {(ingestMutation.error as Error).message}
              </p>
            )}

            {extracted && (
              <div className="rounded-2xl border border-brand-200 bg-brand-50/40 p-4">
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
                      Imported from {videoPlatformLabel(extracted.source_type)}
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
                    Extracted text — edit before parsing
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
              </div>
            )}
          </div>
        )}

        {parseMutation.isError && (
          <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
            <p>{(parseMutation.error as Error).message || 'Failed to parse recipe. Is the backend running?'}</p>
            {tab === 'link' && (
              <p className="mt-2 text-red-600/90">
                Recipe videos often put instructions in the caption, voiceover, or on-screen text. Open the
                video, copy the caption into the text box above, edit it, then try parsing again.
              </p>
            )}
          </div>
        )}

        {tab === 'link' && extracted && extracted.confidence < 0.6 && (
          <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Low-confidence import — the link may not have returned a full recipe. Copy the caption from the
            video, paste it into the text box below, then parse.
          </p>
        )}

        {(tab === 'text' || extracted) && (
          <button
            type="button"
            disabled={!canParse}
            onClick={handleParse}
            className="mt-6 flex min-h-12 w-full items-center justify-center rounded-2xl bg-brand-600 text-base font-semibold text-white transition enabled:hover:bg-brand-700 disabled:opacity-50 sm:w-auto sm:px-10"
          >
            {parseMutation.isPending ? 'Breaking into steps…' : 'Parse recipe'}
          </button>
        )}

        <p className="mt-3 text-xs text-stone-400">
          Video import reads captions, on-screen text, spoken audio, and analyzes video frames (works for
          silent Instagram reels and similar). Instagram/Facebook may need YTDLP_COOKIES_FILE in backend/.env.
          Requires OPENAI_API_KEY for parsing, transcription, and video analysis.
        </p>
      </div>
    </Layout>
  )
}
