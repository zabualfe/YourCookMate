import { useState } from 'react'
import { Linking, Pressable, Text, View } from 'react-native'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { cancelPlan, resumePlan, startBillingPortal } from '@/api/client'
import type { BillingPlansResponse } from '@/types/billing'
import { colors, commonStyles, fonts, spacing } from '@/constants/theme'

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
    onSuccess: async (data) => {
      await Linking.openURL(data.url)
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
    <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
      {cancelScheduled ? (
        <>
          <Text style={commonStyles.amberBannerText}>
            Pro stays on until {endsOn}. After that you’ll move back to Free.
          </Text>
          <Pressable
            onPress={() => resume.mutate()}
            disabled={pending || !configured}
            style={commonStyles.primaryBtn}
          >
            <Text style={commonStyles.primaryBtnText}>{resume.isPending ? 'Saving…' : 'Keep Pro'}</Text>
          </Pressable>
        </>
      ) : confirming ? (
        <>
          <Text style={styles.confirmText}>
            Cancel Pro? You’ll keep access until {endsOn}, then return to the Free plan.
          </Text>
          <Pressable
            onPress={() => setConfirming(false)}
            disabled={pending}
            style={commonStyles.secondaryBtn}
          >
            <Text style={commonStyles.secondaryBtnText}>Never mind</Text>
          </Pressable>
          <Pressable
            onPress={() => cancel.mutate()}
            disabled={pending || !configured}
            style={[commonStyles.primaryBtn, { backgroundColor: colors.red700 }]}
          >
            <Text style={commonStyles.primaryBtnText}>{cancel.isPending ? 'Canceling…' : 'Yes, cancel'}</Text>
          </Pressable>
        </>
      ) : (
        <Pressable
          onPress={() => setConfirming(true)}
          disabled={pending || !configured}
          style={commonStyles.secondaryBtn}
        >
          <Text style={commonStyles.secondaryBtnText}>Cancel plan</Text>
        </Pressable>
      )}
      <Pressable onPress={() => portal.mutate()} disabled={pending || !configured} style={styles.linkBtn}>
        <Text style={commonStyles.linkText}>{portal.isPending ? 'Opening…' : 'Manage billing'}</Text>
      </Pressable>
      {error ? (
        <Text style={[commonStyles.errorBannerText, { marginTop: spacing.xs }]}>
          {error instanceof Error ? error.message : 'Could not update your plan'}
        </Text>
      ) : null}
    </View>
  )
}

const styles = {
  confirmText: {
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 20,
    color: colors.stone600,
  },
  linkBtn: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
}
