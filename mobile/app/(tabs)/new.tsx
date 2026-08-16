import { router, useFocusEffect } from 'expo-router'
import { useCallback, useState } from 'react'
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ingestSocialLink } from '@/api/ingest'
import { checkUpload, getBillingUsage, lookupSocialLink, parseRecipe } from '@/api/client'
import { isBillingError, isSocialFetchError } from '@/api/errors'
import { saveReviewDraft, consumeAddFormReset } from '@/lib/reviewDraft'
import type { IngestLinkResponse } from '@/types/ingest'
import { videoPlatformLabel } from '@/types/ingest'
import { VideoLinkPreview } from '@/components/VideoLinkPreview'
import { RecipeCreateProgress } from '@/components/RecipeCreateProgress'
import { UpgradePaywall } from '@/components/UpgradePaywall'
import { ExistingSourcePrompt } from '@/components/ExistingSourcePrompt'
import { useAuth } from '@/context/AuthContext'
import { useFeatures } from '@/context/FeaturesContext'
import { uploadsLeftLabel, videoLimitLabel } from '@/types/billing'
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
      allowDuplicate?: boolean
    }
  | {
      status: 'cached'
      kind: 'library' | 'generated'
      ingested: IngestLinkResponse
      rawText: string
    }
  | { status: 'needs_edit'; ingested: IngestLinkResponse; rawText: string; message: string }

