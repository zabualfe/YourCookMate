import { Pressable } from 'react-native'
import { router } from 'expo-router'
import { BrandLogo } from '@/components/BrandLogo'
import { useAuth } from '@/context/AuthContext'

export function HeaderBrandLogo() {
  const { isAuthenticated } = useAuth()

  return (
    <Pressable
      onPress={() => router.push(isAuthenticated ? '/(tabs)' : '/')}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel="Your Cook Mate"
    >
      <BrandLogo size="sm" />
    </Pressable>
  )
}
