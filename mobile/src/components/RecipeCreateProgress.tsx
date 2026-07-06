import { Ionicons } from '@expo/vector-icons'
import { useEffect, useState } from 'react'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import { colors, fonts, radii } from '@/constants/theme'

const FULL_STEPS = [
  { label: 'Opening your link', target: 28 },
  { label: 'Reading the recipe', target: 62 },
  { label: 'Building step-by-step cards', target: 94 },
] as const

const PARSE_ONLY_STEPS = [{ label: 'Building step-by-step cards', target: 94 }] as const

interface RecipeCreateProgressProps {
  step: number
  mode?: 'full' | 'parse-only'
}

export function RecipeCreateProgress({ step, mode = 'full' }: RecipeCreateProgressProps) {
  const steps = mode === 'full' ? FULL_STEPS : PARSE_ONLY_STEPS
  const safeStep = Math.min(step, steps.length - 1)
  const target = steps[safeStep]?.target ?? 94
  const [percent, setPercent] = useState(4)

  useEffect(() => {
    setPercent((p) => Math.max(p, 4))
  }, [step])

  useEffect(() => {
    const creep = setInterval(() => {
      setPercent((p) => {
        if (p >= target) return p
        const gap = target - p
        const bump = gap > 20 ? 1.2 : gap > 8 ? 0.6 : 0.25
        return Math.min(target, p + bump)
      })
    }, 120)
    return () => clearInterval(creep)
  }, [target])

  return (
    <View style={styles.container} accessibilityRole="progressbar" accessibilityValue={{ now: Math.round(percent), min: 0, max: 100 }}>
      <View style={styles.header}>
        <Text style={styles.title}>Working on your recipe…</Text>
        <Text style={styles.percent}>{Math.round(percent)}%</Text>
      </View>

      <View style={styles.track}>
        <View style={[styles.fill, { width: `${percent}%` }]} />
      </View>

      {steps.map((item, index) => {
        const done = index < safeStep
        const current = index === safeStep
        return (
          <View key={item.label} style={styles.stepRow}>
            <View
              style={[
                styles.stepBadge,
                done && styles.stepBadgeDone,
                current && styles.stepBadgeCurrent,
              ]}
            >
              {done ? (
                <Ionicons name="checkmark" size={14} color={colors.white} />
              ) : (
                <Text style={[styles.stepNumber, current && styles.stepNumberCurrent]}>{index + 1}</Text>
              )}
            </View>
            <Text
              style={[
                styles.stepLabel,
                done && styles.stepLabelDone,
                current && styles.stepLabelCurrent,
              ]}
            >
              {item.label}
            </Text>
            {current && <ActivityIndicator size="small" color={colors.brand} style={styles.spinner} />}
          </View>
        )
      })}

      <Text style={styles.hint}>Longer videos can take up to a minute — hang tight.</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    marginTop: 16,
    padding: 16,
    borderRadius: radii.xxl,
    borderWidth: 1,
    borderColor: colors.brand200,
    backgroundColor: colors.brand50,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: { fontSize: 14, fontFamily: fonts.displayBold, color: colors.brand700 },
  percent: { fontSize: 12, fontFamily: fonts.displaySemiBold, color: colors.brand600 },
  track: {
    height: 10,
    borderRadius: 999,
    backgroundColor: colors.brand100,
    overflow: 'hidden',
    marginBottom: 16,
  },
  fill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: colors.brand600,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  stepBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.stone200,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBadgeDone: {
    borderColor: colors.brand600,
    backgroundColor: colors.brand600,
  },
  stepBadgeCurrent: {
    borderColor: colors.brand600,
  },
  stepNumber: { fontSize: 11, color: colors.stone500, fontFamily: fonts.displaySemiBold },
  stepNumberCurrent: { color: colors.brand600 },
  stepLabel: { flex: 1, fontSize: 14, fontFamily: fonts.sans, color: colors.stone500 },
  stepLabelDone: { color: colors.brand700 },
  stepLabelCurrent: { color: colors.stone900, fontFamily: fonts.displaySemiBold },
  spinner: { marginLeft: 'auto' },
  hint: { marginTop: 4, fontSize: 12, fontFamily: fonts.sans, color: colors.stone500 },
})
