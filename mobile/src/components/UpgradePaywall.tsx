import { Linking, Pressable, Text, View } from 'react-native'
import { router } from 'expo-router'
import { useMutation } from '@tanstack/react-query'
import { startCheckout } from '@/api/client'
import type { UsageSnapshot } from '@/types/billing'
import { videoLimitLabel } from '@/types/billing'
import { colors, commonStyles, fonts, radii, spacing } from '@/constants/theme'

type PaywallReason = 'quota' | 'duration' | 'expired' | 'upgrade'

interface UpgradePaywallProps {
  reason: PaywallReason
  usage?: UsageSnapshot | null
}

const COPY: Record<PaywallReason, { title: string; body: string }> = {
  quota: {
    title: 'Daily upload limit reached',
    body: 'Free accounts can import 2 recipes a day. Pro unlocks 10 uploads a day and 3-minute videos.',
  },
  duration: {
    title: 'This video is too long for Free',
    body: 'Free imports are limited to 1-minute videos. Upgrade to Pro for clips up to 3 minutes.',
  },
  expired: {
    title: 'This recipe is on the free 14-day window',
    body: 'Free recipes stay viewable for 14 days. Upgrade to Pro to open this one again.',
  },
  upgrade: {
    title: 'Upgrade to Pro',
    body: '10 uploads a day, 3-minute videos, and recipes that stay in your library.',
  },
}

export function UpgradePaywall({ reason, usage }: UpgradePaywallProps) {
  const copy = COPY[reason]
  const checkout = useMutation({
    mutationFn: () => startCheckout(),
    onSuccess: async (data) => {
      await Linking.openURL(data.url)
    },
  })
  const configured = usage?.billing_configured ?? true

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{copy.title}</Text>
      <Text style={styles.body}>{copy.body}</Text>
      {usage && !usage.is_pro ? (
        <Text style={styles.meta}>
          Free: {usage.uploads_limit} uploads/day · videos up to {videoLimitLabel(usage.max_video_seconds)}
          {usage.visibility_days ? ` · ${usage.visibility_days}-day viewing window` : ''}
        </Text>
      ) : null}
      {configured ? (
        <Pressable
          onPress={() => checkout.mutate()}
          disabled={checkout.isPending}
          style={[commonStyles.primaryBtn, { marginTop: spacing.md }]}
        >
          <Text style={commonStyles.primaryBtnText}>
            {checkout.isPending ? 'Opening checkout…' : 'Upgrade to Pro'}
          </Text>
        </Pressable>
      ) : (
        <Text style={[styles.meta, { marginTop: spacing.md }]}>
          Pro checkout isn’t configured on this server yet.
        </Text>
      )}
      <Pressable onPress={() => router.push('/(tabs)/profile')} style={styles.linkBtn}>
        <Text style={commonStyles.linkText}>View plans</Text>
      </Pressable>
      {checkout.error ? (
        <Text style={[commonStyles.errorBannerText, { marginTop: spacing.sm }]}>
          {checkout.error instanceof Error ? checkout.error.message : 'Could not start checkout'}
        </Text>
      ) : null}
    </View>
  )
}

const styles = {
  card: {
    borderRadius: radii.xxl,
    borderWidth: 1,
    borderColor: '#fde68a',
    backgroundColor: '#fffbeb',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  title: {
    fontFamily: fonts.displaySemiBold,
    fontSize: 16,
    color: '#78350f',
  },
  body: {
    marginTop: spacing.sm,
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 20,
    color: '#92400e',
  },
  meta: {
    marginTop: spacing.sm,
    fontFamily: fonts.sans,
    fontSize: 12,
    color: '#92400e',
  },
  linkBtn: {
    marginTop: spacing.md,
    minHeight: 44,
    justifyContent: 'center' as const,
  },
}
