import { MaterialCommunityIcons } from '@expo/vector-icons'
import type { FoodIconPreset } from '@/lib/foodIcons'

interface FoodIconGlyphProps {
  preset: FoodIconPreset
  size: number
}

export function FoodIconGlyph({ preset, size }: FoodIconGlyphProps) {
  return <MaterialCommunityIcons name={preset.icon} size={size} color={preset.foreground} />
}
