import type { IngestLinkResponse } from '../types/ingest'

const BUILD_TIME_AWS_BASE = (import.meta.env.VITE_AWS_API_URL as string | undefined)?.replace(
  /\/$/,
  '',
)

/** Runtime override from /api/features (Vercel env without rebuild). */
let runtimeAwsBase: string | undefined = BUILD_TIME_AWS_BASE

const JOB_POLL_MS = 1000
const JOB_POLL_MS_MAX = 2000
const JOB_MAX_ATTEMPTS = 150 // ~5 minutes

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

export function configureAwsIngestBase(url: string | null | undefined): void {
  const cleaned = url?.trim().replace(/\/$/, '')
  runtimeAwsBase = cleaned || BUILD_TIME_AWS_BASE
}

export function getAwsIngestBase(): string | undefined {
  return runtimeAwsBase
}

export function ingestUsesAws(): boolean {
  return Boolean(getAwsIngestBase())
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function awsApiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const base = getAwsIngestBase()
  if (!base) {
    throw new Error('AWS API URL is not configured (set VITE_AWS_API_URL or AWS_API_URL on Vercel)')
  }
  const res = await fetch(`${base}${path}`, {
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

/** Fast link preview — title, author, thumbnail (no full import). */
export async function fetchLinkPreview(url: string): Promise<import('../types/ingest').LinkPreviewResponse> {
  const body = { url: url.trim() }
  if (getAwsIngestBase()) {
    return awsApiRequest('/ingest/preview', {
      method: 'POST',
      body: JSON.stringify(body),
    })
  }
  const { fetchLinkPreviewSync } = await import('./client')
  return fetchLinkPreviewSync(body)
}

/** Social link import — AWS async when aws_api_url is configured, else Render sync. */
export async function ingestSocialLink(payload: {
  url: string
  caption?: string
  force?: boolean
}): Promise<IngestLinkResponse> {
  if (!getAwsIngestBase() || import.meta.env.DEV) {
    const { ingestSocialLinkSync } = await import('./client')
    return ingestSocialLinkSync(payload)
  }

  const queued = await awsApiRequest<IngestJobQueued>('/ingest/link', {
    method: 'POST',
    body: JSON.stringify({
      url: payload.url,
      caption: payload.caption || undefined,
      force: payload.force || undefined,
    }),
  })
  return pollIngestJob(queued.job_id)
}

/** Break raw text into structured recipe steps via AWS Bedrock Nova. */
export async function parseRecipeViaAws(payload: {
  raw_text: string
  source_url?: string
  video_duration?: number | null
  force?: boolean
}): Promise<import('../types/recipe').ParseRecipeResponse> {
  return awsApiRequest('/recipes/parse', {
    method: 'POST',
    body: JSON.stringify({
      raw_text: payload.raw_text,
      source_url: payload.source_url,
      video_duration: payload.video_duration ?? undefined,
      force: payload.force || undefined,
    }),
  })
}
