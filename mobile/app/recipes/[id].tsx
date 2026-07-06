import { Ionicons } from '@expo/vector-icons'
import { Stack, router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { getRecipe } from '@/api/client'
import { RecipeIconEditor } from '@/components/RecipeIconEditor'
import { StepMediaPreview } from '@/components/StepMediaPreview'
import { ShopInstacartButton } from '@/components/ShopInstacartButton'
import { colors, commonStyles, fonts, radii, spacing } from '@/constants/theme'

export default function RecipeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const [iconError, setIconError] = useState('')

  const { data, isLoading, error } = useQuery({
    queryKey: ['recipe', id],
    queryFn: () => getRecipe(id!),
    enabled: !!id,
  })

  if (!id || isLoading) {
    return (
      <View style={[commonStyles.screen, styles.center]}>
        <ActivityIndicator color={colors.brand} />
      </View>
    )
  }

  if (error || !data) {
    return (
      <View style={[commonStyles.screen, styles.center]}>
        <Text style={commonStyles.errorBannerText}>
          {error instanceof Error ? error.message : 'Not found'}
        </Text>
      </View>
    )
  }

  const recipe = data.recipe

  return (
    <>
      <Stack.Screen
        options={{
          title: data.title,
          headerBackTitle: 'Home',
          headerBackTitleVisible: false,
          headerRight: () => (
            <Pressable
              onPress={() => router.push(`/recipes/edit/${id}`)}
              hitSlop={8}
              accessibilityLabel="Edit recipe"
            >
              <Ionicons name="pencil" size={22} color={colors.brand600} />
            </Pressable>
          ),
        }}
      />
      <ScrollView style={commonStyles.screen} contentContainerStyle={commonStyles.screenContent}>
        <View style={styles.summary}>
          <View style={styles.heroRow}>
            <RecipeIconEditor
              recipeId={id}
              iconUrl={data.icon_url}
              size="lg"
              onErrorChange={setIconError}
            />
            <View style={styles.heroText}>
              <Text style={styles.title}>{data.title}</Text>
              {data.source_url ? (
                <Pressable
                  style={styles.sourceLink}
                  onPress={() => Linking.openURL(data.source_url!)}
                  accessibilityRole="link"
                >
                  <Ionicons name="link-outline" size={16} color={colors.brand600} />
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
            </View>
          </View>

          {iconError ? (
            <View style={commonStyles.errorBanner}>
              <Text style={commonStyles.errorBannerText}>{iconError}</Text>
            </View>
          ) : null}

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
        </View>

        <Pressable style={[commonStyles.primaryBtn, styles.startCookBtn]} onPress={() => router.push(`/cook/${id}`)}>
          <Text style={commonStyles.primaryBtnText}>Start cooking</Text>
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

        <Text style={[styles.section, { marginTop: spacing.xl }]}>Steps</Text>
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
  center: { alignItems: 'center', justifyContent: 'center' },
  summary: {
    gap: spacing.xl,
  },
  heroRow: {
    flexDirection: 'row',
    gap: spacing.lg,
    alignItems: 'flex-start',
  },
  heroText: { flex: 1, minWidth: 0 },
  title: {
    fontFamily: fonts.displayBold,
    fontSize: 24,
    color: colors.stone900,
  },
  sourceLink: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.sm },
  sourceLinkText: {
    color: colors.brand600,
    fontFamily: fonts.displaySemiBold,
    fontSize: 14,
  },
  meta: {
    marginTop: spacing.sm,
    fontFamily: fonts.sans,
    color: colors.stone500,
    fontSize: 14,
  },
  nutritionBlock: { gap: spacing.sm },
  startCookBtn: {
    marginTop: spacing.xxl,
  },
  calorieChip: {
    alignSelf: 'flex-start',
    backgroundColor: colors.accent50,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.accent100,
  },
  calorieText: {
    color: colors.accent700,
    fontFamily: fonts.displaySemiBold,
    fontSize: 13,
  },
  allergenRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  allergenChip: {
    backgroundColor: colors.red50,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  allergenText: {
    color: colors.red700,
    fontFamily: fonts.displaySemiBold,
    fontSize: 13,
  },
  noAllergens: {
    fontFamily: fonts.sans,
    color: colors.stone500,
    fontSize: 13,
  },
  shopBtn: { marginTop: spacing.lg, marginBottom: spacing.xxl },
  section: {
    fontFamily: fonts.displayBold,
    fontSize: 17,
    color: colors.stone900,
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.white,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.stone200,
  },
  ingName: { color: colors.stone800, flex: 1, fontFamily: fonts.sans },
  ingQty: { color: colors.stone500, fontFamily: fonts.sans },
  step: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.stone200,
  },
  stepBody: { flex: 1 },
  stepNum: {
    fontFamily: fonts.displayBold,
    color: colors.brand600,
    width: 24,
    fontSize: 16,
  },
  stepText: {
    color: colors.stone700,
    lineHeight: 22,
    fontFamily: fonts.sans,
  },
})
