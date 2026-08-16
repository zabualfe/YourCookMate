import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { cancelPlan, resumePlan, startBillingPortal } from '../api/client'
import type { BillingPlansResponse } from '../types/billing'

function formatEndDate(iso?: string | null) {
  if (!iso) return 'the end of your billing period'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return 'the end of your billing period'
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export function ProBillingActions({ billing }: { billing: BillingPlansResponse }) {
  const queryClient = useQueryClient()
  const [confirming, setConfirming] = useState(false)
  const configured = billing.billing_configured
  const cancelScheduled = Boolean(billing.cancel_at_period_end)
  const endsOn = formatEndDate(billing.subscription_ends_at)

  const syncBilling = (data: BillingPlansResponse) => {
    queryClient.setQueryData(['billing-plans'], data)
  }

  const portal = useMutation({
    mutationFn: startBillingPortal,
    onSuccess: (data) => {
      window.location.href = data.url
    },
  })
  const cancel = useMutation({
    mutationFn: cancelPlan,
    onSuccess: (data) => {
      setConfirming(false)
      syncBilling(data)
    },
  })
  const resume = useMutation({
    mutationFn: resumePlan,
    onSuccess: syncBilling,
  })

  const pending = portal.isPending || cancel.isPending || resume.isPending
  const error = portal.error || cancel.error || resume.error

  return (
    <div className="space-y-3">
      {cancelScheduled ? (
        <>
          <p className="text-sm text-stone-600">
            Pro stays on until {endsOn}. After that you’ll move back to Free.
          </p>
          <button
            type="button"
            disabled={pending || !configured}
            onClick={() => resume.mutate()}
            className="w-full rounded-full bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
          >
            {resume.isPending ? 'Saving…' : 'Keep Pro'}
          </button>
        </>
      ) : confirming ? (
        <>
          <p className="text-sm text-stone-600">
            Cancel Pro? You’ll keep access until {endsOn}, then return to the Free plan.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              disabled={pending}
              onClick={() => setConfirming(false)}
              className="flex-1 rounded-full border border-stone-200 px-4 py-2.5 text-sm font-semibold text-stone-800 hover:bg-stone-50 disabled:opacity-60"
            >
              Never mind
            </button>
            <button
              type="button"
              disabled={pending || !configured}
              onClick={() => cancel.mutate()}
              className="flex-1 rounded-full bg-red-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-60"
            >
              {cancel.isPending ? 'Canceling…' : 'Yes, cancel'}
            </button>
          </div>
        </>
      ) : (
        <button
          type="button"
          disabled={pending || !configured}
          onClick={() => setConfirming(true)}
          className="w-full rounded-full border border-stone-200 px-4 py-2.5 text-sm font-semibold text-stone-800 hover:bg-stone-50 disabled:opacity-60"
        >
          Cancel plan
        </button>
      )}
      <button
        type="button"
        disabled={pending || !configured}
        onClick={() => portal.mutate()}
        className="w-full text-sm font-medium text-brand-700 hover:text-brand-800 disabled:opacity-60"
      >
        {portal.isPending ? 'Opening…' : 'Manage billing'}
      </button>
      {error && (
        <p className="text-sm text-red-700">
          {error instanceof Error ? error.message : 'Could not update your plan'}
        </p>
      )}
    </div>
  )
}
