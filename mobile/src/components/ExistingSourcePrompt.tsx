import { Image, Modal, Pressable, Text, View } from 'react-native'
import { colors, commonStyles, fonts, spacing } from '@/constants/theme'

type ExistingSourceKind = 'library' | 'generated'

export function ExistingSourcePrompt({
  kind,
  title,
  thumbnailUrl,
  busy,
  onUseExisting,
  onGenerateNew,
  onDismiss,
}: {
  kind: ExistingSourceKind
  title?: string | null
  thumbnailUrl?: string | null
  busy?: boolean
  onUseExisting: () => void
  onGenerateNew: () => void
  onDismiss: () => void
}) {
  const named = title?.trim()
  const heading =
    kind === 'library' ? 'You already have this recipe' : 'We’ve already made this recipe'
  const body =
    kind === 'library'
      ? named
        ? `“${named}” is already in your kitchen. Open the one you saved, or make a new version from this video.`
        : 'This video is already in your kitchen. Open the recipe you saved, or make a new version from this video.'
      : named
        ? `We already turned this video into “${named}”. Use that version, or generate a new one — that takes a little longer.`
        : 'We’ve already turned this video into a step-by-step recipe. Use the saved version, or generate a new one — that takes a little longer.'
  const useLabel = kind === 'library' ? 'Open saved recipe' : 'Use saved recipe'
  const generateLabel = kind === 'library' ? 'Make a new version' : 'Generate a new one'

  return (
    <Modal transparent animationType="fade" visible onRequestClose={busy ? () => undefined : onDismiss}>
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(28, 25, 23, 0.5)',
          justifyContent: 'center',
          padding: spacing.lg,
        }}
      >
        <Pressable style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }} onPress={busy ? undefined : onDismiss} />
        <View
          style={{
            backgroundColor: colors.white,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: colors.stone200,
            overflow: 'hidden',
          }}
        >
          <View style={{ padding: spacing.xl, flexDirection: 'row', gap: spacing.lg, alignItems: 'flex-start' }}>
            {thumbnailUrl ? (
              <Image source={{ uri: thumbnailUrl }} style={{ width: 64, height: 64, borderRadius: 14 }} />
            ) : null}
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text
                style={{
                  fontFamily: fonts.displaySemiBold,
                  fontSize: 18,
                  color: colors.stone900,
                }}
              >
                {heading}
              </Text>
              <Text
                style={{
                  marginTop: spacing.sm,
                  fontFamily: fonts.sans,
                  fontSize: 15,
                  lineHeight: 22,
                  color: colors.stone600,
                }}
              >
                {body}
              </Text>
            </View>
          </View>
          <View style={{ padding: spacing.lg, gap: spacing.sm, borderTopWidth: 1, borderTopColor: colors.stone200 }}>
            <Pressable
              disabled={busy}
              onPress={onUseExisting}
              style={[commonStyles.primaryBtn, busy ? { opacity: 0.5 } : null]}
            >
              <Text style={commonStyles.primaryBtnText}>{useLabel}</Text>
            </Pressable>
            <Pressable
              disabled={busy}
              onPress={onGenerateNew}
              style={[commonStyles.secondaryBtn, busy ? { opacity: 0.5 } : null]}
            >
              <Text style={commonStyles.secondaryBtnText}>{generateLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  )
}
