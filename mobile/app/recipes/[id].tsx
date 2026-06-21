import { Ionicons } from '@expo/vector-icons'
import { Stack, router, useLocalSearchParams } from 'expo-router'
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { getRecipe } from '@/api/client'
import { StepMediaPreview } from '@/components/StepMediaPreview'
import { ShopInstacartButton } from '@/components/ShopInstacartButton'
import { colors } from '@/constants/theme'

export default function RecipeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()

  const { data, isLoading, error } = useQuery({
    queryKey: ['recipe', id],
    queryFn: () => getRecipe(id!),
    enabled: !!id,
  })

  if (!id || isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.brand} />
      </View>
    )
  }

  if (error || !data) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error instanceof Error ? error.message : 'Not found'}</Text>
      </View>
    )
  }

  const recipe = data.recipe

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Recipe',
          headerBackTitle: 'Home',
          headerBackTitleVisible: false,
          headerRight: () => (
            <Pressable
              onPress={() => router.push(`/recipes/edit/${id}`)}
              hitSlop={8}
              accessibilityLabel="Edit recipe"
            >
              <Ionicons name="pencil" size={22} color={colors.brand} />
            </Pressable>
          ),
        }}
      />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.title}>{data.title}</Text>
        {data.source_url ? (
          <Pressable
            style={styles.sourceLink}
            onPress={() => Linking.openURL(data.source_url!)}
            accessibilityRole="link"
          >
            <Ionicons name="link-outline" size={16} color={colors.brand} />
            <Text style={styles.sourceLinkText}>Source</Text>
          </Pressable>
        ) : null}
        <Text style={styles.meta}>
          {recipe.steps.length} steps
          {recipe.servings ? ` · ${recipe.servings} servings` : ''}
          {recipe.calories_per_serving != null
            ? ` · ~${recipe.calories_per_serving} cal/serving`
            : ''}
        </Text>

        {(recipe.calories_per_serving != null || (recipe.allergens?.length ?? 0) > 0) && (
          <View style={styles.nutritionBlock}>
            {recipe.calories_per_serving != null && (
              <View style={styles.calorieChip}>
                <Text style={styles.calorieText}>
                  ~{recipe.calories_per_serving} cal / serving (est.)
                </Text>
              </View>
            )}
            {(recipe.allergens?.length ?? 0) > 0 ? (
              <View style={styles.allergenRow}>
                {recipe.allergens!.map((allergen) => (
                  <View key={allergen} style={styles.allergenChip}>
                    <Text style={styles.allergenText}>
                      {allergen.charAt(0).toUpperCase() + allergen.slice(1)}
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              recipe.calories_per_serving != null && (
                <Text style={styles.noAllergens}>No common allergens detected</Text>
              )
            )}
          </View>
        )}

        <Pressable style={styles.cookBtn} onPress={() => router.push(`/cook/${id}`)}>
          <Text style={styles.cookBtnText}>Start cooking</Text>
        </Pressable>

        <View style={styles.shopBtn}>
          <ShopInstacartButton recipeId={id} />
        </View>

        <Text style={styles.section}>Ingredients</Text>
        {recipe.ingredients.map((ing, i) => (
          <View key={`${ing.name}-${i}`} style={styles.row}>
            <Text style={styles.ingName}>{ing.name}</Text>
            {ing.quantity ? <Text style={styles.ingQty}>{ing.quantity}</Text> : null}
          </View>
        ))}

        <Text style={[styles.section, { marginTop: 20 }]}>Steps</Text>
        {recipe.steps.map((step, i) => (
          <View key={step.order} style={styles.step}>
            <Text style={styles.stepNum}>{i + 1}</Text>
            <View style={styles.stepBody}>
              {(step.clip_url || step.image_url) && (
                <StepMediaPreview clipUrl={step.clip_url} imageUrl={step.image_url} variant="inline" />
              )}
              <Text style={styles.stepText}>{step.instruction}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.stone50 },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 28, fontWeight: '800', color: colors.stone900 },
  sourceLink: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  sourceLinkText: { color: colors.brand, fontWeight: '600', fontSize: 14 },
  meta: { marginTop: 6, color: colors.stone500 },
  nutritionBlock: { marginTop: 12, gap: 8 },
  calorieChip: {
    alignSelf: 'flex-start',
    backgroundColor: '#fffbeb',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  calorieText: { color: '#92400e', fontWeight: '600', fontSize: 13 },
  allergenRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  allergenChip: {
    backgroundColor: colors.red50,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  allergenText: { color: colors.red700, fontWeight: '600', fontSize: 13 },
  noAllergens: { color: colors.stone500, fontSize: 13 },
  cookBtn: {
    marginTop: 20,
    marginBottom: 24,
    backgroundColor: colors.brand,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  cookBtnText: { color: colors.white, fontWeight: '700', fontSize: 16 },
  shopBtn: { marginBottom: 24 },
  section: { fontSize: 17, fontWeight: '700', color: colors.stone900, marginBottom: 10 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.stone200,
  },
  ingName: { color: colors.stone800, flex: 1 },
  ingQty: { color: colors.stone500 },
  step: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.stone200,
  },
  stepBody: { flex: 1 },
  stepNum: { fontWeight: '800', color: colors.brand, width: 24 },
  stepText: { color: colors.stone700, lineHeight: 22 },
  error: { color: colors.red700 },
})
