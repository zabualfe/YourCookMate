import { Link, router } from 'expo-router'
import { useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/context/AuthContext'
import { listRecipes } from '@/api/client'
import { colors } from '@/constants/theme'

export function RecipeList() {
  const { isAuthenticated, loading: authLoading } = useAuth()
  const [search, setSearch] = useState('')

  const { data, isLoading, error } = useQuery({
    queryKey: ['recipes', search],
    queryFn: () => listRecipes(search || undefined),
    enabled: isAuthenticated,
  })

  if (authLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.brand} />
      </View>
    )
  }

  if (!isAuthenticated) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>Sign in to see your recipes</Text>
        <Link href="/login" asChild>
          <Pressable style={styles.primaryBtn}>
            <Text style={styles.primaryBtnText}>Sign in to get started</Text>
          </Pressable>
        </Link>
        <Link href="/register" asChild>
          <Pressable style={styles.secondaryBtn}>
            <Text style={styles.secondaryBtnText}>Create an account</Text>
          </Pressable>
        </Link>
      </View>
    )
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="Search recipes…"
        placeholderTextColor={colors.stone500}
        style={styles.search}
      />

      {isLoading && <ActivityIndicator color={colors.brand} style={{ marginTop: 24 }} />}
      {error && (
        <Text style={styles.error}>{error instanceof Error ? error.message : 'Failed to load'}</Text>
      )}

      {data?.items.map((item) => (
        <Pressable
          key={item.id}
          style={styles.recipeRow}
          onPress={() => router.push(`/recipes/${item.id}`)}
        >
          <Text style={styles.recipeTitle}>{item.title}</Text>
          <Text style={styles.recipeMeta}>
            {item.step_count} steps · {new Date(item.created_at).toLocaleDateString()}
          </Text>
        </Pressable>
      ))}

      {data && data.items.length === 0 && (
        <Text style={styles.empty}>No recipes yet. Add one from the Add tab.</Text>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.stone50 },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  search: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.stone200,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
  recipeRow: {
    marginTop: 12,
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.stone200,
    padding: 16,
  },
  recipeTitle: { fontSize: 16, fontWeight: '600', color: colors.stone900 },
  recipeMeta: { marginTop: 4, fontSize: 14, color: colors.stone500 },
  empty: { marginTop: 24, textAlign: 'center', color: colors.stone500 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: colors.stone900, marginBottom: 4 },
  error: { marginTop: 16, color: colors.red700, backgroundColor: colors.red50, padding: 12, borderRadius: 12 },
  primaryBtn: {
    backgroundColor: colors.brand,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 24,
    marginTop: 8,
  },
  primaryBtnText: { color: colors.white, fontWeight: '700' },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: colors.stone200,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 24,
    backgroundColor: colors.white,
  },
  secondaryBtnText: { color: colors.stone700, fontWeight: '600' },
})
