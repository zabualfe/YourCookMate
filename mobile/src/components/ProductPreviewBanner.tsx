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
  const [currentIndex, setCurrentIndex] = useState(1)
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
      <View style={styles.card}>
        <View style={styles.cookPane}>
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
            <View style={styles.metaRow}>
              {step.duration_minutes != null && (
                <Text style={styles.metaText}>{step.duration_minutes} min timer</Text>
              )}
              {step.equipment.map((item) => (
                <Text key={item} style={styles.metaText}>
                  {item}
                </Text>
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

        <View style={styles.ingPane}>
          <View style={styles.ingHeader}>
            <Text style={styles.ingHeaderText}>Ingredients</Text>
          </View>
          <View style={styles.ingList}>
            {DEMO_RECIPE.ingredients.map((ing) => {
              const active = highlightSet.has(ing.name.toLowerCase())
              return (
                <View key={ing.name} style={[styles.ingRow, active && styles.ingRowActive]}>
                  <Text style={[styles.ingName, active && styles.ingNameActive]} numberOfLines={1}>
                    {ing.name}
                  </Text>
                  <Text style={styles.ingQty}>{ing.quantity}</Text>
                </View>
              )
            })}
          </View>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: spacing.xxl,
  },
  card: {
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: 'rgba(214,211,209,0.9)',
    backgroundColor: 'rgba(231,229,228,0.55)',
    overflow: 'hidden',
    shadowColor: colors.stone900,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 6,
  },
  cookPane: {
    backgroundColor: colors.white,
  },
  cookHeader: {
    minHeight: 48,
    justifyContent: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.stone200,
    paddingHorizontal: spacing.lg,
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
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  progressSegment: {
    flex: 1,
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.stone200,
  },
  progressSegmentActive: {
    backgroundColor: colors.brand700,
  },
  stepBody: {
    minHeight: 148,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  stepLabel: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 13,
    color: colors.brand700,
    marginBottom: spacing.sm,
  },
  stepText: {
    fontFamily: fonts.displaySemiBold,
    fontSize: 17,
    lineHeight: 24,
    color: colors.stone900,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.lg,
    marginTop: spacing.lg,
  },
  metaText: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.stone500,
  },
  navRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.stone200,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  navGhost: {
    minHeight: 44,
    minWidth: 96,
    borderRadius: radii.lg,
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
    borderRadius: radii.lg,
    backgroundColor: colors.brand700,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  navPrimaryText: {
    fontFamily: fonts.displaySemiBold,
    fontSize: 14,
    color: colors.white,
  },
  ingPane: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.stone200,
    backgroundColor: colors.white,
  },
  ingHeader: {
    minHeight: 48,
    justifyContent: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.stone200,
    paddingHorizontal: spacing.lg,
  },
  ingHeaderText: {
    fontFamily: fonts.displaySemiBold,
    fontSize: 15,
    color: colors.stone500,
  },
  ingList: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  ingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: spacing.md,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
  ingRowActive: {
    backgroundColor: colors.brand50,
  },
  ingName: {
    flex: 1,
    fontFamily: fonts.sansSemiBold,
    fontSize: 14,
    color: colors.stone800,
  },
  ingNameActive: {
    fontFamily: fonts.displaySemiBold,
    color: colors.brand800,
  },
  ingQty: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.stone500,
  },
})
