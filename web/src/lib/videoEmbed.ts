import type { VideoSourceType } from '../types/ingest'

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
  const params = new URLSearchParams({
    rel: '0',
    enablejsapi: '1',
    playsinline: '1',
  })
  return {
    embedUrl: `https://www.youtube.com/embed/${id}?${params.toString()}`,
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

function tiktokVideoId(parsed: URL): string | null {
  const path = parsed.pathname
  const patterns = [/\/video\/(\d+)/, /\/share\/video\/(\d+)/, /\/player\/v1\/(\d+)/, /\/embed\/v2\/(\d+)/]
  for (const pattern of patterns) {
    const match = path.match(pattern)
    if (match?.[1]) return match[1]
  }
  return null
}

function tiktokPreview(parsed: URL): Pick<VideoEmbedPreview, 'embedUrl' | 'thumbnailUrl'> | null {
  const id = tiktokVideoId(parsed)
  if (!id) return null
  // Player Kit embed — video-only chrome (no caption/music card).
  const params = new URLSearchParams({
    music_info: '0',
    description: '0',
    autoplay: '0',
    loop: '0',
    rel: '0',
    controls: '1',
    progress_bar: '1',
    play_button: '1',
    volume_control: '1',
    fullscreen_button: '1',
    timestamp: '1',
    closed_caption: '0',
  })
  return {
    embedUrl: `https://www.tiktok.com/player/v1/${id}?${params.toString()}`,
    thumbnailUrl: null,
  }
}

function vimeoPreview(parsed: URL): Pick<VideoEmbedPreview, 'embedUrl' | 'thumbnailUrl'> | null {
  const match = parsed.pathname.match(/^\/(\d+)/)
  if (!match) return null
  return {
    embedUrl: `https://player.vimeo.com/video/${match[1]}`,
    thumbnailUrl: null,
  }
}

/** Build an inline embed preview from a pasted URL (no server call). */
export function resolveVideoEmbed(raw: string): VideoEmbedPreview | null {
  const parsed = normalizeUrl(raw)
  if (!parsed) return null

  const platform = classifyHost(parsed.hostname)
  const normalizedUrl = parsed.toString()
  const isVertical = platform === 'instagram' || platform === 'tiktok'

  let embedUrl: string | null = null
  let thumbnailUrl: string | null = null

  switch (platform) {
    case 'youtube': {
      const yt = youtubePreview(parsed)
      if (yt) {
        embedUrl = yt.embedUrl
        thumbnailUrl = yt.thumbnailUrl
      }
      break
    }
    case 'instagram': {
      const ig = instagramPreview(parsed)
      if (ig) embedUrl = ig.embedUrl
      break
    }
    case 'tiktok': {
      const tt = tiktokPreview(parsed)
      if (tt) embedUrl = tt.embedUrl
      break
    }
    case 'vimeo': {
      const vm = vimeoPreview(parsed)
      if (vm) embedUrl = vm.embedUrl
      break
    }
    default:
      break
  }

  return { platform, normalizedUrl, embedUrl, thumbnailUrl, isVertical }
}
