import { Ionicons } from '@expo/vector-icons'
import { useMemo } from 'react'
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors, fonts, radii, spacing } from '@/constants/theme'
import { FOOD_ICON_PRESETS, type FoodIconPreset } from '@/lib/foodIcons'
import { FoodIconGlyph } from '@/components/FoodIconGlyph'

const NUM_COLUMNS = 4
const H_PADDING = spacing.lg
const GRID_GAP = spacing.sm

interface FoodIconPickerProps {
  visible: boolean
  onClose: () => void
  onSelect: (preset: FoodIconPreset) => void
  onTakePhoto?: () => void
  onChooseFromLibrary?: () => void
  busy?: boolean
}

export function FoodIconPicker({
  visible,
  onClose,
  onSelect,
  onTakePhoto,
  onChooseFromLibrary,
  busy = false,
}: FoodIconPickerProps) {
  const insets = useSafeAreaInsets()
  const { width: screenWidth } = useWindowDimensions()

  const itemWidth = useMemo(() => {
    const available = screenWidth - H_PADDING * 2
    return (available - GRID_GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS
  }, [screenWidth])

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={() => {
        if (!busy) onClose()
      }}
    >
      <Pressable style={styles.backdrop} onPress={() => !busy && onClose()}>
        <View
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}
          onStartShouldSetResponder={() => true}
        >
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={styles.title}>Choose a food icon</Text>
              <Text style={styles.subtitle}>Pick one that matches your recipe.</Text>
            </View>
            <Pressable
              onPress={onClose}
              disabled={busy}
              hitSlop={8}
              accessibilityLabel="Close"
              style={styles.closeBtn}
            >
              <Ionicons name="close" size={22} color={colors.stone500} />
            </Pressable>
          </View>

          <FlatList
            data={FOOD_ICON_PRESETS}
            key={NUM_COLUMNS}
            numColumns={NUM_COLUMNS}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            style={styles.list}
            contentContainerStyle={styles.gridContent}
            columnWrapperStyle={styles.gridRow}
            renderItem={({ item }) => (
              <Pressable
                disabled={busy}
                onPress={() => onSelect(item)}
                style={({ pressed }) => [
                  styles.gridItem,
                  { width: itemWidth },
                  pressed && styles.gridItemPressed,
                ]}
                accessibilityLabel={item.label}
              >
                <View style={[styles.iconTile, { backgroundColor: item.background }]}>
                  <FoodIconGlyph preset={item} size={26} />
                </View>
                <Text style={styles.iconLabel} numberOfLines={2}>
                  {item.label}
                </Text>
              </Pressable>
            )}
          />

          {onTakePhoto || onChooseFromLibrary ? (
            <View style={styles.footer}>
              {onTakePhoto ? (
                <Pressable
                  disabled={busy}
                  onPress={onTakePhoto}
                  style={({ pressed }) => [styles.footerBtn, pressed && { opacity: 0.85 }]}
                >
                  <Ionicons name="camera-outline" size={18} color={colors.white} />
                  <Text style={styles.footerBtnText}>Take a photo</Text>
                </Pressable>
              ) : null}
              {onChooseFromLibrary ? (
                <Pressable
                  disabled={busy}
                  onPress={onChooseFromLibrary}
                  style={({ pressed }) => [
                    styles.footerBtn,
                    onTakePhoto && styles.footerBtnSecondary,
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <Ionicons name="images-outline" size={18} color={colors.stone700} />
                  <Text style={[styles.footerBtnText, onTakePhoto && styles.footerBtnTextSecondary]}>
                    Choose from library
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </View>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    maxHeight: '85%',
    backgroundColor: colors.white,
    borderTopLeftRadius: radii.xxl,
    borderTopRightRadius: radii.xxl,
    borderWidth: 1,
    borderColor: colors.stone200,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.stone200,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
  headerText: { flex: 1 },
  title: {
    fontFamily: fonts.displayBold,
    fontSize: 18,
    color: colors.stone900,
  },
  subtitle: {
    marginTop: 2,
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.stone500,
  },
  closeBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.sm,
  },
  list: {
    flexGrow: 0,
    flexShrink: 1,
  },
  gridContent: {
    paddingHorizontal: H_PADDING,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  gridRow: {
    gap: GRID_GAP,
    marginBottom: GRID_GAP,
  },
  gridItem: {
    alignItems: 'center',
    gap: 6,
    paddingVertical: 2,
    borderRadius: radii.md,
  },
  gridItemPressed: {
    backgroundColor: colors.stone50,
  },
  iconTile: {
    width: 52,
    height: 52,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(231,229,228,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconLabel: {
    width: '100%',
    fontFamily: fonts.sansSemiBold,
    fontSize: 10,
    lineHeight: 12,
    textAlign: 'center',
    color: colors.stone600,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: colors.stone200,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: colors.white,
    gap: spacing.sm,
  },
  footerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: colors.brand600,
    paddingVertical: spacing.md,
  },
  footerBtnSecondary: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.stone200,
  },
  footerBtnText: {
    fontFamily: fonts.displaySemiBold,
    fontSize: 14,
    color: colors.white,
  },
  footerBtnTextSecondary: {
    color: colors.stone700,
  },
})
