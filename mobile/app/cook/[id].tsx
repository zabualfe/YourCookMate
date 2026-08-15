import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import * as Haptics from 'expo-haptics'
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake'
import { getRecipe } from '@/api/client'
import { StepMediaPreview } from '@/components/StepMediaPreview'
import { colors, commonStyles, fonts, radii, spacing } from '@/constants/theme'

export default function CookScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const insets = useSafeAreaInsets()
  const [index, setIndex] = useState(0)
  const [showIngredients, setShowIngredients] = useState(false)

  const { data, isLoading, error } = useQuery({
    queryKey: ['recipe', id],
    queryFn: () => getRecipe(id!),
    enabled: !!id,
  })

  useEffect(() => {
    activateKeepAwakeAsync('cook-mode')
    return () => {
      deactivateKeepAwake('cook-mode')
    }
  }, [])

  if (!id || isLoading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color={colors.brand} />
      </View>
    )
  }

  if (error || !data) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={commonStyles.errorBannerText}>
          {error instanceof Error ? error.message : 'Recipe not found'}
        </Text>
      </View>
    )
  }

  const recipe = data.recipe
  const step = recipe.steps[index]
  const isFirst = index === 0
  const isLast = index === recipe.steps.length - 1

  const goNext = () => {
    if (isLast) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      router.back()
      return
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setIndex((i) => i + 1)
  }

  const goPrev = () => {
    if (!isFirst) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      setIndex((i) => i - 1)
    }
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.headerBtn}>
          <Text style={styles.exit}>Exit</Text>
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {recipe.title}
        </Text>
        <Pressable onPress={() => setShowIngredients((v) => !v)} hitSlop={8} style={styles.headerBtn}>
          <Text style={styles.ingredientsBtn}>{showIngredients ? 'Hide' : 'Ingredients'}</Text>
        </Pressable>
      </View>

      <View style={styles.progressRow}>
        {recipe.steps.map((_, i) => (
          <View key={i} style={[styles.progressSegment, i <= index && styles.progressSegmentActive]} />
        ))}
      </View>

      <Text style={styles.stepLabel}>
        Step {index + 1} of {recipe.steps.length}
      </Text>

      <View style={styles.stepCard}>
        <StepMediaPreview
          key={`${step.order}-${step.clip_url ?? step.image_url ?? 'none'}`}
          clipUrl={step.clip_url}
          imageUrl={step.image_url}
          variant="cook"
          playClip
        />
        <Text style={styles.stepText}>{step.instruction}</Text>
        <View style={styles.metaRow}>
          {step.duration_minutes ? (
            <View style={styles.timerChip}>
              <Text style={styles.timerText}>About {step.duration_minutes} min</Text>
            </View>
          ) : null}
          {step.equipment.map((item) => (
            <View key={item} style={styles.equipmentChip}>
              <Text style={styles.equipmentText}>{item}</Text>
            </View>
          ))}
        </View>
      </View>

      {showIngredients && (
        <ScrollView style={styles.ingDrawer}>
          {recipe.ingredients.map((ing, i) => (
            <View key={`${ing.name}-${i}`} style={styles.ingRow}>
              <Text style={styles.ingName}>{ing.name}</Text>
              {ing.quantity ? <Text style={styles.ingQty}>{ing.quantity}</Text> : null}
            </View>
          ))}
        </ScrollView>
      )}

      <View style={[styles.nav, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
        <Pressable
          onPress={goPrev}
          disabled={isFirst}
          style={[commonStyles.secondaryBtn, styles.navBtn, isFirst && { opacity: 0.4 }]}
        >
          <Text style={commonStyles.secondaryBtnText}>Previous</Text>
        </Pressable>
        <Pressable onPress={goNext} style={[commonStyles.primaryBtn, styles.navBtn]}>
          <Text style={commonStyles.primaryBtnText}>{isLast ? 'Done' : 'Next step'}</Text>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  center: { alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.stone200,
  },
  headerBtn: { minWidth: 72, minHeight: 44, justifyContent: 'center' },
  exit: {
    fontFamily: fonts.displaySemiBold,
    color: colors.stone500,
    fontSize: 15,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontFamily: fonts.displayBold,
    color: colors.stone900,
    marginHorizontal: spacing.sm,
    fontSize: 16,
  },
  ingredientsBtn: {
    textAlign: 'right',
    fontFamily: fonts.displaySemiBold,
    color: colors.brand700,
    fontSize: 15,
  },
  progressRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  progressSegment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.stone200,
  },
  progressSegmentActive: { backgroundColor: colors.brand700 },
  stepLabel: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    fontFamily: fonts.displaySemiBold,
    color: colors.stone500,
    fontSize: 14,
  },
  stepCard: {
    margin: spacing.lg,
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: radii.xxl,
    borderWidth: 1,
    borderColor: colors.stone200,
    overflow: 'hidden',
  },
  stepText: {
    fontSize: 22,
    lineHeight: 32,
    fontFamily: fonts.displaySemiBold,
    color: colors.stone800,
    padding: spacing.xxl,
    paddingTop: spacing.lg,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.lg,
    alignItems: 'center',
  },
  timerChip: {
    backgroundColor: colors.accent50,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  timerText: {
    color: colors.accent700,
    fontFamily: fonts.displaySemiBold,
    fontSize: 13,
  },
  equipmentChip: {
    backgroundColor: colors.stone100,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  equipmentText: {
    color: colors.stone600,
    fontFamily: fonts.displaySemiBold,
    fontSize: 12,
  },
  ingDrawer: {
    maxHeight: 160,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.stone200,
    padding: spacing.md,
  },
  ingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  ingName: { color: colors.stone800, fontFamily: fonts.sans },
  ingQty: { color: colors.stone500, fontFamily: fonts.sans },
  nav: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  navBtn: { flex: 1 },
})
