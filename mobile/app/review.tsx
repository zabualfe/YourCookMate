import { router } from 'expo-router'
import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { saveRecipe } from '@/api/client'
import { StepMediaPreview } from '@/components/StepMediaPreview'
import { useAuth } from '@/context/AuthContext'
import { clearReviewDraft, loadReviewDraft } from '@/lib/reviewDraft'
import type { ReviewDraft } from '@/types/recipe'
import { videoPlatformLabel } from '@/types/ingest'
import { colors } from '@/constants/theme'
import { Ionicons } from '@expo/vector-icons'

export default function ReviewScreen() {
  const { isAuthenticated } = useAuth()
  const [draft, setDraft] = useState<ReviewDraft | null>(null)
  const [title, setTitle] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    loadReviewDraft().then((d) => {
      if (!d) {
        router.replace('/new')
        return
      }
      setDraft(d)
      setTitle(d.recipe.title)
    })
  }, [])

  if (!draft) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.brand} />
      </View>
    )
  }

  const persist = async (destination: 'library' | 'cook') => {
    setError('')
    setLoading(true)
    const recipe = { ...draft.recipe, title: title.trim() || draft.recipe.title }
    try {
      if (!isAuthenticated) {
        setError('Sign in to save recipes to your library.')
        setLoading(false)
        return
      }
      const saved = await saveRecipe({
        raw_text: draft.rawText,
        recipe,
        used_ai: draft.usedAi,
        source_type: draft.sourceType ?? 'text',
        source_url: draft.sourceUrl,
      })
      await clearReviewDraft()
      router.replace(destination === 'cook' ? `/cook/${saved.id}` : `/recipes/${saved.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setLoading(false)
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.meta}>
        {draft.usedAi ? 'Parsed with AI' : 'Parsed with fallback'} · {draft.recipe.steps.length} steps
        {draft.sourceType && draft.sourceType !== 'text'
          ? ` · from ${videoPlatformLabel(draft.sourceType)}`
          : ''}
      </Text>

      {(draft.stepImageNotes?.length ?? 0) > 0 && (
        <View style={styles.notesBlock}>
          {draft.stepImageNotes!.map((note) => (
            <Text key={note} style={styles.noteText}>
              • {note}
            </Text>
          ))}
        </View>
      )}

      {(draft.recipe.calories_per_serving != null || (draft.recipe.allergens?.length ?? 0) > 0) && (
        <View style={styles.nutritionBlock}>
          {draft.recipe.calories_per_serving != null && (
            <Text style={styles.calorieText}>
              ~{draft.recipe.calories_per_serving} cal / serving (est.)
            </Text>
          )}
          {(draft.recipe.allergens?.length ?? 0) > 0 && (
            <View style={styles.allergenRow}>
              {draft.recipe.allergens!.map((allergen) => (
                <View key={allergen} style={styles.allergenChip}>
                  <Text style={styles.allergenText}>
                    {allergen.charAt(0).toUpperCase() + allergen.slice(1)}
                  </Text>
                </View>
              ))}
            </View>
          )}
          {draft.recipe.calories_per_serving != null &&
            (draft.recipe.allergens?.length ?? 0) === 0 && (
              <Text style={styles.noAllergens}>No common allergens detected</Text>
            )}
        </View>
      )}

      <Text style={styles.label}>Title</Text>
      <TextInput value={title} onChangeText={setTitle} style={styles.input} />

      {draft.sourceUrl ? (
        <Pressable
          style={styles.sourceLink}
          onPress={() => Linking.openURL(draft.sourceUrl!)}
          accessibilityRole="link"
        >
          <Ionicons name="link-outline" size={16} color={colors.brand} />
          <Text style={styles.sourceLinkText}>Source</Text>
        </Pressable>
      ) : null}

      <Text style={styles.sectionTitle}>Ingredients ({draft.recipe.ingredients.length})</Text>
      {draft.recipe.ingredients.map((ing, i) => (
        <View key={`${ing.name}-${i}`} style={styles.row}>
          <Text style={styles.ingName}>{ing.name}</Text>
          {ing.quantity ? <Text style={styles.ingQty}>{ing.quantity}</Text> : null}
        </View>
      ))}

      <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Steps</Text>
      {draft.recipe.steps.map((step, i) => (
        <View key={step.order} style={styles.step}>
          <Text style={styles.stepNum}>{i + 1}</Text>
          <View style={styles.stepBody}>
            {(step.clip_url || step.image_url) && (
              <StepMediaPreview clipUrl={step.clip_url} imageUrl={step.image_url} variant="inline" />
            )}
            <Text style={styles.stepText}>{step.instruction}</Text>
          </View>
        </View>
      ))}

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!isAuthenticated && (
        <Text style={styles.hint}>Sign in from the Home tab to save this recipe.</Text>
      )}

      <View style={styles.actions}>
        <Pressable
          style={[styles.secondaryBtn, loading && styles.disabled]}
          disabled={loading}
          onPress={() => persist('library')}
        >
          <Text style={styles.secondaryBtnText}>{loading ? 'Saving…' : 'Save'}</Text>
        </Pressable>
        <Pressable
          style={[styles.primaryBtn, loading && styles.disabled]}
          disabled={loading}
          onPress={() => persist('cook')}
        >
          <Text style={styles.primaryBtnText}>{loading ? 'Saving…' : 'Start cooking'}</Text>
        </Pressable>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.stone50 },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  meta: { color: colors.stone600, marginBottom: 16 },
  notesBlock: {
    marginBottom: 16,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
    gap: 4,
  },
  noteText: { fontSize: 12, color: colors.stone600 },
  nutritionBlock: { marginBottom: 16, gap: 8 },
  calorieText: { color: '#92400e', fontWeight: '600', fontSize: 13 },
  allergenRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  allergenChip: {
    backgroundColor: colors.red50,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  allergenText: { color: colors.red700, fontWeight: '600', fontSize: 13 },
  noAllergens: { color: colors.stone500, fontSize: 13 },
  label: { fontWeight: '600', color: colors.stone700, marginBottom: 6 },
  input: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.stone200,
    borderRadius: 14,
    padding: 14,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  sourceLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  },
  sourceLinkText: { color: colors.brand, fontWeight: '600', fontSize: 14 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: colors.stone900, marginBottom: 10 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.stone200,
  },
  ingName: { color: colors.stone800, flex: 1 },
  ingQty: { color: colors.stone500 },
  step: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.stone200,
  },
  stepBody: { flex: 1 },
  stepNum: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#ffedd5',
    color: colors.brand,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 28,
    overflow: 'hidden',
  },
  stepText: { color: colors.stone700, lineHeight: 22 },
  error: { marginTop: 12, color: colors.red700 },
  hint: { marginTop: 12, color: colors.stone600 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 24 },
  primaryBtn: {
    flex: 1,
    backgroundColor: colors.brand,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryBtnText: { color: colors.white, fontWeight: '700' },
  secondaryBtn: {
    flex: 1,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.stone200,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  secondaryBtnText: { color: colors.stone800, fontWeight: '700' },
  disabled: { opacity: 0.6 },
})
