/**
 * Feature flags — reads from backend /features (Supabase-backed, live updates).
 * Optional Vercel env overrides still apply when set.
 */

export interface AppFeatures {
  auth: boolean
  registration: boolean
  ai: boolean
  social_ingest: boolean
  community: boolean
  instacart: boolean
  instacart_shopping: boolean
  instacart_connect: boolean
  aws_transcribe: boolean
}

const DEFAULTS: AppFeatures = {
  auth: true,
  registration: true,
  ai: true,
  social_ingest: true,
  community: true,
  instacart: false,
  instacart_shopping: false,
  instacart_connect: false,
  aws_transcribe: false,
}

function parseBool(raw: string | undefined): boolean | undefined {
  if (raw === undefined || raw.trim() === '') return undefined
  const v = raw.trim().toLowerCase()
  if (v === 'true' || v === '1' || v === 'yes') return true
  if (v === 'false' || v === '0' || v === 'no') return false
  return undefined
}

function applyOverride(flags: AppFeatures, key: keyof AppFeatures, envName: string) {
  const parsed = parseBool(process.env[envName])
  if (parsed !== undefined) {
    flags[key] = parsed
  }
}

async function fetchBackendFeatures(apiUrl: string): Promise<AppFeatures> {
  const res = await fetch(`${apiUrl.replace(/\/$/, '')}/features`, {
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) return { ...DEFAULTS }
  return { ...DEFAULTS, ...(await res.json()) }
}

export default async function handler(
  _req: unknown,
  res: {
    setHeader: (name: string, value: string) => void
    status: (code: number) => { json: (body: AppFeatures) => void }
  },
) {
  const apiUrl = process.env.VITE_API_URL
  let flags = apiUrl ? await fetchBackendFeatures(apiUrl) : { ...DEFAULTS }

  applyOverride(flags, 'auth', 'FEATURE_AUTH')
  applyOverride(flags, 'registration', 'FEATURE_REGISTRATION')
  applyOverride(flags, 'ai', 'FEATURE_AI')
  applyOverride(flags, 'social_ingest', 'FEATURE_SOCIAL_INGEST')
  applyOverride(flags, 'community', 'FEATURE_COMMUNITY')
  applyOverride(flags, 'instacart', 'FEATURE_INSTACART')
  applyOverride(flags, 'aws_transcribe', 'FEATURE_AWS_TRANSCRIBE')

  if (parseBool(process.env.FEATURE_INSTACART) === false) {
    flags.instacart_shopping = false
    flags.instacart_connect = false
  }

  const awsApiUrl =
    process.env.VITE_AWS_API_URL?.trim() ||
    process.env.AWS_API_URL?.trim() ||
    apiUrl?.trim() ||
    null

  res.setHeader('Cache-Control', 'public, s-maxage=10, stale-while-revalidate=30')
  res.status(200).json({ ...flags, aws_api_url: awsApiUrl || null })
}
