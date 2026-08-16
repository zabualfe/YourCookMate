import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/context/AuthContext'
import { deleteRecipe, listRecipes } from '@/api/client'
import { HomeHero } from '@/components/HomeHero'
import { RecipeIcon } from '@/components/RecipeIcon'
import { VisibilityTimer } from '@/components/VisibilityTimer'
import { colors, commonStyles, fonts, radii, spacing } from '@/constants/theme'

export function RecipeList() {
  const { isAuthenticated, loading: authLoading } = useAuth()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => clearTimeout(id)
  }, [search])

  const { data, isLoading, error } = useQuery({
    queryKey: ['recipes', debouncedSearch],
    queryFn: () => listRecipes(debouncedSearch || undefined),
    enabled: isAuthenticated,
  })

  const removeMutation = useMutation({
    mutationFn: deleteRecipe,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['recipes'] }),
  })

  const confirmDelete = (id: string) => {
    Alert.alert('Delete recipe?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => removeMutation.mutate(id) },
    ])
  }

  if (authLoading) {
    return (
      <View style={[commonStyles.screen, styles.center]}>
        <ActivityIndicator color={colors.brand} />
      </View>
    )
  }

  if (!isAuthenticated) {
    return (
      <ScrollView
        style={commonStyles.screen}
        contentContainerStyle={styles.guestContent}
        showsVerticalScrollIndicator={false}
      >
        <HomeHero
          isAuthenticated={false}
          onPrimaryPress={() => router.push('/register')}
          onSecondaryPress={() => router.push('/login')}
        />
      </ScrollView>
    )
  }

  return (
    <ScrollView style={commonStyles.screen} contentContainerStyle={styles.authedContent}>
      <HomeHero
        isAuthenticated
        onPrimaryPress={() => router.push('/(tabs)/new')}
        onSecondaryPress={() => router.push('/login')}
      />

      <View style={styles.headerRow}>
        <View style={styles.headerText}>
          <Text style={commonStyles.pageTitle}>My recipes</Text>
          <Text style={commonStyles.pageSubtitle}>{data?.total ?? 0} saved</Text>
        </View>
        <Pressable
          onPress={() => router.push('/(tabs)/new')}
          style={styles.addBtn}
          accessibilityLabel="Add recipe"
        >
          <Ionicons name="add" size={18} color={colors.white} />
          <Text style={styles.addBtnText}>Add</Text>
        </Pressable>
      </View>

      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="Search recipes…"
        placeholderTextColor={colors.stone400}
        style={[commonStyles.input, { marginTop: spacing.xxl }]}
        clearButtonMode="while-editing"
      />

      {isLoading && <Text style={styles.loadingText}>Loading recipes…</Text>}
      {error && (
        <View style={[commonStyles.errorBanner, { marginTop: spacing.xxl }]}>
          <Text style={commonStyles.errorBannerText}>
            {error instanceof Error ? error.message : 'Failed to load'}
          </Text>
        </View>
      )}

      {data && data.items.length === 0 && (
        <View style={commonStyles.emptyState}>
          <Text style={commonStyles.emptyStateText}>No recipes yet.</Text>
          <Pressable onPress={() => router.push('/(tabs)/new')}>
            <Text style={commonStyles.linkText}>Paste your first recipe →</Text>
          </Pressable>
        </View>
      )}

      {data?.items.map((item) => (
        <View key={item.id} style={styles.recipeCard}>
          <RecipeIcon iconUrl={item.icon_url} size="sm" />
          <Pressable style={styles.recipeBody} onPress={() => router.push(`/recipes/${item.id}`)}>
            <Text style={styles.recipeTitle} numberOfLines={2}>
              {item.title}
            </Text>
            <Text style={styles.recipeMeta}>
              {item.locked
                ? 'Locked after 14 days — upgrade to view'
                : `${item.step_count} steps · ${new Date(item.created_at).toLocaleDateString()}`}
            </Text>
            <VisibilityTimer locked={item.locked} visibleUntil={item.visible_until} />
          </Pressable>
          <View style={styles.recipeActions}>
            <Pressable
              onPress={() => router.push(item.locked ? `/recipes/${item.id}` : `/cook/${item.id}`)}
              style={item.locked ? styles.unlockBtn : styles.cookBtn}
              accessibilityLabel={item.locked ? `Unlock ${item.title}` : `Cook ${item.title}`}
            >
              <Text style={item.locked ? styles.unlockBtnText : styles.cookBtnText}>
                {item.locked ? 'Unlock' : 'Cook'}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => confirmDelete(item.id)}
              style={styles.deleteBtn}
              accessibilityLabel={`Delete ${item.title}`}
            >
              <Text style={styles.deleteBtnText}>Delete</Text>
            </Pressable>
          </View>
        </View>
      ))}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
  },
  guestContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.section,
  },
  authedContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: 40,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.lg,
    marginTop: spacing.xxl,
  },
  headerText: { flex: 1 },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.brand700,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
  },
  addBtnText: {
    fontFamily: fonts.displaySemiBold,
    fontSize: 14,
    color: colors.white,
  },
  loadingText: {
    marginTop: spacing.xxl,
    fontFamily: fonts.sans,
    color: colors.stone500,
  },
  recipeCard: {
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radii.xxl,
    borderWidth: 1,
    borderColor: colors.stone200,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  recipeBody: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
    paddingVertical: spacing.xs,
  },
  recipeTitle: {
    fontFamily: fonts.displaySemiBold,
    fontSize: 16,
    lineHeight: 22,
    color: colors.stone900,
  },
  recipeMeta: {
    marginTop: spacing.xs,
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.stone500,
  },
  recipeActions: {
    alignSelf: 'stretch',
    justifyContent: 'center',
    gap: spacing.sm,
    minWidth: 76,
    paddingVertical: spacing.xs,
  },
  cookBtn: {
    minHeight: 36,
    borderRadius: radii.sm,
    backgroundColor: colors.brand50,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cookBtnText: {
    fontFamily: fonts.displaySemiBold,
    fontSize: 14,
    color: colors.brand700,
  },
  unlockBtn: {
    minHeight: 36,
    borderRadius: radii.sm,
    backgroundColor: colors.accent50,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unlockBtnText: {
    fontFamily: fonts.displaySemiBold,
    fontSize: 14,
    color: colors.accent700,
  },
  deleteBtn: {
    minHeight: 36,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: colors.red50,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtnText: {
    fontFamily: fonts.displaySemiBold,
    fontSize: 14,
    color: colors.red700,
  },
})
