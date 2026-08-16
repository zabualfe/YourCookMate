import type { ParsedRecipe } from './recipe'

export interface IngestLinkResponse {
  raw_text: string
  source_type: string
  source_url: string
  title?: string | null
  author?: string | null
  thumbnail_url?: string | null
  video_duration?: number | null
  extraction_notes: string[]
  confidence: number
  from_cache?: boolean
  existing_recipe_id?: string | null
  used_ai?: boolean | null
  recipe?: ParsedRecipe | null
  found?: boolean
}

export interface LinkPreviewResponse {
  valid: boolean
  source_type: string
  source_url: string
  title?: string | null
  author?: string | null
  thumbnail_url?: string | null
  video_duration?: number | null
  message?: string | null
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
