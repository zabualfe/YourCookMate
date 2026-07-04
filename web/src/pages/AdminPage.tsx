import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Layout } from '../components/Layout'
import { useAuth } from '../context/AuthContext'
import {
  getAdminFeatureFlags,
  getAdminStatus,
  updateAdminFeatureFlags,
  type AdminFeatureFlag,
} from '../api/client'

export function AdminPage() {
  const { isAuthenticated, loading } = useAuth()
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState<Record<string, boolean>>({})
  const [saved, setSaved] = useState(false)

  const { data: adminStatus, isLoading: adminLoading } = useQuery({
    queryKey: ['admin-status'],
    queryFn: getAdminStatus,
    enabled: isAuthenticated,
  })

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-feature-flags'],
    queryFn: getAdminFeatureFlags,
    enabled: isAuthenticated && adminStatus?.is_admin === true,
  })

  useEffect(() => {
    if (!data?.flags) return
    setDraft(Object.fromEntries(data.flags.map((flag) => [flag.key, flag.enabled])))
  }, [data?.flags])

  const saveMutation = useMutation({
    mutationFn: () => updateAdminFeatureFlags(draft),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['features'] })
      queryClient.invalidateQueries({ queryKey: ['admin-feature-flags'] })
      setSaved(true)
      window.setTimeout(() => setSaved(false), 2000)
    },
  })

  if (loading || adminLoading) {
    return (
      <Layout>
        <div className="mx-auto max-w-2xl px-4 py-16 text-center text-stone-500">Loading…</div>
      </Layout>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login?redirect=/admin" replace />
  }

  if (adminStatus && !adminStatus.is_admin) {
    return <Navigate to="/" replace />
  }

  return (
    <Layout>
      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-brand-600">Admin</p>
            <h1 className="mt-1 text-2xl font-bold text-stone-900">Feature flags</h1>
            <p className="mt-2 text-sm text-stone-600">
              Changes save to Supabase and apply live within ~15 seconds — no redeploy needed.
            </p>
          </div>
          <Link to="/" className="text-sm font-medium text-stone-500 hover:text-stone-800">
            ← Back
          </Link>
        </div>

        {isLoading && <p className="text-stone-500">Loading flags…</p>}
        {error && (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
            {(error as Error).message}
          </p>
        )}

        {data && (
          <div className="space-y-3">
            {data.flags.map((flag) => (
              <FlagRow
                key={flag.key}
                flag={flag}
                enabled={draft[flag.key] ?? flag.enabled}
                onChange={(enabled) => setDraft((prev) => ({ ...prev, [flag.key]: enabled }))}
              />
            ))}

            <div className="flex items-center gap-3 pt-4">
              <button
                type="button"
                disabled={saveMutation.isPending}
                onClick={() => saveMutation.mutate()}
                className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
              >
                {saveMutation.isPending ? 'Saving…' : 'Save changes'}
              </button>
              {saved && <span className="text-sm text-green-700">Saved — flags updating live</span>}
              {saveMutation.isError && (
                <span className="text-sm text-red-600">{(saveMutation.error as Error).message}</span>
              )}
            </div>

            {data.updated_at && (
              <p className="text-xs text-stone-400">
                Last updated {new Date(data.updated_at).toLocaleString()}
              </p>
            )}
          </div>
        )}
      </div>
    </Layout>
  )
}

function FlagRow({
  flag,
  enabled,
  onChange,
}: {
  flag: AdminFeatureFlag
  enabled: boolean
  onChange: (enabled: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-start gap-4 rounded-2xl border border-stone-200 bg-white p-4 transition hover:border-stone-300">
      <input
        type="checkbox"
        checked={enabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 h-4 w-4 rounded border-stone-300 text-brand-600 focus:ring-brand-500"
      />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-stone-900">{flag.label}</span>
        <span className="mt-0.5 block text-sm text-stone-500">{flag.description}</span>
        <span className="mt-1 block font-mono text-xs text-stone-400">{flag.key}</span>
      </span>
      <span
        className={[
          'shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold',
          enabled ? 'bg-green-100 text-green-800' : 'bg-stone-100 text-stone-600',
        ].join(' ')}
      >
        {enabled ? 'On' : 'Off'}
      </span>
    </label>
  )
}
