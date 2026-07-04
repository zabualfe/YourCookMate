import type { IngestLinkResponse } from '@/types/ingest'

const AWS_INGEST_BASE = process.env.EXPO_PUBLIC_AWS_API_URL?.replace(/\/$/, '')

const JOB_POLL_MS = 2000
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

async function awsIngestRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
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
        : `AWS ingest request failed (${res.status})`
    throw new Error(message)
  }
  return res.json() as Promise<T>
}

async function pollIngestJob(jobId: string): Promise<IngestLinkResponse> {
  for (let attempt = 0; attempt < JOB_MAX_ATTEMPTS; attempt += 1) {
    const job = await awsIngestRequest<IngestJobStatus>(`/jobs/${jobId}`)
    if (job.status === 'completed' && job.result) {
      return job.result
    }
    if (job.status === 'failed') {
      throw new Error(job.error || 'Import failed')
    }
    await sleep(JOB_POLL_MS)
  }
  throw new Error('Import timed out — try again or paste the caption manually.')
}

export function ingestUsesAws(): boolean {
  return Boolean(AWS_INGEST_BASE)
}

export async function ingestSocialLink(payload: {
  url: string
  caption?: string
}): Promise<IngestLinkResponse> {
  if (!AWS_INGEST_BASE) {
    const { ingestSocialLinkSync } = await import('./client')
    return ingestSocialLinkSync(payload)
  }

  const queued = await awsIngestRequest<IngestJobQueued>('/ingest/link', {
    method: 'POST',
    body: JSON.stringify({
      url: payload.url,
      caption: payload.caption || undefined,
    }),
  })
  return pollIngestJob(queued.job_id)
}
