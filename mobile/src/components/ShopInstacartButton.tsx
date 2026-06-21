import { useState } from 'react'
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { createInstacartLink, getFeatures } from '@/api/client'
import { colors } from '@/constants/theme'

interface ShopInstacartButtonProps {
  recipeId: string
}

export function ShopInstacartButton({ recipeId }: ShopInstacartButtonProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const { data: features } = useQuery({
    queryKey: ['features'],
    queryFn: getFeatures,
    staleTime: 60_000,
  })

  if (!features?.instacart_shopping) {
    return null
  }

  const handlePress = async () => {
    setError('')
    setLoading(true)
    try {
      const result = await createInstacartLink(recipeId)
      await Linking.openURL(result.url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open Instacart')
    } finally {
      setLoading(false)
    }
  }

  return (
    <View>
      <Pressable
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handlePress}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#15803d" />
        ) : (
          <>
            <Text style={styles.title}>Shop on Instacart</Text>
            <Text style={styles.subtitle}>Pick a store and add ingredients to cart</Text>
          </>
        )}
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  button: {
    borderWidth: 1,
    borderColor: '#86efac',
    backgroundColor: '#f0fdf4',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'flex-start',
  },
  buttonDisabled: { opacity: 0.6 },
  title: { fontWeight: '700', color: '#15803d', fontSize: 15 },
  subtitle: { marginTop: 2, color: '#166534', fontSize: 12, opacity: 0.85 },
  error: { marginTop: 8, color: colors.red700, fontSize: 13 },
})
