import type { IngestLinkResponse } from '@/types/ingest'

const AWS_INGEST_BASE = (
  process.env.EXPO_PUBLIC_AWS_API_URL || process.env.EXPO_PUBLIC_API_URL
)?.replace(/\/$/, '')

const JOB_POLL_MS = 1000
const JOB_POLL_MS_MAX = 2000
const JOB_MAX_ATTEMPTS = 150

export interface IngestJobQueued {
  job_id: string
  status: 'queued'
}

export interface IngestJobStatus {
  job_id: string
  status: 'queued' | 'processing' | 'completed' | 'failed'
  result?: IngestLinkResponse | null
  error?: string | null
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function awsApiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (!AWS_INGEST_BASE) {
    throw new Error('EXPO_PUBLIC_AWS_API_URL is not configured')
  }
  const res = await fetch(`${AWS_INGEST_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    const detail = (body as { detail?: unknown }).detail
    const message =
      typeof detail === 'string'
        ? detail
        : `AWS request failed (${res.status})`
    throw new Error(message)
  }
  return res.json() as Promise<T>
}

async function pollIngestJob(jobId: string): Promise<IngestLinkResponse> {
  for (let attempt = 0; attempt < JOB_MAX_ATTEMPTS; attempt += 1) {
    const job = await awsApiRequest<IngestJobStatus>(`/jobs/${jobId}`)
    if (job.status === 'completed' && job.result) {
      return job.result
    }
    if (job.status === 'failed') {
      throw new Error(job.error || 'Import failed')
    }
    const delay = Math.min(JOB_POLL_MS + attempt * 100, JOB_POLL_MS_MAX)
    await sleep(delay)
  }
  throw new Error('Import timed out — try again or paste the caption manually.')
}

export function ingestUsesAws(): boolean {
  return Boolean(AWS_INGEST_BASE)
}

export async function fetchLinkPreview(url: string): Promise<import('@/types/ingest').LinkPreviewResponse> {
  const body = { url: url.trim() }
  if (AWS_INGEST_BASE) {
    return awsApiRequest('/ingest/preview', {
      method: 'POST',
      body: JSON.stringify(body),
    })
  }
  const { fetchLinkPreviewSync } = await import('./client')
  return fetchLinkPreviewSync(body)
}

export async function ingestSocialLink(payload: {
  url: string
  caption?: string
}): Promise<IngestLinkResponse> {
  if (!AWS_INGEST_BASE) {
    const { ingestSocialLinkSync } = await import('./client')
    return ingestSocialLinkSync(payload)
  }

  const queued = await awsApiRequest<IngestJobQueued>('/ingest/link', {
    method: 'POST',
    body: JSON.stringify({
      url: payload.url,
      caption: payload.caption || undefined,
    }),
  })
  return pollIngestJob(queued.job_id)
}

export async function parseRecipeViaAws(payload: {
  raw_text: string
  source_url?: string
  video_duration?: number | null
}): Promise<import('@/types/recipe').ParseRecipeResponse> {
  return awsApiRequest('/recipes/parse', {
    method: 'POST',
    body: JSON.stringify({
      raw_text: payload.raw_text,
      source_url: payload.source_url,
      video_duration: payload.video_duration ?? undefined,
    }),
  })
}
