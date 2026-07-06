import type { ComponentProps } from 'react'
import { MaterialCommunityIcons } from '@expo/vector-icons'

export type FoodMciName = ComponentProps<typeof MaterialCommunityIcons>['name']

export interface FoodIconPreset {
  id: string
  label: string
  icon: FoodMciName
  background: string
  foreground: string
}

/** Curated food icons for recipe thumbnails (MaterialCommunityIcons — no native SVG required). */
export const FOOD_ICON_PRESETS: FoodIconPreset[] = [
  { id: 'pizza', label: 'Pizza', icon: 'pizza', background: '#fef3c7', foreground: '#b45309' },
  { id: 'pasta', label: 'Pasta', icon: 'pasta', background: '#fff7ed', foreground: '#c2410c' },
  { id: 'burger', label: 'Burger', icon: 'hamburger', background: '#fee2e2', foreground: '#b91c1c' },
  { id: 'steak', label: 'Steak', icon: 'food-steak', background: '#fecaca', foreground: '#991b1b' },
  { id: 'sandwich', label: 'Sandwich', icon: 'bread-slice', background: '#ffedd5', foreground: '#9a3412' },
  { id: 'soup', label: 'Soup', icon: 'bowl-mix', background: '#fef9c3', foreground: '#a16207' },
  { id: 'stew', label: 'Stew', icon: 'pot-steam', background: '#ffedd5', foreground: '#c2410c' },
  { id: 'salad', label: 'Salad', icon: 'leaf', background: '#ecfdf5', foreground: '#047857' },
  { id: 'bbq', label: 'Grill', icon: 'grill', background: '#ffedd5', foreground: '#ea580c' },
  { id: 'ham', label: 'Ham', icon: 'food-turkey', background: '#fce7f3', foreground: '#be185d' },
  { id: 'chicken', label: 'Chicken', icon: 'food-drumstick', background: '#fef3c7', foreground: '#d97706' },
  { id: 'fish', label: 'Fish', icon: 'fish', background: '#e0f2fe', foreground: '#0369a1' },
  { id: 'shrimp', label: 'Shrimp', icon: 'fish', background: '#ffe4e6', foreground: '#e11d48' },
  { id: 'shellfish', label: 'Shellfish', icon: 'jellyfish', background: '#fce7f3', foreground: '#db2777' },
  { id: 'egg', label: 'Egg', icon: 'egg', background: '#fefce8', foreground: '#ca8a04' },
  { id: 'breakfast', label: 'Breakfast', icon: 'egg-fried', background: '#fef9c3', foreground: '#a16207' },
  { id: 'apple', label: 'Apple', icon: 'food-apple', background: '#fee2e2', foreground: '#dc2626' },
  { id: 'banana', label: 'Banana', icon: 'fruit-pear', background: '#fef9c3', foreground: '#a16207' },
  { id: 'citrus', label: 'Citrus', icon: 'fruit-citrus', background: '#ffedd5', foreground: '#ea580c' },
  { id: 'grape', label: 'Grapes', icon: 'fruit-grapes', background: '#f3e8ff', foreground: '#7e22ce' },
  { id: 'cherry', label: 'Cherry', icon: 'fruit-cherries', background: '#ffe4e6', foreground: '#be123c' },
  { id: 'carrot', label: 'Carrot', icon: 'carrot', background: '#ffedd5', foreground: '#ea580c' },
  { id: 'broccoli', label: 'Broccoli', icon: 'sprout', background: '#dcfce7', foreground: '#15803d' },
  { id: 'beans', label: 'Beans', icon: 'food-variant', background: '#fef3c7', foreground: '#92400e' },
  { id: 'sprout', label: 'Greens', icon: 'sprout', background: '#ecfdf5', foreground: '#059669' },
  { id: 'vegan', label: 'Vegan', icon: 'leaf-circle', background: '#dcfce7', foreground: '#15803d' },
  { id: 'leafy', label: 'Plant-based', icon: 'leaf', background: '#d1fae5', foreground: '#047857' },
  { id: 'croissant', label: 'Pastry', icon: 'food-croissant', background: '#fffbeb', foreground: '#b45309' },
  { id: 'cookie', label: 'Cookies', icon: 'cookie', background: '#fef3c7', foreground: '#92400e' },
  { id: 'cake', label: 'Cake', icon: 'cake-variant', background: '#fdf2f8', foreground: '#db2777' },
  { id: 'cake-slice', label: 'Cake slice', icon: 'cake-layered', background: '#fce7f3', foreground: '#be185d' },
  { id: 'donut', label: 'Donut', icon: 'cupcake', background: '#fae8ff', foreground: '#a21caf' },
  { id: 'ice-cream', label: 'Ice cream', icon: 'ice-cream', background: '#ede9fe', foreground: '#6d28d9' },
  { id: 'ice-cream-bowl', label: 'Sundae', icon: 'ice-cream', background: '#e0e7ff', foreground: '#4338ca' },
  { id: 'candy', label: 'Candy', icon: 'candy', background: '#ffe4e6', foreground: '#e11d48' },
  { id: 'lollipop', label: 'Lollipop', icon: 'candy', background: '#fdf2f8', foreground: '#db2777' },
  { id: 'candy-cane', label: 'Holiday', icon: 'candycane', background: '#fee2e2', foreground: '#dc2626' },
  { id: 'nut', label: 'Nuts', icon: 'peanut', background: '#fef3c7', foreground: '#78350f' },
  { id: 'coffee', label: 'Coffee', icon: 'coffee', background: '#f5f5f4', foreground: '#57534e' },
  { id: 'soda', label: 'Soda', icon: 'bottle-soda', background: '#fce7f3', foreground: '#be185d' },
  { id: 'water', label: 'Water', icon: 'cup-water', background: '#e0f2fe', foreground: '#0284c7' },
  { id: 'wine', label: 'Wine', icon: 'glass-wine', background: '#fce7f3', foreground: '#9d174d' },
  { id: 'bottle-wine', label: 'Wine bottle', icon: 'bottle-wine', background: '#f3e8ff', foreground: '#7e22ce' },
  { id: 'beer', label: 'Beer', icon: 'beer', background: '#fef9c3', foreground: '#a16207' },
  { id: 'cocktail', label: 'Cocktail', icon: 'glass-cocktail', background: '#ecfdf5', foreground: '#0d9488' },
  { id: 'dairy', label: 'Dairy', icon: 'cheese', background: '#f0f9ff', foreground: '#0284c7' },
  { id: 'popcorn', label: 'Popcorn', icon: 'popcorn', background: '#fef3c7', foreground: '#d97706' },
  { id: 'chef', label: 'Chef special', icon: 'chef-hat', background: '#ecfdf5', foreground: '#059669' },
  { id: 'general', label: 'General', icon: 'silverware-fork-knife', background: '#f5f5f4', foreground: '#44403c' },
]

export function getFoodIconPreset(id: string): FoodIconPreset | undefined {
  return FOOD_ICON_PRESETS.find((preset) => preset.id === id)
}
