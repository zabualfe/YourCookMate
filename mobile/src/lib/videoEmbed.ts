import type { VideoSourceType } from '@/types/ingest'

export interface VideoEmbedPreview {
  platform: VideoSourceType
  normalizedUrl: string
  embedUrl: string | null
  thumbnailUrl: string | null
  isVertical: boolean
}

function normalizeUrl(raw: string): URL | null {
  const trimmed = raw.trim()
  if (trimmed.length < 10) return null
  try {
    const href = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
    const parsed = new URL(href)
    if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname) return null
    return parsed
  } catch {
    return null
  }
}

function classifyHost(host: string): VideoSourceType {
  const h = host.toLowerCase().replace(/^www\./, '')
  if (h === 'instagram.com' || h === 'instagr.am') return 'instagram'
  if (h.endsWith('tiktok.com') || h === 'vm.tiktok.com' || h === 'vt.tiktok.com') return 'tiktok'
  if (h.includes('youtube.com') || h === 'music.youtube.com' || h === 'youtu.be') return 'youtube'
  if (h.includes('facebook.com') || h === 'fb.watch' || h === 'fb.com') return 'facebook'
  if (h.includes('pinterest.com') || h === 'pin.it') return 'pinterest'
  if (h.includes('vimeo.com')) return 'vimeo'
  return 'video'
}

function youtubePreview(parsed: URL): Pick<VideoEmbedPreview, 'embedUrl' | 'thumbnailUrl'> | null {
  const host = parsed.hostname.replace(/^www\./, '')
  let id: string | null = null
  if (host === 'youtu.be') {
    id = parsed.pathname.split('/').filter(Boolean)[0] ?? null
  } else if (host.includes('youtube.com')) {
    if (parsed.pathname.startsWith('/watch')) {
      id = parsed.searchParams.get('v')
    } else if (parsed.pathname.startsWith('/shorts/')) {
      id = parsed.pathname.split('/')[2] ?? null
    } else if (parsed.pathname.startsWith('/embed/')) {
      id = parsed.pathname.split('/')[2] ?? null
    }
  }
  if (!id) return null
  return {
    embedUrl: `https://www.youtube.com/embed/${id}?rel=0`,
    thumbnailUrl: `https://img.youtube.com/vi/${id}/hqdefault.jpg`,
  }
}

function instagramPreview(parsed: URL): Pick<VideoEmbedPreview, 'embedUrl' | 'thumbnailUrl'> | null {
  const match = parsed.pathname.match(/^\/(reel|p|tv)\/([^/?#]+)/i)
  if (!match) return null
  const [, kind, code] = match
  return {
    embedUrl: `https://www.instagram.com/${kind}/${code}/embed/`,
    thumbnailUrl: null,
  }
}

function tiktokPreview(parsed: URL): Pick<VideoEmbedPreview, 'embedUrl' | 'thumbnailUrl'> | null {
  const match = parsed.pathname.match(/\/video\/(\d+)/)
  if (!match) return null
  return {
    embedUrl: `https://www.tiktok.com/embed/v2/${match[1]}`,
    thumbnailUrl: null,
  }
}

export function resolveVideoEmbed(raw: string): VideoEmbedPreview | null {
  const parsed = normalizeUrl(raw)
  if (!parsed) return null

  const platform = classifyHost(parsed.hostname)
  const normalizedUrl = parsed.toString()
  const isVertical = platform === 'instagram' || platform === 'tiktok'

  let embedUrl: string | null = null
  let thumbnailUrl: string | null = null

  if (platform === 'youtube') {
    const yt = youtubePreview(parsed)
    if (yt) {
      embedUrl = yt.embedUrl
      thumbnailUrl = yt.thumbnailUrl
    }
  } else if (platform === 'instagram') {
    const ig = instagramPreview(parsed)
    if (ig) embedUrl = ig.embedUrl
  } else if (platform === 'tiktok') {
    const tt = tiktokPreview(parsed)
    if (tt) embedUrl = tt.embedUrl
  }

  return { platform, normalizedUrl, embedUrl, thumbnailUrl, isVertical }
}
