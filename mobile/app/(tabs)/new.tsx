import { router, useFocusEffect } from 'expo-router'
import { useCallback, useState } from 'react'
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useMutation } from '@tanstack/react-query'
import { ingestSocialLink } from '@/api/ingest'
import { parseRecipe } from '@/api/client'
import { saveReviewDraft, consumeAddFormReset } from '@/lib/reviewDraft'
import type { IngestLinkResponse } from '@/types/ingest'
import { videoPlatformLabel } from '@/types/ingest'
import { VideoLinkPreview } from '@/components/VideoLinkPreview'
import { RecipeCreateProgress } from '@/components/RecipeCreateProgress'
import { useFeatures } from '@/context/FeaturesContext'
import {
  colors,
  commonStyles,
  disabledStyle,
  fonts,
  labelStyle,
  spacing,
} from '@/constants/theme'

type CreateResult =
  | {
      status: 'done'
      ingested: IngestLinkResponse
      rawText: string
      parsed: Awaited<ReturnType<typeof parseRecipe>>
    }
  | { status: 'needs_edit'; ingested: IngestLinkResponse; rawText: string; message: string }

export default function NewRecipeScreen() {
  const features = useFeatures()
  const [text, setText] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [manualCaption, setManualCaption] = useState('')
  const [extracted, setExtracted] = useState<IngestLinkResponse | null>(null)
  const [editMessage, setEditMessage] = useState<string | null>(null)
  const [progressStep, setProgressStep] = useState<number | null>(null)
  const [progressSession, setProgressSession] = useState(0)

  const createRecipeMutation = useMutation({
    mutationFn: async (): Promise<CreateResult> => {
      setProgressStep(0)
      const ingested = await ingestSocialLink({
        url: linkUrl.trim(),
        caption: manualCaption.trim() || undefined,
      })
      setProgressStep(1)
      const rawText = ingested.raw_text.trim()
      if (rawText.length < 10) {
        return {
          status: 'needs_edit',
          ingested,
          rawText,
          message:
            'We could not find enough recipe text in that link. Add the caption from the post and try again.',
        }
      }
      setProgressStep(2)
      try {
        const parsed = await parseRecipe({
          raw_text: rawText,
          source_url: ingested.source_url,
          video_duration: ingested.video_duration ?? undefined,
        })
        return { status: 'done', ingested, rawText, parsed }
      } catch {
        return {
          status: 'needs_edit',
          ingested,
          rawText,
          message:
            'We found the recipe but had trouble breaking it into steps. Edit the text below and try again.',
        }
      }
    },
    onSuccess: async (result) => {
      if (result.status === 'done') {
        await saveReviewDraft({
          rawText: result.rawText,
          recipe: result.parsed.recipe,
          usedAi: result.parsed.used_ai,
          sourceType: result.ingested.source_type,
          sourceUrl: result.ingested.source_url,
          stepImageNotes: result.parsed.step_image_notes,
        })
        router.push('/review')
        return
      }
      setExtracted(result.ingested)
      setText(result.rawText)
      setEditMessage(result.message)
    },
    onMutate: () => {
      setProgressStep(0)
      setProgressSession((s) => s + 1)
    },
    onSettled: () => setProgressStep(null),
  })

  const retryParseMutation = useMutation({
    mutationFn: async () => {
      if (!extracted) throw new Error('Nothing to build yet.')
      setProgressStep(0)
      const rawText = text.trim()
      if (rawText.length < 10) {
        throw new Error('Recipe text is too short. Add more detail or paste the caption and try again.')
      }
      return parseRecipe({
        raw_text: rawText,
        source_url: extracted.source_url,
        video_duration: extracted.video_duration ?? undefined,
      })
    },
    onSuccess: async (parsed) => {
      if (!extracted) return
      await saveReviewDraft({
        rawText: text.trim(),
        recipe: parsed.recipe,
        usedAi: parsed.used_ai,
        sourceType: extracted.source_type,
        sourceUrl: extracted.source_url,
        stepImageNotes: parsed.step_image_notes,
      })
      router.push('/review')
    },
    onMutate: () => {
      setProgressStep(0)
      setProgressSession((s) => s + 1)
    },
    onSettled: () => setProgressStep(null),
  })

  const resetAddForm = useCallback(() => {
    setLinkUrl('')
    setManualCaption('')
    setExtracted(null)
    setText('')
    setEditMessage(null)
    setProgressStep(null)
    createRecipeMutation.reset()
    retryParseMutation.reset()
  }, [createRecipeMutation, retryParseMutation])

  useFocusEffect(
    useCallback(() => {
      void consumeAddFormReset().then((shouldReset) => {
        if (shouldReset) resetAddForm()
      })
    }, [resetAddForm]),
  )

  const isBusy = createRecipeMutation.isPending || retryParseMutation.isPending
  const showEditPanel = extracted !== null
  const canSubmit = linkUrl.trim().length >= 10 && !isBusy

  const resetLinkFlow = () => {
    setExtracted(null)
    setText('')
    setEditMessage(null)
    setProgressStep(null)
    createRecipeMutation.reset()
    retryParseMutation.reset()
  }

  if (!features.social_ingest) {
    return (
      <ScrollView style={commonStyles.screen} contentContainerStyle={commonStyles.screenContent}>
        <Text style={commonStyles.pageTitle}>Add a recipe</Text>
        <View style={[commonStyles.amberBanner, { marginTop: spacing.lg }]}>
          <Text style={commonStyles.amberBannerText}>
            Adding recipes from links is currently unavailable. Please try again later.
          </Text>
        </View>
      </ScrollView>
    )
  }

  const linkError = createRecipeMutation.error as Error | null
  const parseError = retryParseMutation.error as Error | null

  return (
    <ScrollView style={commonStyles.screen} contentContainerStyle={commonStyles.screenContent}>
      <Text style={commonStyles.pageSubtitle}>
        Paste a link to any cooking video or recipe page — we&apos;ll read it and break it into easy
        step-by-step cards.
      </Text>

      {!features.ai && (
        <View style={[commonStyles.amberBanner, { marginTop: spacing.lg }]}>
          <Text style={commonStyles.amberBannerText}>
            AI parsing is off — recipes use basic text splitting only.
          </Text>
        </View>
      )}

      <View style={{ marginTop: spacing.xxl, gap: spacing.lg }}>
        <View>
          <Text style={labelStyle()}>Recipe or video link</Text>
          <TextInput
            value={linkUrl}
            onChangeText={(v) => {
              setLinkUrl(v)
              if (extracted) resetLinkFlow()
            }}
            placeholder="TikTok, YouTube, Instagram, or any recipe website…"
            placeholderTextColor={colors.stone400}
            autoCapitalize="none"
            keyboardType="url"
            style={commonStyles.input}
          />
        </View>

        {linkUrl.trim().length >= 10 && <VideoLinkPreview url={linkUrl} />}

        <View>
          <Text style={labelStyle()}>
            Caption from the post{' '}
            <Text style={styles.optionalHint}>
              (recommended for Instagram / TikTok when auto-fetch fails)
            </Text>
          </Text>
          <TextInput
            value={manualCaption}
            onChangeText={setManualCaption}
            placeholder="Copy and paste the video caption here — works even when the link can't be fetched automatically…"
            placeholderTextColor={colors.stone400}
            multiline
            textAlignVertical="top"
            style={[
              commonStyles.input,
              styles.captionArea,
              linkError ? { borderColor: colors.accent500 } : null,
            ]}
          />
        </View>

        {!showEditPanel && (
          <Pressable
            disabled={!canSubmit}
            onPress={() => createRecipeMutation.mutate()}
            style={[commonStyles.primaryBtn, disabledStyle(!canSubmit)]}
          >
            <Text style={commonStyles.primaryBtnText}>Create step-by-step recipe</Text>
          </Pressable>
        )}

        {createRecipeMutation.isPending && progressStep !== null && (
          <RecipeCreateProgress key={`create-${progressSession}`} step={progressStep} mode="full" />
        )}

        {retryParseMutation.isPending && progressStep !== null && (
          <RecipeCreateProgress key={`retry-${progressSession}`} step={progressStep} mode="parse-only" />
        )}

        {linkError && (
          <View style={commonStyles.errorBanner}>
            <Text style={commonStyles.errorBannerText}>
              {linkError.message || 'Something went wrong. Is the backend running?'}
            </Text>
            <Text style={[commonStyles.errorBannerText, { marginTop: spacing.sm, opacity: 0.9 }]}>
              Open the post → copy the caption → paste it above → try again. Instagram/TikTok often
              block automatic link fetch even when the URL works in your browser.
            </Text>
          </View>
        )}

        {showEditPanel && extracted && (
          <View style={commonStyles.brandPanel}>
            {editMessage && (
              <View style={[commonStyles.amberBanner, { marginBottom: spacing.lg }]}>
                <Text style={commonStyles.amberBannerText}>{editMessage}</Text>
              </View>
            )}

            <View style={styles.extractedHeader}>
              {extracted.thumbnail_url ? (
                <Image source={{ uri: extracted.thumbnail_url }} style={styles.thumbnail} />
              ) : null}
              <View style={styles.extractedMeta}>
                <Text style={styles.extractedTitle}>
                  Found on {videoPlatformLabel(extracted.source_type)}
                </Text>
                {extracted.title ? (
                  <Text style={styles.extractedSubtitle} numberOfLines={1}>
                    {extracted.title}
                  </Text>
                ) : null}
                {extracted.author ? (
                  <Text style={styles.extractedAuthor}>by {extracted.author}</Text>
                ) : null}
                {extracted.extraction_notes.map((note) => (
                  <Text key={note} style={styles.note}>
                    • {note}
                  </Text>
                ))}
              </View>
            </View>

            <Text style={[labelStyle(), { marginTop: spacing.lg }]}>
              Recipe text — edit anything that looks wrong
            </Text>
            <TextInput
              value={text}
              onChangeText={setText}
              multiline
              textAlignVertical="top"
              style={[commonStyles.input, styles.textArea]}
            />

            <Text style={styles.charCount}>
              {text.length.toLocaleString()} characters · confidence{' '}
              {Math.round(extracted.confidence * 100)}%
            </Text>

            {parseError && (
              <View style={[commonStyles.errorBanner, { marginTop: spacing.lg }]}>
                <Text style={commonStyles.errorBannerText}>{parseError.message}</Text>
              </View>
            )}

            <Pressable
              disabled={text.trim().length < 10 || retryParseMutation.isPending}
              onPress={() => retryParseMutation.mutate()}
              style={[
                commonStyles.primaryBtn,
                { marginTop: spacing.lg },
                disabledStyle(text.trim().length < 10 || retryParseMutation.isPending),
              ]}
            >
              <Text style={commonStyles.primaryBtnText}>Create step-by-step recipe</Text>
            </Pressable>
          </View>
        )}
      </View>

      <Text style={styles.footer}>
        Works with TikTok, YouTube, Instagram, and recipe blogs. May take up to a minute for longer
        videos.
      </Text>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  optionalHint: {
    fontFamily: fonts.sans,
    fontWeight: '400',
    color: colors.stone400,
  },
  captionArea: { minHeight: 96 },
  textArea: { minHeight: 200, marginTop: spacing.xs },
  extractedHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.lg,
    alignItems: 'flex-start',
  },
  thumbnail: {
    width: 80,
    height: 80,
    borderRadius: 14,
  },
  extractedMeta: { flex: 1, minWidth: 0 },
  extractedTitle: {
    fontFamily: fonts.displaySemiBold,
    fontSize: 14,
    color: colors.stone900,
  },
  extractedSubtitle: {
    marginTop: 2,
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.stone600,
  },
  extractedAuthor: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.stone500,
  },
  note: {
    marginTop: 4,
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.stone600,
  },
  charCount: {
    marginTop: spacing.sm,
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.stone500,
  },
  footer: {
    marginTop: spacing.xxl,
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.stone400,
    lineHeight: 18,
  },
})
