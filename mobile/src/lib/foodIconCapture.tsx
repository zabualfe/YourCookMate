import { forwardRef } from 'react'
import { StyleSheet, View } from 'react-native'
import { FoodIconGlyph } from '@/components/FoodIconGlyph'
import type { FoodIconPreset } from './foodIcons'

const CAPTURE_SIZE = 256

export const FoodIconPresetView = forwardRef<View, { preset: FoodIconPreset }>(function FoodIconPresetView(
  { preset },
  ref,
) {
  return (
    <View
      ref={ref}
      style={[styles.canvas, { backgroundColor: preset.background }]}
      collapsable={false}
    >
      <FoodIconGlyph preset={preset} size={128} />
    </View>
  )
})

function viewShotUnavailable(err: unknown): never {
  const message = err instanceof Error ? err.message : String(err)
  if (
    message.includes('native module') ||
    message.includes('ViewShot') ||
    message.includes('unknown module')
  ) {
    throw new Error('Rebuild the app to enable icon uploads (npx expo run:ios).')
  }
  throw err instanceof Error ? err : new Error(message)
}

export async function foodIconPresetToUri(_preset: FoodIconPreset, ref: View): Promise<string> {
  let captureRef: (typeof import('react-native-view-shot'))['captureRef']
  try {
    ;({ captureRef } = await import('react-native-view-shot'))
  } catch (err) {
    viewShotUnavailable(err)
  }
  return captureRef(ref, {
    format: 'png',
    quality: 0.92,
    width: CAPTURE_SIZE,
    height: CAPTURE_SIZE,
  })
}

const styles = StyleSheet.create({
  canvas: {
    width: CAPTURE_SIZE,
    height: CAPTURE_SIZE,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
})
