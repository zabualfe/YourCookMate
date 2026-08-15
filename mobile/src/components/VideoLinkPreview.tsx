import { useEffect, useState } from 'react'
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native'
import { fetchLinkPreview } from '@/api/ingest'
import { resolveVideoEmbed } from '@/lib/videoEmbed'
import type { LinkPreviewResponse } from '@/types/ingest'
import { videoPlatformLabel } from '@/types/ingest'
import { colors } from '@/constants/theme'

interface VideoLinkPreviewProps {
  url: string
}

function VideoThumb({ thumbnailUrl }: { thumbnailUrl: string | null | undefined }) {
  if (thumbnailUrl) {
    return <Image source={{ uri: thumbnailUrl }} style={styles.thumb} resizeMode="cover" />
  }
  return (
    <View style={styles.thumbPlaceholder}>
      <Text style={styles.playIcon}>▶</Text>
    </View>
  )
}

export function VideoLinkPreview({ url }: VideoLinkPreviewProps) {
  const [preview, setPreview] = useState<LinkPreviewResponse | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const trimmed = url.trim()
    if (trimmed.length < 10) {
      setPreview(null)
      setLoading(false)
      return undefined
    }

    setLoading(true)
    let cancelled = false
    const timer = setTimeout(() => {
      fetchLinkPreview(trimmed)
        .then((result) => {
          if (!cancelled) setPreview(result)
        })
        .catch(() => {
          if (cancelled) return
          const fallback = resolveVideoEmbed(trimmed)
          setPreview({
            valid: Boolean(fallback),
            source_type: fallback?.platform ?? 'video',
            source_url: fallback?.normalizedUrl ?? trimmed,
            title: fallback ? `${videoPlatformLabel(fallback.platform)} video` : null,
            author: null,
            thumbnail_url: fallback?.thumbnailUrl ?? null,
          })
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    }, 500)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [url])

  if (url.trim().length < 10) return null

  if (loading) {
    return (
      <View style={[styles.box, styles.loading]}>
        <ActivityIndicator color={colors.brand} />
        <Text style={styles.loadingText}>Checking link…</Text>
      </View>
    )
  }

  if (!preview) return null

  if (!preview.valid) {
    return (
      <View style={[styles.box, styles.error]}>
        <Text style={styles.errorTitle}>Couldn&apos;t verify this link</Text>
        <Text style={styles.errorBody}>
          {preview.message ?? 'Check the URL or paste the caption manually.'}
        </Text>
      </View>
    )
  }

  const title = preview.title || `${videoPlatformLabel(preview.source_type)} video`

  return (
    <View style={[styles.box, styles.valid]}>
      <VideoThumb thumbnailUrl={preview.thumbnail_url} />
      <View style={styles.meta}>
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
        <Text style={styles.author} numberOfLines={1}>
          {preview.author ? `by ${preview.author}` : videoPlatformLabel(preview.source_type)}
        </Text>
      </View>
      <Text style={styles.check}>✓</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  box: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  valid: {
    borderWidth: 1,
    borderColor: '#86efac',
    backgroundColor: colors.brand50,
  },
  loading: {
    borderWidth: 1,
    borderColor: '#bbf7d0',
    backgroundColor: colors.brand50,
    justifyContent: 'flex-start',
  },
  loadingText: { fontSize: 13, color: '#166534', marginLeft: 4 },
  error: {
    borderWidth: 1,
    borderColor: '#fcd34d',
    backgroundColor: '#fffbeb',
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  errorTitle: { fontWeight: '700', color: '#92400e' },
  errorBody: { marginTop: 4, fontSize: 13, color: '#b45309', lineHeight: 18 },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  thumbPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 10,
    backgroundColor: '#dcfce7',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playIcon: { fontSize: 18, color: '#15803d' },
  meta: { flex: 1, minWidth: 0 },
  title: { fontSize: 14, fontWeight: '700', color: '#14532d' },
  author: { marginTop: 2, fontSize: 13, color: '#166534' },
  check: {
    fontSize: 12,
    fontWeight: '700',
    color: '#14532d',
    backgroundColor: '#bbf7d0',
    overflow: 'hidden',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
})
