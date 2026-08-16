import { Ionicons } from '@expo/vector-icons'
import { Text, View } from 'react-native'
import { visibilityExplanation, visibilityStatus } from '@/lib/visibility'
import { colors, fonts, radii, spacing } from '@/constants/theme'

export function VisibilityTimer({
  locked,
  visibleUntil,
}: {
  locked?: boolean
  visibleUntil?: string | null
}) {
  const status = visibilityStatus(locked, visibleUntil)
  if (!status || status.kind === 'locked') return null
  const urgent = status.kind === 'soon' || status.kind === 'today'
  const explanation = visibilityExplanation(locked, visibleUntil)

  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={`${status.label}. ${explanation ?? ''}`}
      style={{
        marginTop: spacing.xs,
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        borderRadius: radii.xl,
        paddingHorizontal: spacing.sm,
        paddingVertical: 2,
        backgroundColor: urgent ? colors.accent50 : colors.stone100,
      }}
    >
      <Ionicons name="time-outline" size={12} color={urgent ? colors.accent700 : colors.stone600} />
      <Text
        style={{
          fontFamily: fonts.displaySemiBold,
          fontSize: 11,
          letterSpacing: 0.4,
          textTransform: 'uppercase',
          color: urgent ? colors.accent700 : colors.stone600,
        }}
      >
        {status.label}
      </Text>
    </View>
  )
}
