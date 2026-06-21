import { Link } from 'expo-router'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useAuth } from '@/context/AuthContext'
import { InstacartConnectCard } from '@/components/InstacartConnectCard'
import { colors } from '@/constants/theme'

export default function ProfileScreen() {
  const { user, loading, isAuthenticated, logout } = useAuth()

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.brand} />
      </View>
    )
  }

  if (!isAuthenticated || !user) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>Sign in to view your profile</Text>
        <Link href="/login" asChild>
          <Pressable style={styles.primaryBtn}>
            <Text style={styles.primaryBtnText}>Sign in</Text>
          </Pressable>
        </Link>
      </View>
    )
  }

  const initials = (user.display_name ?? user.email).slice(0, 2).toUpperCase()

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Profile</Text>

      <View style={styles.userCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <View style={styles.userInfo}>
          <Text style={styles.displayName} numberOfLines={1}>
            {user.display_name ?? user.email.split('@')[0]}
          </Text>
          <Text style={styles.email} numberOfLines={1}>
            {user.email}
          </Text>
          <Text style={user.email_verified ? styles.verified : styles.unverified}>
            {user.email_verified ? 'Email verified' : 'Email not verified'}
          </Text>
        </View>
      </View>

      <InstacartConnectCard />

      <Pressable onPress={() => logout()} style={styles.logoutBtn}>
        <Text style={styles.logoutText}>Sign out</Text>
      </Pressable>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: colors.white,
  },
  heading: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.stone900,
  },
  emptyTitle: {
    fontSize: 16,
    color: colors.stone600,
    marginBottom: 16,
  },
  primaryBtn: {
    borderRadius: 12,
    backgroundColor: colors.brand,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  primaryBtnText: {
    color: colors.white,
    fontWeight: '600',
  },
  userCard: {
    marginTop: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.stone200,
    padding: 20,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.stone100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.brandDark,
  },
  userInfo: {
    flex: 1,
    minWidth: 0,
  },
  displayName: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.stone900,
  },
  email: {
    marginTop: 2,
    fontSize: 14,
    color: colors.stone500,
  },
  verified: {
    marginTop: 4,
    fontSize: 12,
    color: '#15803d',
  },
  unverified: {
    marginTop: 4,
    fontSize: 12,
    color: colors.stone500,
  },
  logoutBtn: {
    marginTop: 32,
    alignSelf: 'flex-start',
  },
  logoutText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.stone600,
    textDecorationLine: 'underline',
  },
})
