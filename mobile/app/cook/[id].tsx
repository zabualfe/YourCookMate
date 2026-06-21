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
import { useQuery } from '@tanstack/react-query'
import * as Haptics from 'expo-haptics'
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake'
import { getRecipe } from '@/api/client'
import { StepMediaPreview } from '@/components/StepMediaPreview'
import { colors } from '@/constants/theme'

export default function CookScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
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
      <View style={styles.center}>
        <ActivityIndicator color={colors.brand} />
      </View>
    )
  }

  if (error || !data) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error instanceof Error ? error.message : 'Recipe not found'}</Text>
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
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.exit}>Exit</Text>
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {recipe.title}
        </Text>
        <Pressable onPress={() => setShowIngredients((v) => !v)}>
          <Text style={styles.ingredientsBtn}>{showIngredients ? 'Hide' : 'Ingredients'}</Text>
        </Pressable>
      </View>

      <View style={styles.progressRow}>
        {recipe.steps.map((_, i) => (
          <View key={i} style={[styles.progressDot, i <= index && styles.progressDotActive]} />
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
            <Text style={styles.timer}>About {step.duration_minutes} min</Text>
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

      <View style={styles.nav}>
        <Pressable
          onPress={goPrev}
          disabled={isFirst}
          style={[styles.navBtn, isFirst && styles.navBtnDisabled]}
        >
          <Text style={styles.navBtnText}>Previous</Text>
        </Pressable>
        <Pressable onPress={goNext} style={styles.navBtnPrimary}>
          <Text style={styles.navBtnPrimaryText}>{isLast ? 'Done' : 'Next step'}</Text>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.stone50 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 12,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.stone200,
  },
  exit: { color: colors.stone500, fontWeight: '600' },
  headerTitle: { flex: 1, textAlign: 'center', fontWeight: '700', color: colors.stone900, marginHorizontal: 8 },
  ingredientsBtn: { color: colors.brand, fontWeight: '600' },
  progressRow: { flexDirection: 'row', gap: 4, paddingHorizontal: 16, paddingTop: 16 },
  progressDot: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.stone200 },
  progressDotActive: { backgroundColor: colors.brand },
  stepLabel: { paddingHorizontal: 16, paddingTop: 12, color: colors.stone500, fontWeight: '600' },
  stepCard: {
    margin: 16,
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.stone200,
    overflow: 'hidden',
  },
  stepText: {
    fontSize: 22,
    lineHeight: 32,
    color: colors.stone800,
    fontWeight: '500',
    padding: 24,
    paddingTop: 16,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 24,
    paddingBottom: 16,
    alignItems: 'center',
  },
  timer: { color: colors.brand, fontWeight: '600' },
  equipmentChip: {
    backgroundColor: colors.stone100,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  equipmentText: { color: colors.stone600, fontWeight: '600', fontSize: 12 },
  ingDrawer: {
    maxHeight: 160,
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.stone200,
    padding: 12,
  },
  ingRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  ingName: { color: colors.stone800 },
  ingQty: { color: colors.stone500 },
  nav: { flexDirection: 'row', gap: 12, padding: 16, paddingBottom: 32 },
  navBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.stone200,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: colors.white,
  },
  navBtnText: { fontWeight: '700', color: colors.stone700 },
  navBtnPrimary: {
    flex: 1,
    backgroundColor: colors.brand,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  navBtnPrimaryText: { fontWeight: '700', color: colors.white },
  navBtnDisabled: { opacity: 0.4 },
  error: { color: colors.red700 },
})
