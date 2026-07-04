import { useEffect, useState } from 'react'
import { resolveVideoEmbed, type VideoEmbedPreview } from '../lib/videoEmbed'
import { videoPlatformLabel } from '../types/ingest'

interface VideoLinkPreviewProps {
  url: string
}

export function VideoLinkPreview({ url }: VideoLinkPreviewProps) {
  const [preview, setPreview] = useState<VideoEmbedPreview | null>(null)

  useEffect(() => {
    const trimmed = url.trim()
    if (trimmed.length < 10) {
      setPreview(null)
      return undefined
    }

    const timer = window.setTimeout(() => {
      setPreview(resolveVideoEmbed(trimmed))
    }, 400)

    return () => window.clearTimeout(timer)
  }, [url])

  if (!preview) return null

  const platformLabel = videoPlatformLabel(preview.platform)

  if (preview.embedUrl) {
    return (
      <div className="overflow-hidden rounded-2xl border border-stone-200 bg-stone-900 shadow-sm">
        <div className="flex items-center justify-between border-b border-stone-700/80 bg-stone-800 px-3 py-2">
          <p className="text-xs font-medium text-stone-200">
            {platformLabel} preview
          </p>
          <a
            href={preview.normalizedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium text-brand-300 hover:text-brand-200"
          >
            Open original
          </a>
        </div>
        <div
          className={[
            'relative w-full bg-black',
            preview.isVertical ? 'mx-auto max-w-sm' : '',
          ].join(' ')}
        >
          <iframe
            src={preview.embedUrl}
            title={`${platformLabel} video preview`}
            className={[
              'w-full border-0',
              preview.isVertical ? 'aspect-[9/16] max-h-[32rem]' : 'aspect-video',
            ].join(' ')}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            loading="lazy"
          />
        </div>
      </div>
    )
  }

  if (preview.thumbnailUrl) {
    return (
      <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-stone-100 px-3 py-2">
          <p className="text-xs font-medium text-stone-600">{platformLabel} link detected</p>
          <a
            href={preview.normalizedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium text-brand-600 hover:text-brand-700"
          >
            Open video
          </a>
        </div>
        <img
          src={preview.thumbnailUrl}
          alt=""
          className="aspect-video w-full object-cover"
        />
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-600">
      <p>
        <span className="font-medium text-stone-800">{platformLabel}</span> link detected.
        {preview.platform === 'tiktok' && preview.normalizedUrl.includes('vm.tiktok.com') ? (
          <> Short TikTok links can&apos;t embed until import — try importing or use the full tiktok.com URL.</>
        ) : preview.embedUrl ? (
          <> Preview blocked by the platform — you can still import.</>
        ) : (
          <> Preview not available for this URL format — you can still try importing.</>
        )}
      </p>
    </div>
  )
}
