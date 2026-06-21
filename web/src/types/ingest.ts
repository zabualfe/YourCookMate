import type { ParsedRecipe } from './recipe'

export type VideoSourceType =
  | 'instagram'
  | 'tiktok'
  | 'youtube'
  | 'facebook'
  | 'pinterest'
  | 'vimeo'
  | 'video'

export interface IngestLinkResponse {
  raw_text: string
  source_type: VideoSourceType | string
  source_url: string
  title?: string | null
  author?: string | null
  thumbnail_url?: string | null
  video_duration?: number | null
  extraction_notes: string[]
  confidence: number
}

export interface ReviewDraft {
  rawText: string
  recipe: ParsedRecipe
  usedAi: boolean
  sourceType?: string
  sourceUrl?: string
}

export function videoPlatformLabel(sourceType: string): string {
  switch (sourceType) {
    case 'instagram':
      return 'Instagram'
    case 'tiktok':
      return 'TikTok'
    case 'youtube':
      return 'YouTube'
    case 'facebook':
      return 'Facebook'
    case 'pinterest':
      return 'Pinterest'
    case 'vimeo':
      return 'Vimeo'
    case 'video':
      return 'Video'
    default:
      return sourceType
  }
}
