import type { LucideIcon } from 'lucide-react'
import {
  Apple,
  Banana,
  Bean,
  Beef,
  Beer,
  BottleWine,
  Broccoli,
  Cake,
  CakeSlice,
  Candy,
  CandyCane,
  Carrot,
  ChefHat,
  Cherry,
  Citrus,
  Coffee,
  Cookie,
  CookingPot,
  Croissant,
  CupSoda,
  Donut,
  Drumstick,
  Egg,
  EggFried,
  Fish,
  Flame,
  GlassWater,
  Grape,
  Ham,
  Hamburger,
  IceCream,
  IceCreamBowl,
  Leaf,
  Lollipop,
  Martini,
  Milk,
  Nut,
  Pizza,
  Popcorn,
  Salad,
  Sandwich,
  Shell,
  Shrimp,
  Soup,
  Sprout,
  UtensilsCrossed,
  Vegan,
  Wheat,
  Wine,
} from 'lucide-react'

export interface FoodIconPreset {
  id: string
  label: string
  Icon: LucideIcon
  background: string
  foreground: string
}

/** Curated food icons for recipe thumbnails. */
export const FOOD_ICON_PRESETS: FoodIconPreset[] = [
  // Main dishes
  { id: 'pizza', label: 'Pizza', Icon: Pizza, background: '#fef3c7', foreground: '#b45309' },
  { id: 'pasta', label: 'Pasta', Icon: Wheat, background: '#fff7ed', foreground: '#c2410c' },
  { id: 'burger', label: 'Burger', Icon: Hamburger, background: '#fee2e2', foreground: '#b91c1c' },
  { id: 'steak', label: 'Steak', Icon: Beef, background: '#fecaca', foreground: '#991b1b' },
  { id: 'sandwich', label: 'Sandwich', Icon: Sandwich, background: '#ffedd5', foreground: '#9a3412' },
  { id: 'soup', label: 'Soup', Icon: Soup, background: '#fef9c3', foreground: '#a16207' },
  { id: 'stew', label: 'Stew', Icon: CookingPot, background: '#ffedd5', foreground: '#c2410c' },
  { id: 'salad', label: 'Salad', Icon: Salad, background: '#ecfdf5', foreground: '#047857' },
  { id: 'bbq', label: 'Grill', Icon: Flame, background: '#ffedd5', foreground: '#ea580c' },
  { id: 'ham', label: 'Ham', Icon: Ham, background: '#fce7f3', foreground: '#be185d' },

  // Protein
  { id: 'chicken', label: 'Chicken', Icon: Drumstick, background: '#fef3c7', foreground: '#d97706' },
  { id: 'fish', label: 'Fish', Icon: Fish, background: '#e0f2fe', foreground: '#0369a1' },
  { id: 'shrimp', label: 'Shrimp', Icon: Shrimp, background: '#ffe4e6', foreground: '#e11d48' },
  { id: 'shellfish', label: 'Shellfish', Icon: Shell, background: '#fce7f3', foreground: '#db2777' },
  { id: 'egg', label: 'Egg', Icon: Egg, background: '#fefce8', foreground: '#ca8a04' },
  { id: 'breakfast', label: 'Breakfast', Icon: EggFried, background: '#fef9c3', foreground: '#a16207' },

  // Produce
  { id: 'apple', label: 'Apple', Icon: Apple, background: '#fee2e2', foreground: '#dc2626' },
  { id: 'banana', label: 'Banana', Icon: Banana, background: '#fef9c3', foreground: '#a16207' },
  { id: 'citrus', label: 'Citrus', Icon: Citrus, background: '#ffedd5', foreground: '#ea580c' },
  { id: 'grape', label: 'Grapes', Icon: Grape, background: '#f3e8ff', foreground: '#7e22ce' },
  { id: 'cherry', label: 'Cherry', Icon: Cherry, background: '#ffe4e6', foreground: '#be123c' },
  { id: 'carrot', label: 'Carrot', Icon: Carrot, background: '#ffedd5', foreground: '#ea580c' },
  { id: 'broccoli', label: 'Broccoli', Icon: Broccoli, background: '#dcfce7', foreground: '#15803d' },
  { id: 'beans', label: 'Beans', Icon: Bean, background: '#fef3c7', foreground: '#92400e' },
  { id: 'sprout', label: 'Greens', Icon: Sprout, background: '#ecfdf5', foreground: '#059669' },
  { id: 'vegan', label: 'Vegan', Icon: Vegan, background: '#dcfce7', foreground: '#15803d' },
  { id: 'leafy', label: 'Plant-based', Icon: Leaf, background: '#d1fae5', foreground: '#047857' },

  // Bakery & sweets
  { id: 'croissant', label: 'Pastry', Icon: Croissant, background: '#fffbeb', foreground: '#b45309' },
  { id: 'cookie', label: 'Cookies', Icon: Cookie, background: '#fef3c7', foreground: '#92400e' },
  { id: 'cake', label: 'Cake', Icon: Cake, background: '#fdf2f8', foreground: '#db2777' },
  { id: 'cake-slice', label: 'Cake slice', Icon: CakeSlice, background: '#fce7f3', foreground: '#be185d' },
  { id: 'donut', label: 'Donut', Icon: Donut, background: '#fae8ff', foreground: '#a21caf' },
  { id: 'ice-cream', label: 'Ice cream', Icon: IceCream, background: '#ede9fe', foreground: '#6d28d9' },
  { id: 'ice-cream-bowl', label: 'Sundae', Icon: IceCreamBowl, background: '#e0e7ff', foreground: '#4338ca' },
  { id: 'candy', label: 'Candy', Icon: Candy, background: '#ffe4e6', foreground: '#e11d48' },
  { id: 'lollipop', label: 'Lollipop', Icon: Lollipop, background: '#fdf2f8', foreground: '#db2777' },
  { id: 'candy-cane', label: 'Holiday', Icon: CandyCane, background: '#fee2e2', foreground: '#dc2626' },
  { id: 'nut', label: 'Nuts', Icon: Nut, background: '#fef3c7', foreground: '#78350f' },

  // Drinks
  { id: 'coffee', label: 'Coffee', Icon: Coffee, background: '#f5f5f4', foreground: '#57534e' },
  { id: 'soda', label: 'Soda', Icon: CupSoda, background: '#fce7f3', foreground: '#be185d' },
  { id: 'water', label: 'Water', Icon: GlassWater, background: '#e0f2fe', foreground: '#0284c7' },
  { id: 'wine', label: 'Wine', Icon: Wine, background: '#fce7f3', foreground: '#9d174d' },
  { id: 'bottle-wine', label: 'Wine bottle', Icon: BottleWine, background: '#f3e8ff', foreground: '#7e22ce' },
  { id: 'beer', label: 'Beer', Icon: Beer, background: '#fef9c3', foreground: '#a16207' },
  { id: 'cocktail', label: 'Cocktail', Icon: Martini, background: '#ecfdf5', foreground: '#0d9488' },

  // Other
  { id: 'dairy', label: 'Dairy', Icon: Milk, background: '#f0f9ff', foreground: '#0284c7' },
  { id: 'popcorn', label: 'Popcorn', Icon: Popcorn, background: '#fef3c7', foreground: '#d97706' },
  { id: 'chef', label: 'Chef special', Icon: ChefHat, background: '#ecfdf5', foreground: '#059669' },
  { id: 'general', label: 'General', Icon: UtensilsCrossed, background: '#f5f5f4', foreground: '#44403c' },
]

export function getFoodIconPreset(id: string): FoodIconPreset | undefined {
  return FOOD_ICON_PRESETS.find((preset) => preset.id === id)
}
