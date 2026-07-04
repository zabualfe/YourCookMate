import { useEffect, useState } from 'react'
import { fetchLinkPreview } from '../api/ingest'
import { resolveVideoEmbed } from '../lib/videoEmbed'
import type { LinkPreviewResponse } from '../types/ingest'
import { videoPlatformLabel } from '../types/ingest'

interface VideoLinkPreviewProps {
  url: string
}

function VideoThumb({ thumbnailUrl }: { thumbnailUrl: string | null | undefined }) {
  if (thumbnailUrl) {
    return (
      <img
        src={thumbnailUrl}
        alt=""
        className="h-14 w-14 shrink-0 rounded-lg object-cover ring-1 ring-green-200"
      />
    )
  }

  return (
    <div
      className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-green-100 ring-1 ring-green-200"
      aria-hidden
    >
      <svg className="h-6 w-6 text-green-700" viewBox="0 0 24 24" fill="currentColor">
        <path d="M8 5v14l11-7L8 5z" />
      </svg>
    </div>
  )
}

export function VideoLinkPreview({ url }: VideoLinkPreviewProps) {
  const [preview, setPreview] = useState<LinkPreviewResponse | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const trimmed = url.trim()
    if (trimmed.length < 10) {
      setPreview(null)
      setLoading(false)
      return undefined
    }

    setLoading(true)
    const controller = new AbortController()

    const timer = window.setTimeout(() => {
      fetchLinkPreview(trimmed)
        .then((result) => {
          if (!controller.signal.aborted) setPreview(result)
        })
        .catch(() => {
          if (controller.signal.aborted) return
          const fallback = resolveVideoEmbed(trimmed)
          setPreview({
            valid: Boolean(fallback),
            source_type: fallback?.platform ?? 'video',
            source_url: fallback?.normalizedUrl ?? trimmed,
            title: fallback ? `${videoPlatformLabel(fallback.platform)} video` : null,
            author: null,
            thumbnail_url: fallback?.thumbnailUrl ?? null,
            message: fallback ? null : 'Could not check this link',
          })
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false)
        })
    }, 500)

    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [url])

  if (url.trim().length < 10) return null

  if (loading) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3">
        <div className="h-14 w-14 shrink-0 animate-pulse rounded-lg bg-green-100" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="h-3 w-32 animate-pulse rounded bg-green-100" />
          <div className="h-3 w-24 animate-pulse rounded bg-green-100" />
        </div>
      </div>
    )
  }

  if (!preview) return null

  if (!preview.valid) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <p className="font-medium">Couldn&apos;t verify this link</p>
        <p className="mt-1 text-amber-800/90">
          {preview.message ?? 'Check the URL or paste the caption manually.'}
        </p>
      </div>
    )
  }

  const title = preview.title || `${videoPlatformLabel(preview.source_type)} video`

  return (
    <div className="flex items-center gap-3 rounded-xl border border-green-300 bg-green-50 px-4 py-3 shadow-sm">
      <VideoThumb thumbnailUrl={preview.thumbnail_url} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-green-950">{title}</p>
        {preview.author ? (
          <p className="truncate text-sm text-green-800">by {preview.author}</p>
        ) : (
          <p className="text-sm text-green-700">{videoPlatformLabel(preview.source_type)}</p>
        )}
      </div>
      <span className="shrink-0 rounded-full bg-green-200 px-2 py-0.5 text-xs font-semibold text-green-900">
        ✓
      </span>
    </div>
  )
}
