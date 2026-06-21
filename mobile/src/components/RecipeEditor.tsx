import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import {
  NestableDraggableFlatList,
  ShadowDecorator,
  type RenderItemParams,
} from 'react-native-draggable-flatlist'
import type { Ingredient, ParsedRecipe, RecipeStep } from '@/types/recipe'
import { colors } from '@/constants/theme'

type Tab = 'ingredients' | 'steps'

type KeyedIngredient = Ingredient & { _key: string }
type KeyedStep = RecipeStep & { _key: string }

interface RecipeEditorProps {
  draft: ParsedRecipe
  onChange: (recipe: ParsedRecipe) => void
}

const listProps = {
  dragItemOverflow: true,
  scrollEnabled: false,
  removeClippedSubviews: false,
  containerStyle: { overflow: 'visible' as const },
  contentContainerStyle: { overflow: 'visible' as const },
  autoscrollThreshold: 80,
  autoscrollSpeed: 120,
}

function newKey(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function withKeys(recipe: ParsedRecipe): { ingredients: KeyedIngredient[]; steps: KeyedStep[] } {
  return {
    ingredients: recipe.ingredients.map((ing, i) => ({
      ...ing,
      _key: (ing as KeyedIngredient)._key ?? newKey(`ing-${i}`),
    })),
    steps: recipe.steps.map((step, i) => ({
      ...step,
      _key: (step as KeyedStep)._key ?? newKey(`step-${i}`),
    })),
  }
}

function stripKeys(recipe: ParsedRecipe & { ingredients: KeyedIngredient[]; steps: KeyedStep[] }): ParsedRecipe {
  return {
    ...recipe,
    ingredients: recipe.ingredients.map(({ _key, ...ing }) => ing),
    steps: recipe.steps.map(({ _key, ...step }) => step),
  }
}

export function RecipeEditor({ draft, onChange }: RecipeEditorProps) {
  const [tab, setTab] = useState<Tab>('ingredients')
  const [keyed, setKeyed] = useState(() => withKeys(draft))

  const emitChange = (ingredients: KeyedIngredient[], steps: KeyedStep[]) => {
    setKeyed({ ingredients, steps })
    onChange(stripKeys({ ...draft, ingredients, steps }))
  }

  const updateIngredient = (index: number, patch: Partial<Ingredient>) => {
    const ingredients = keyed.ingredients.map((ing, i) => (i === index ? { ...ing, ...patch } : ing))
    emitChange(ingredients, keyed.steps)
  }

  const removeIngredient = (index: number) => {
    emitChange(
      keyed.ingredients.filter((_, i) => i !== index),
      keyed.steps,
    )
  }

  const addIngredient = () => {
    emitChange(
      [...keyed.ingredients, { name: '', quantity: '', group: 'Main', _key: newKey('ing') }],
      keyed.steps,
    )
  }

  const updateStep = (index: number, instruction: string) => {
    const steps = keyed.steps.map((step, i) => (i === index ? { ...step, instruction } : step))
    emitChange(keyed.ingredients, steps)
  }

  const removeStep = (index: number) => {
    emitChange(keyed.ingredients, keyed.steps.filter((_, i) => i !== index))
  }

  const addStep = () => {
    emitChange(keyed.ingredients, [
      ...keyed.steps,
      {
        order: keyed.steps.length + 1,
        instruction: '',
        ingredients_used: [],
        equipment: [],
        _key: newKey('step'),
      },
    ])
  }

  const renderIngredient = ({ item, drag, isActive, getIndex }: RenderItemParams<KeyedIngredient>) => {
    const index = getIndex() ?? 0
    return (
      <ShadowDecorator elevation={14} radius={10} opacity={0.18}>
        <View style={[styles.card, isActive && styles.cardActive]}>
          <Pressable
            onLongPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              drag()
            }}
            delayLongPress={120}
            hitSlop={8}
            style={styles.dragHandle}
          >
            <Ionicons name="reorder-three" size={24} color={colors.stone400} />
          </Pressable>
          <TextInput
            value={item.name}
            onChangeText={(v) => updateIngredient(index, { name: v })}
            placeholder="Ingredient"
            placeholderTextColor={colors.stone500}
            style={[styles.input, styles.flex]}
          />
          <TextInput
            value={item.quantity}
            onChangeText={(v) => updateIngredient(index, { quantity: v })}
            placeholder="Amount"
            placeholderTextColor={colors.stone500}
            style={[styles.input, styles.qtyInput]}
          />
          <Pressable onPress={() => removeIngredient(index)} hitSlop={8}>
            <Text style={styles.removeBtn}>✕</Text>
          </Pressable>
        </View>
      </ShadowDecorator>
    )
  }

  const renderStep = ({ item, drag, isActive, getIndex }: RenderItemParams<KeyedStep>) => {
    const index = getIndex() ?? 0
    return (
      <ShadowDecorator elevation={14} radius={10} opacity={0.18}>
        <View style={[styles.card, styles.stepCard, isActive && styles.cardActive]}>
          <Pressable
            onLongPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              drag()
            }}
            delayLongPress={120}
            hitSlop={8}
            style={styles.dragHandle}
          >
            <Ionicons name="reorder-three" size={24} color={colors.stone400} />
          </Pressable>
          <Text style={styles.stepNum}>{index + 1}</Text>
          <TextInput
            value={item.instruction}
            onChangeText={(v) => updateStep(index, v)}
            placeholder="Describe this step…"
            placeholderTextColor={colors.stone500}
            multiline
            textAlignVertical="top"
            style={[styles.input, styles.stepInput]}
          />
          <Pressable onPress={() => removeStep(index)} hitSlop={8}>
            <Text style={styles.removeBtn}>✕</Text>
          </Pressable>
        </View>
      </ShadowDecorator>
    )
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.tabs}>
        {(['ingredients', 'steps'] as Tab[]).map((t) => (
          <Pressable
            key={t}
            onPress={() => setTab(t)}
            style={[styles.tab, tab === t && styles.tabActive]}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === 'ingredients'
                ? `Ingredients (${keyed.ingredients.length})`
                : `Steps (${keyed.steps.length})`}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.panelTitle}>{tab === 'ingredients' ? 'Ingredients' : 'Steps'}</Text>
        <Pressable onPress={tab === 'ingredients' ? addIngredient : addStep}>
          <Text style={styles.addLink}>+ Add</Text>
        </Pressable>
      </View>

      <Text style={styles.hint}>Hold ≡ and drag to reorder</Text>

      <View style={styles.listArea}>
        {tab === 'ingredients' ? (
          keyed.ingredients.length === 0 ? (
            <Text style={styles.empty}>No ingredients yet</Text>
          ) : (
            <NestableDraggableFlatList
              {...listProps}
              data={keyed.ingredients}
              keyExtractor={(item) => item._key}
              onDragEnd={({ data }) => emitChange(data, keyed.steps)}
              renderItem={renderIngredient}
            />
          )
        ) : keyed.steps.length === 0 ? (
          <Text style={styles.empty}>No steps yet</Text>
        ) : (
          <NestableDraggableFlatList
            {...listProps}
            data={keyed.steps}
            keyExtractor={(item) => item._key}
            onDragEnd={({ data }) =>
              emitChange(
                keyed.ingredients,
                data.map((step, i) => ({ ...step, order: i + 1 })),
              )
            }
            renderItem={renderStep}
          />
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: 12, overflow: 'visible' as const },
  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.stone100,
    borderRadius: 12,
    padding: 4,
  },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  tabActive: { backgroundColor: colors.white },
  tabText: { fontWeight: '600', fontSize: 13, color: colors.stone500 },
  tabTextActive: { color: colors.stone900 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  panelTitle: { fontSize: 16, fontWeight: '700', color: colors.stone900 },
  addLink: { fontWeight: '600', color: colors.brand },
  hint: { fontSize: 12, color: colors.stone500, marginTop: -4 },
  listArea: {
    overflow: 'visible',
    zIndex: 1,
  },
  card: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    marginBottom: 10,
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.stone200,
    padding: 10,
  },
  stepCard: { alignItems: 'flex-start' },
  cardActive: {
    borderColor: colors.brand,
    backgroundColor: colors.white,
  },
  dragHandle: { paddingVertical: 4 },
  input: {
    backgroundColor: colors.stone50,
    borderWidth: 1,
    borderColor: colors.stone200,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.stone900,
  },
  flex: { flex: 1 },
  qtyInput: { width: 88 },
  stepInput: { flex: 1, minHeight: 72 },
  stepNum: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#ffedd5',
    color: colors.brand,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 28,
    marginTop: 8,
    overflow: 'hidden',
  },
  removeBtn: { color: colors.stone400, fontSize: 18, paddingTop: 8 },
  empty: { textAlign: 'center', color: colors.stone500, paddingVertical: 16 },
})