export default function NewRecipeScreen() {
  const features = useFeatures()
  const { isAuthenticated, loading: authLoading } = useAuth()
  const queryClient = useQueryClient()
  const [text, setText] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [manualCaption, setManualCaption] = useState('')
  const [extracted, setExtracted] = useState<IngestLinkResponse | null>(null)
  const [editMessage, setEditMessage] = useState<string | null>(null)
  const [progressStep, setProgressStep] = useState<number | null>(null)
  const [progressSession, setProgressSession] = useState(0)
  const [cachedPrompt, setCachedPrompt] = useState<Extract<CreateResult, { status: 'cached' }> | null>(
    null,
  )

  const { data: usage } = useQuery({
    queryKey: ['billing-usage'],
    queryFn: getBillingUsage,
    enabled: isAuthenticated,
  })

  const createRecipeMutation = useMutation({
    mutationFn: async (opts: { force?: boolean } = {}): Promise<CreateResult> => {
      const force = Boolean(opts?.force)
      if (!force) {
        try {
          const looked = await lookupSocialLink(linkUrl.trim())
          if (looked.found && looked.existing_recipe_id) {
            return {
              status: 'cached',
              kind: 'library',
              ingested: looked,
              rawText: looked.raw_text.trim(),
            }
          }
          if (looked.found && looked.from_cache && looked.recipe && looked.recipe.steps.length > 0) {
            return { status: 'cached', kind: 'generated', ingested: looked, rawText: looked.raw_text.trim() }
          }
        } catch {
          // Lookup is optional — production used to 404 this route; still try ingest.
        }
      }
      await checkUpload()
      setProgressStep(0)
      const ingested = await ingestSocialLink({
        url: linkUrl.trim(),
        caption: manualCaption.trim() || undefined,
        force,
      })
      if (!force && ingested.existing_recipe_id) {
        return {
          status: 'cached',
          kind: 'library',
          ingested,
          rawText: ingested.raw_text.trim(),
        }
      }
      if (ingested.video_duration) {
        await checkUpload(ingested.video_duration)
      }
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
      if (!force && ingested.from_cache && ingested.recipe && ingested.recipe.steps.length > 0) {
        return { status: 'cached', kind: 'generated', ingested, rawText }
      }
      try {
        const parsed = await parseRecipe({
          raw_text: rawText,
          source_url: ingested.source_url,
          video_duration: ingested.video_duration ?? undefined,
          force,
        })
        return { status: 'done', ingested, rawText, parsed, allowDuplicate: force }
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
      if (result.status === 'cached') {
        setCachedPrompt(result)
        return
      }
      setCachedPrompt(null)
      if (result.status === 'done') {
        if (result.allowDuplicate) {
          queryClient.invalidateQueries({ queryKey: ['billing-usage'] })
        }
        await saveReviewDraft({
          rawText: result.rawText,
          recipe: result.parsed.recipe,
          usedAi: result.parsed.used_ai,
          sourceType: result.ingested.source_type,
          sourceUrl: result.ingested.source_url,
          stepImageNotes: result.parsed.step_image_notes,
          allowDuplicate: result.allowDuplicate,
          usageAlreadyRecorded: result.allowDuplicate,
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
      await checkUpload(extracted.video_duration)
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
    setCachedPrompt(null)
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
  const overQuota = (usage?.uploads_remaining_today ?? 1) <= 0
  const canSubmit = linkUrl.trim().length >= 10 && !isBusy && !overQuota
  const billingError = [createRecipeMutation.error, retryParseMutation.error].find((err) =>
    isBillingError(err),
  )
  const paywallReason = isBillingError(billingError, 'video_too_long')
    ? 'duration'
    : isBillingError(billingError, 'daily_upload_limit') || overQuota
      ? 'quota'
      : null

  const resetLinkFlow = () => {
    setExtracted(null)
    setText('')
    setEditMessage(null)
    setProgressStep(null)
    setCachedPrompt(null)
    createRecipeMutation.reset()
    retryParseMutation.reset()
  }

  if (authLoading) {
    return (
      <View style={[commonStyles.screen, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={colors.brand} />
      </View>
    )
  }

  if (!isAuthenticated) {
    return (
      <ScrollView style={commonStyles.screen} contentContainerStyle={commonStyles.screenContent}>
        <Text style={commonStyles.pageTitle}>Add a recipe</Text>
        <Text style={[commonStyles.pageSubtitle, { marginTop: spacing.md }]}>
          Sign in to import recipes. Free accounts get 2 uploads a day.
        </Text>
        <Pressable onPress={() => router.push('/login')} style={[commonStyles.primaryBtn, { marginTop: spacing.xxl }]}>
          <Text style={commonStyles.primaryBtnText}>Sign in</Text>
        </Pressable>
      </ScrollView>
    )
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
      {usage ? (
        <Text style={[commonStyles.pageSubtitle, { marginTop: spacing.sm }]}>
          {uploadsLeftLabel(usage)} · videos up to {videoLimitLabel(usage.max_video_seconds)}
          {usage.is_pro ? '' : ' · Free recipes stay viewable for 14 days'}
        </Text>
      ) : null}
      {paywallReason ? (
        <View style={{ marginTop: spacing.lg }}>
          <UpgradePaywall reason={paywallReason} usage={usage} />
        </View>
      ) : null}

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
              if (extracted || cachedPrompt) resetLinkFlow()
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

        {!showEditPanel && !cachedPrompt && (
          <Pressable
            disabled={!canSubmit}
            onPress={() => createRecipeMutation.mutate({})}
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

        {cachedPrompt && !createRecipeMutation.isPending ? (
          <ExistingSourcePrompt
            kind={cachedPrompt.kind}
            title={cachedPrompt.ingested.title || cachedPrompt.ingested.recipe?.title}
            thumbnailUrl={cachedPrompt.ingested.thumbnail_url}
            onDismiss={resetLinkFlow}
            onUseExisting={() => {
              if (cachedPrompt.kind === 'library' && cachedPrompt.ingested.existing_recipe_id) {
                router.push(`/recipes/${cachedPrompt.ingested.existing_recipe_id}`)
                return
              }
              const recipe = cachedPrompt.ingested.recipe
              if (!recipe || recipe.steps.length === 0) {
                setExtracted(cachedPrompt.ingested)
                setText(cachedPrompt.rawText)
                setEditMessage('We found this video before, but need a little more text to build the steps.')
                setCachedPrompt(null)
                return
              }
              void saveReviewDraft({
                rawText: cachedPrompt.rawText,
                recipe,
                usedAi: cachedPrompt.ingested.used_ai ?? true,
                sourceType: cachedPrompt.ingested.source_type,
                sourceUrl: cachedPrompt.ingested.source_url,
                stepImageNotes: cachedPrompt.ingested.extraction_notes,
              }).then(() => router.push('/review'))
            }}
            onGenerateNew={() => createRecipeMutation.mutate({ force: true })}
          />
        ) : null}

        {linkError && !isBillingError(linkError) && (
          <View style={commonStyles.errorBanner}>
            <Text style={commonStyles.errorBannerText}>
              {linkError.message || 'Something went wrong. Is the backend running?'}
            </Text>
            {isSocialFetchError(linkError) ? (
              <Text style={[commonStyles.errorBannerText, { marginTop: spacing.sm, opacity: 0.9 }]}>
                Open the post → copy the caption → paste it above → try again. Instagram/TikTok often
                block automatic link fetch even when the URL works in your browser.
              </Text>
            ) : null}
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

            {parseError && !isBillingError(parseError) && (
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
