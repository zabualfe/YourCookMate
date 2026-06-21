import { Stack, router, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { NestableScrollContainer } from 'react-native-draggable-flatlist'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getRecipe, updateRecipe } from '@/api/client'
import { RecipeEditor } from '@/components/RecipeEditor'
import { cloneRecipe, normalizeRecipe } from '@/lib/recipeEdit'
import type { ParsedRecipe } from '@/types/recipe'
import { colors } from '@/constants/theme'

export default function EditRecipeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState<ParsedRecipe | null>(null)
  const [error, setError] = useState('')

  const { data, isLoading, error: loadError } = useQuery({
    queryKey: ['recipe', id],
    queryFn: () => getRecipe(id!),
    enabled: !!id,
  })

  useEffect(() => {
    if (data && !draft) {
      setDraft(cloneRecipe(data.recipe))
    }
  }, [data, draft])

  const saveMutation = useMutation({
    mutationFn: (recipe: ParsedRecipe) => updateRecipe(id!, recipe),
    onSuccess: (updated) => {
      queryClient.setQueryData(['recipe', id], updated)
      queryClient.invalidateQueries({ queryKey: ['recipes'] })
      router.back()
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Failed to save')
    },
  })

  const handleSave = () => {
    if (!draft) return
    const normalized = normalizeRecipe(draft)
    if (normalized.steps.length === 0) {
      setError('Add at least one step before saving.')
      return
    }
    setError('')
    saveMutation.mutate(normalized)
  }

  if (!id || isLoading || !draft) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.brand} />
      </View>
    )
  }

  if (loadError || !data) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>
          {loadError instanceof Error ? loadError.message : 'Recipe not found'}
        </Text>
      </View>
    )
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Edit recipe',
          headerBackTitle: 'Recipe',
          headerBackTitleVisible: false,
          headerRight: () => (
            <Pressable onPress={handleSave} disabled={saveMutation.isPending} hitSlop={8}>
              {saveMutation.isPending ? (
                <ActivityIndicator color={colors.brand} size="small" />
              ) : (
                <Text style={styles.saveBtn}>Save</Text>
              )}
            </Pressable>
          ),
        }}
      />
      <NestableScrollContainer
        style={styles.container}
        contentContainerStyle={styles.content}
        clipToPadding={false}
        removeClippedSubviews={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.label}>Title</Text>
        <TextInput
          value={draft.title}
          onChangeText={(title) => setDraft({ ...draft, title })}
          style={styles.titleInput}
          placeholder="Recipe title"
          placeholderTextColor={colors.stone500}
        />

        <RecipeEditor draft={draft} onChange={setDraft} />

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </NestableScrollContainer>
    </>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.stone50 },
  content: { padding: 16, paddingBottom: 80, gap: 16, overflow: 'visible' as const },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  label: { fontWeight: '600', color: colors.stone700, marginBottom: -8 },
  titleInput: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.stone200,
    borderRadius: 14,
    padding: 14,
    fontSize: 18,
    fontWeight: '600',
    color: colors.stone900,
  },
  saveBtn: { color: colors.brand, fontWeight: '700', fontSize: 16 },
  error: { color: colors.red700, backgroundColor: colors.red50, padding: 12, borderRadius: 12 },
})
