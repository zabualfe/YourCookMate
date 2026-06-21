import { router } from 'expo-router'
import { useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useMutation } from '@tanstack/react-query'
import { ingestSocialLink, parseRecipe } from '@/api/client'
import { saveReviewDraft } from '@/lib/reviewDraft'
import type { IngestLinkResponse } from '@/types/ingest'
import { videoPlatformLabel } from '@/types/ingest'
import { colors } from '@/constants/theme'

type Tab = 'text' | 'link'

export default function NewRecipeScreen() {
  const [tab, setTab] = useState<Tab>('text')
  const [text, setText] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [manualCaption, setManualCaption] = useState('')
  const [extracted, setExtracted] = useState<IngestLinkResponse | null>(null)

  const parseMutation = useMutation({
    mutationFn: async () => {
      const raw = (tab === 'link' && extracted ? text : text).trim()
      const result = await parseRecipe({
        raw_text: raw,
        source_url: extracted?.source_url,
        video_duration: extracted?.video_duration ?? undefined,
      })
      await saveReviewDraft({
        rawText: raw,
        recipe: result.recipe,
        usedAi: result.used_ai,
        sourceType: extracted?.source_type,
        sourceUrl: extracted?.source_url,
        stepImageNotes: result.step_image_notes,
      })
    },
    onSuccess: () => router.push('/review'),
  })

  const ingestMutation = useMutation({
    mutationFn: () =>
      ingestSocialLink({
        url: linkUrl.trim(),
        caption: manualCaption.trim() || undefined,
      }),
    onSuccess: (data) => {
      setExtracted(data)
      setText(data.raw_text)
    },
  })

  const activeText = text.trim()
  const canParse = activeText.length >= 10 && !parseMutation.isPending

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.subtitle}>Paste text or import from a video link.</Text>

      <View style={styles.tabs}>
        {(['text', 'link'] as Tab[]).map((t) => (
          <Pressable
            key={t}
            onPress={() => setTab(t)}
            style={[styles.tab, tab === t && styles.tabActive]}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === 'text' ? 'Paste text' : 'Video link'}
            </Text>
          </Pressable>
        ))}
      </View>

      {tab === 'text' ? (
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Paste your full recipe here…"
          placeholderTextColor={colors.stone500}
          multiline
          textAlignVertical="top"
          style={[styles.input, styles.textArea]}
        />
      ) : (
        <View style={styles.linkSection}>
          <Text style={styles.label}>Video URL</Text>
          <TextInput
            value={linkUrl}
            onChangeText={(v) => {
              setLinkUrl(v)
              if (extracted) {
                setExtracted(null)
                setText('')
              }
            }}
            placeholder="Instagram, TikTok, YouTube…"
            placeholderTextColor={colors.stone500}
            autoCapitalize="none"
            style={styles.input}
          />
          <Text style={[styles.label, { marginTop: 12 }]}>Caption (optional)</Text>
          <TextInput
            value={manualCaption}
            onChangeText={setManualCaption}
            placeholder="Paste caption if import fails…"
            placeholderTextColor={colors.stone500}
            multiline
            textAlignVertical="top"
            style={[styles.input, styles.captionArea]}
          />
          <Pressable
            disabled={linkUrl.trim().length < 10 || ingestMutation.isPending}
            onPress={() => ingestMutation.mutate()}
            style={[styles.secondaryBtn, (linkUrl.trim().length < 10 || ingestMutation.isPending) && styles.disabled]}
          >
            <Text style={styles.secondaryBtnText}>
              {ingestMutation.isPending ? 'Importing (may take a minute)…' : 'Import from link'}
            </Text>
          </Pressable>
          {ingestMutation.isError && (
            <Text style={styles.error}>{(ingestMutation.error as Error).message}</Text>
          )}
          {extracted && (
            <View style={styles.extracted}>
              <Text style={styles.extractedTitle}>
                Imported from {videoPlatformLabel(extracted.source_type)}
              </Text>
              {extracted.extraction_notes.map((note) => (
                <Text key={note} style={styles.note}>• {note}</Text>
              ))}
              <TextInput
                value={text}
                onChangeText={setText}
                multiline
                textAlignVertical="top"
                style={[styles.input, styles.textArea, { marginTop: 12 }]}
              />
            </View>
          )}
        </View>
      )}

      {parseMutation.isError && (
        <Text style={styles.error}>{(parseMutation.error as Error).message}</Text>
      )}

      {(tab === 'text' || extracted) && (
        <Pressable
          disabled={!canParse}
          onPress={() => parseMutation.mutate()}
          style={[styles.primaryBtn, !canParse && styles.disabled]}
        >
          {parseMutation.isPending ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.primaryBtnText}>Parse recipe</Text>
          )}
        </Pressable>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.stone50 },
  content: { padding: 16, paddingBottom: 40 },
  subtitle: { color: colors.stone600, marginBottom: 16 },
  tabs: { flexDirection: 'row', backgroundColor: colors.stone100, borderRadius: 12, padding: 4, marginBottom: 16 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  tabActive: { backgroundColor: colors.white },
  tabText: { fontWeight: '600', color: colors.stone500 },
  tabTextActive: { color: colors.stone900 },
  input: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.stone200,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.stone900,
  },
  textArea: { minHeight: 200, marginTop: 4 },
  captionArea: { minHeight: 80, marginTop: 4 },
  linkSection: { gap: 4 },
  label: { fontSize: 14, fontWeight: '600', color: colors.stone700 },
  primaryBtn: {
    marginTop: 20,
    backgroundColor: colors.brand,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryBtnText: { color: colors.white, fontSize: 17, fontWeight: '700' },
  secondaryBtn: {
    marginTop: 12,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.stone200,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryBtnText: { fontWeight: '600', color: colors.stone800 },
  disabled: { opacity: 0.5 },
  error: { marginTop: 12, color: colors.red700, backgroundColor: colors.red50, padding: 12, borderRadius: 12 },
  extracted: {
    marginTop: 16,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#fed7aa',
    backgroundColor: '#fff7ed',
  },
  extractedTitle: { fontWeight: '700', color: colors.stone900 },
  note: { fontSize: 12, color: colors.stone600, marginTop: 4 },
})
