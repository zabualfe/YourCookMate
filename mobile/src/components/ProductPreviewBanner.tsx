import { useEffect, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { colors, fonts, radii, spacing } from '@/constants/theme'

const DEMO_RECIPE = {
  title: 'Garlic Butter Pasta',
  ingredients: [
    { name: 'Pasta', quantity: '12 oz' },
    { name: 'Butter', quantity: '4 tbsp' },
    { name: 'Garlic', quantity: '4 cloves' },
    { name: 'Parsley', quantity: '2 tbsp' },
    { name: 'Parmesan', quantity: '¼ cup' },
    { name: 'Salt & pepper', quantity: 'to taste' },
  ],
  steps: [
    {
      instruction:
        'Bring a large pot of salted water to a boil. Add pasta and cook until al dente, about 9 minutes.',
      duration_minutes: 9,
      equipment: ['Large pot'],
      ingredients_used: ['Pasta', 'Salt & pepper'],
    },
    {
      instruction:
        'While pasta cooks, melt butter in a skillet over medium heat. Add minced garlic and sauté until fragrant, about 1 minute.',
      duration_minutes: 1,
      equipment: ['Skillet'],
      ingredients_used: ['Butter', 'Garlic'],
    },
    {
      instruction:
        'Drain pasta, reserving ½ cup pasta water. Toss pasta with garlic butter, adding pasta water as needed.',
      duration_minutes: null,
      equipment: ['Colander'],
      ingredients_used: ['Pasta', 'Butter'],
    },
    {
      instruction:
        'Season with salt, pepper, and parsley. Serve immediately with parmesan on top.',
      duration_minutes: null,
      equipment: [],
      ingredients_used: ['Parsley', 'Parmesan', 'Salt & pepper'],
    },
  ],
}

export function ProductPreviewBanner() {
  const [currentIndex, setCurrentIndex] = useState(0)
  const total = DEMO_RECIPE.steps.length
  const step = DEMO_RECIPE.steps[currentIndex]
  const highlightSet = new Set(step.ingredients_used.map((name) => name.toLowerCase()))
  const isLast = currentIndex === total - 1

  useEffect(() => {
    const id = setInterval(() => {
      setCurrentIndex((i) => (i + 1) % total)
    }, 4000)
    return () => clearInterval(id)
  }, [total])

  return (
    <View style={styles.wrap}>
      <View style={styles.glow} pointerEvents="none" />

      <View style={styles.cookCard}>
        <View style={styles.cookHeader}>
          <Text style={styles.recipeTitle} numberOfLines={1}>
            {DEMO_RECIPE.title}
          </Text>
        </View>

        <View style={styles.progressRow}>
          {DEMO_RECIPE.steps.map((_, i) => (
            <View
              key={i}
              style={[styles.progressSegment, i <= currentIndex && styles.progressSegmentActive]}
            />
          ))}
        </View>

        <View style={styles.stepBody}>
          <Text style={styles.stepLabel}>
            Step {currentIndex + 1} of {total}
          </Text>
          <Text style={styles.stepText}>{step.instruction}</Text>
          <View style={styles.chipRow}>
            {step.duration_minutes != null && (
              <View style={styles.timerChip}>
                <Text style={styles.timerText}>Start {step.duration_minutes} min timer</Text>
              </View>
            )}
            {step.equipment.map((item) => (
              <View key={item} style={styles.equipmentChip}>
                <Text style={styles.equipmentText}>{item}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.navRow}>
          <View style={styles.navGhost}>
            <Text style={styles.navGhostText}>Previous</Text>
          </View>
          <View style={styles.navPrimary}>
            <Text style={styles.navPrimaryText}>{isLast ? 'Done' : 'Next step'}</Text>
          </View>
        </View>
      </View>

      <View style={styles.ingCard}>
        <View style={styles.ingHeader}>
          <Text style={styles.ingHeaderText}>Ingredients</Text>
        </View>
        <View style={styles.ingList}>
          {DEMO_RECIPE.ingredients.map((ing) => {
            const active = highlightSet.has(ing.name.toLowerCase())
            return (
              <View key={ing.name} style={[styles.ingRow, active && styles.ingRowActive]}>
                <Text style={[styles.ingName, active && styles.ingNameActive]}>{ing.name}</Text>
                <Text style={styles.ingQty}>{ing.quantity}</Text>
              </View>
            )
          })}
        </View>
      </View>

      <Text style={styles.caption}>Live preview — one step at a time while you cook</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: spacing.xxl,
    position: 'relative',
  },
  glow: {
    position: 'absolute',
    top: -12,
    left: -8,
    right: -8,
    bottom: 24,
    borderRadius: 32,
    backgroundColor: colors.brand100,
    opacity: 0.55,
  },
  cookCard: {
    backgroundColor: colors.white,
    borderRadius: radii.xxl,
    borderWidth: 1,
    borderColor: 'rgba(231,229,228,0.8)',
    overflow: 'hidden',
    shadowColor: colors.stone900,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 6,
  },
  cookHeader: {
    borderBottomWidth: 1,
    borderBottomColor: colors.stone200,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  recipeTitle: {
    fontFamily: fonts.displaySemiBold,
    fontSize: 16,
    color: colors.stone900,
  },
  progressRow: {
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
  },
  progressSegment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.stone200,
  },
  progressSegmentActive: {
    backgroundColor: colors.brand600,
  },
  stepBody: {
    minHeight: 180,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
  stepLabel: {
    fontFamily: fonts.displaySemiBold,
    fontSize: 12,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.brand600,
    marginBottom: spacing.sm,
  },
  stepText: {
    fontFamily: fonts.displaySemiBold,
    fontSize: 18,
    lineHeight: 26,
    color: colors.stone900,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  timerChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(217,119,6,0.3)',
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  timerText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 12,
    color: colors.accent600,
  },
  equipmentChip: {
    borderRadius: 999,
    backgroundColor: colors.stone100,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  equipmentText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 12,
    color: colors.stone600,
  },
  navRow: {
    flexDirection: 'row',
    gap: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.stone200,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
  navGhost: {
    minHeight: 44,
    minWidth: 96,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.stone200,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  navGhostText: {
    fontFamily: fonts.displaySemiBold,
    fontSize: 14,
    color: colors.stone400,
  },
  navPrimary: {
    flex: 1,
    minHeight: 44,
    borderRadius: radii.md,
    backgroundColor: colors.brand600,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  navPrimaryText: {
    fontFamily: fonts.displaySemiBold,
    fontSize: 14,
    color: colors.white,
  },
  ingCard: {
    marginTop: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radii.xxl,
    borderWidth: 1,
    borderColor: 'rgba(231,229,228,0.8)',
    overflow: 'hidden',
    shadowColor: colors.stone900,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 4,
  },
  ingHeader: {
    borderBottomWidth: 1,
    borderBottomColor: colors.stone200,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  ingHeaderText: {
    fontFamily: fonts.displaySemiBold,
    fontSize: 12,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.stone500,
  },
  ingList: {
    padding: spacing.md,
    gap: 4,
  },
  ingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: spacing.md,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  ingRowActive: {
    backgroundColor: colors.brand50,
    borderWidth: 1,
    borderColor: colors.brand200,
  },
  ingName: {
    flex: 1,
    fontFamily: fonts.sansSemiBold,
    fontSize: 14,
    color: colors.stone800,
  },
  ingNameActive: {
    color: colors.brand800,
  },
  ingQty: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.stone500,
  },
  caption: {
    marginTop: spacing.lg,
    textAlign: 'center',
    fontFamily: fonts.sansSemiBold,
    fontSize: 14,
    color: colors.stone500,
  },
})
