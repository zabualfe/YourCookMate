import { useEffect, useState } from 'react'
import { checkUsername } from '../api/client'

interface UsernameFieldProps {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  autoFocus?: boolean
  optional?: boolean
}

export function UsernameField({ value, onChange, disabled, autoFocus, optional }: UsernameFieldProps) {
  const [debounced, setDebounced] = useState(value.trim())
  const [status, setStatus] = useState<{ available: boolean; reason?: string | null } | null>(null)

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value.trim().replace(/^@/, '')), 300)
    return () => clearTimeout(id)
  }, [value])

  useEffect(() => {
    if (!debounced) {
      setStatus(null)
      return
    }
    let cancelled = false
    checkUsername(debounced)
      .then((result) => {
        if (!cancelled) setStatus({ available: result.available, reason: result.reason })
      })
      .catch(() => {
        if (!cancelled) setStatus(null)
      })
    return () => {
      cancelled = true
    }
  }, [debounced])

  return (
    <label className="block">
      <span className="text-sm font-medium text-stone-700">
        Username{optional ? ' (optional)' : ''}
      </span>
      <div className="mt-1 flex items-center rounded-xl border border-stone-200 bg-white focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-500/20">
        <span className="pl-4 text-stone-400">@</span>
        <input
          type="text"
          autoComplete="username"
          autoFocus={autoFocus}
          disabled={disabled}
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/^@/, '').toLowerCase())}
          placeholder="yourname"
          maxLength={20}
          className="min-w-0 flex-1 bg-transparent px-2 py-3 outline-none"
        />
      </div>
      <p className="mt-1 text-xs text-stone-500">3–20 characters. Letters, numbers, and underscores.</p>
      {status && debounced && (
        <p className={`mt-1 text-sm ${status.available ? 'text-green-700' : 'text-red-700'}`}>
          {status.available ? `@${debounced} is available` : status.reason || 'That username is not available'}
        </p>
      )}
    </label>
  )
}
