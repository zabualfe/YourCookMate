import { router } from 'expo-router'
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/context/AuthContext'
import { InstacartConnectCard } from '@/components/InstacartConnectCard'
import { ProBillingActions } from '@/components/ProBillingActions'
import { UpgradePaywall } from '@/components/UpgradePaywall'
import { getBillingPlans } from '@/api/client'
import { uploadsLeftLabel, videoLimitLabel } from '@/types/billing'
import { colors, commonStyles, fonts, radii, spacing } from '@/constants/theme'

export default function ProfileScreen() {
  const { user, loading, isAuthenticated, logout } = useAuth()
  const { data: billing } = useQuery({
    queryKey: ['billing-plans'],
    queryFn: getBillingPlans,
    enabled: isAuthenticated,
  })

  if (loading) {
    return (
      <View style={[commonStyles.screen, styles.center]}>
        <ActivityIndicator color={colors.brand} />
      </View>
    )
  }

  if (!isAuthenticated || !user) {
    return (
      <View style={[commonStyles.screen, styles.center]}>
        <Text style={styles.brand}>Your Cook Mate</Text>
        <Text style={styles.emptyTitle}>Sign in to view your profile</Text>
        <Pressable onPress={() => router.push('/register')} style={styles.signInBtn}>
          <Text style={commonStyles.primaryBtnText}>Create account</Text>
        </Pressable>
        <Pressable onPress={() => router.push('/login')} style={styles.secondaryBtn}>
          <Text style={commonStyles.secondaryBtnText}>Sign in</Text>
        </Pressable>
      </View>
    )
  }

  const initials = (user.display_name ?? user.email).slice(0, 2).toUpperCase()
  const usage = billing?.usage
  const isPro = billing?.is_pro ?? user.is_pro

  return (
    <ScrollView style={commonStyles.screen} contentContainerStyle={commonStyles.screenContent}>
      <View style={styles.userCard}>
        {user.avatar_url ? (
          <Image source={{ uri: user.avatar_url }} style={styles.avatarImage} />
        ) : (
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
        )}
        <View style={styles.userInfo}>
          <Text style={styles.displayName} numberOfLines={1}>
            {user.display_name ?? user.email.split('@')[0]}
          </Text>
          {user.username ? (
            <Text style={styles.email} numberOfLines={1}>
              @{user.username}
            </Text>
          ) : null}
          <Text style={styles.email} numberOfLines={1}>
            {user.email}
          </Text>
          <Text style={user.email_verified ? styles.verified : styles.unverified}>
            {isPro ? (billing?.cancel_at_period_end ? 'Pro · canceling' : 'Pro') : 'Free plan'}
            {' · '}
            {user.email_verified ? 'Email verified' : 'Email not verified'}
          </Text>
        </View>
      </View>

      <View style={styles.planCard}>
        <Text style={styles.planTitle}>Plan</Text>
        {usage ? (
          <Text style={styles.planMeta}>
            {uploadsLeftLabel(usage)} · videos up to {videoLimitLabel(usage.max_video_seconds)}
            {usage.visibility_days
              ? ` · ${usage.visibility_days}-day viewing window`
              : ' · recipes stay in your library'}
          </Text>
        ) : null}
        {isPro && billing ? (
          <ProBillingActions billing={billing} />
        ) : (
          <View style={{ marginTop: spacing.lg }}>
            <UpgradePaywall reason="upgrade" usage={usage} />
          </View>
        )}
      </View>

      <InstacartConnectCard />

      <Pressable onPress={() => logout()} style={styles.logoutBtn}>
        <Text style={styles.logoutText}>Sign out</Text>
      </Pressable>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
    gap: spacing.md,
  },
  brand: {
    fontFamily: fonts.displaySemiBold,
    fontSize: 22,
    color: colors.brand700,
  },
  emptyTitle: {
    fontFamily: fonts.sans,
    fontSize: 16,
    color: colors.stone600,
    textAlign: 'center',
  },
  signInBtn: {
    marginTop: spacing.lg,
    minWidth: 220,
    minHeight: 48,
    backgroundColor: colors.brand700,
    borderRadius: radii.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtn: {
    minWidth: 220,
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.stone200,
    borderRadius: radii.lg,
    backgroundColor: colors.white,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    borderRadius: radii.xxl,
    borderWidth: 1,
    borderColor: colors.stone200,
    backgroundColor: colors.white,
    padding: spacing.xl,
  },
  planCard: {
    marginTop: spacing.lg,
    borderRadius: radii.xxl,
    borderWidth: 1,
    borderColor: colors.stone200,
    backgroundColor: colors.white,
    padding: spacing.xl,
  },
  planTitle: {
    fontFamily: fonts.displaySemiBold,
    fontSize: 16,
    color: colors.stone900,
  },
  planMeta: {
    marginTop: spacing.sm,
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 20,
    color: colors.stone600,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.brand50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  avatarText: {
    fontFamily: fonts.displayBold,
    fontSize: 18,
    color: colors.brand700,
  },
  userInfo: {
    flex: 1,
    minWidth: 0,
  },
  displayName: {
    fontFamily: fonts.displaySemiBold,
    fontSize: 18,
    color: colors.stone900,
  },
  email: {
    marginTop: 2,
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.stone500,
  },
  verified: {
    marginTop: 4,
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.green700,
  },
  unverified: {
    marginTop: 4,
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.stone500,
  },
  logoutBtn: {
    marginTop: spacing.section,
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
  },
  logoutText: {
    fontFamily: fonts.displaySemiBold,
    fontSize: 14,
    color: colors.stone600,
    textDecorationLine: 'underline',
  },
})
