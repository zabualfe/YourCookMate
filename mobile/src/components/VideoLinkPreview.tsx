import { useEffect, useState } from 'react'
import { Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native'
import { resolveVideoEmbed, type VideoEmbedPreview } from '@/lib/videoEmbed'
import { videoPlatformLabel } from '@/types/ingest'
import { colors } from '@/constants/theme'

interface VideoLinkPreviewProps {
  url: string
}

export function VideoLinkPreview({ url }: VideoLinkPreviewProps) {
  const [preview, setPreview] = useState<VideoEmbedPreview | null>(null)

  useEffect(() => {
    const trimmed = url.trim()
    if (trimmed.length < 10) {
      setPreview(null)
      return undefined
    }
    const timer = setTimeout(() => setPreview(resolveVideoEmbed(trimmed)), 400)
    return () => clearTimeout(timer)
  }, [url])

  if (!preview) return null

  const open = () => {
    void Linking.openURL(preview.normalizedUrl)
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.label}>{videoPlatformLabel(preview.platform)} link detected</Text>
        <Pressable onPress={open}>
          <Text style={styles.open}>Open video</Text>
        </Pressable>
      </View>
      {preview.thumbnailUrl ? (
        <Pressable onPress={open}>
          <Image source={{ uri: preview.thumbnailUrl }} style={styles.thumb} resizeMode="cover" />
        </Pressable>
      ) : (
        <Text style={styles.hint}>
          {preview.embedUrl
            ? 'Tap Open video to confirm this is the right post.'
            : 'Preview not available for this URL — you can still try importing.'}
        </Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.stone200,
    backgroundColor: colors.white,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.stone100,
  },
  label: { fontSize: 12, fontWeight: '600', color: colors.stone700 },
  open: { fontSize: 12, fontWeight: '600', color: colors.brand },
  thumb: { width: '100%', aspectRatio: 16 / 9 },
  hint: { padding: 12, fontSize: 13, color: colors.stone600, lineHeight: 18 },
})
